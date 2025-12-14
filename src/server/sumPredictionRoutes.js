/**
 * 和值预测批量验证 - API路由
 * 创建日期: 2025-12-07
 *
 * 包含:
 * - 任务创建、查询、删除API
 * - 批量执行逻辑
 * - 自动寻优API
 * - Excel导出API
 */

const { SumPredictionTask, SumPredictionResult } = require('./sumPredictionModels');
const {
    calculateMA,
    calculateWeightedMA,
    calculateLinearRegression,
    calculateRSI,
    calculateMACD,
    calculateBollinger,
    predictByMethod,
    applyTechnicalAdjustment,
    calculateSumPrediction,
    validatePrediction
} = require('./sumPredictionAlgorithms');
const ExcelJS = require('exceljs');

// 日志函数
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * 格式化预测范围显示（用于Excel导出）
 * @param {Object} pred - 预测结果对象
 * @returns {string} - 格式化的预测范围字符串
 */
function formatPredRange(pred) {
    if (!pred) return '-';

    // 历史和值集方法：显示完整集合
    if (pred.sum_set && pred.sum_set.length > 0) {
        const expandText = pred.range_expand > 0 ? ` ±${pred.range_expand}` : '';
        return pred.sum_set.join(',') + expandText;
    }

    // 其他方法：显示范围
    if (pred.range_min !== null && pred.range_max !== null) {
        return `${pred.range_min}-${pred.range_max}`;
    }

    return '-';
}

/**
 * 生成任务ID
 * @returns {string} 任务ID (sum-pred-YYYYMMDD-序号)
 */
async function generateTaskId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // 查找今天的最大序号
    const pattern = `sum-pred-${dateStr}-`;
    const existingTasks = await SumPredictionTask.find({
        task_id: { $regex: `^${pattern}` }
    }).sort({ task_id: -1 }).limit(1);

    let seq = 1;
    if (existingTasks.length > 0) {
        const lastId = existingTasks[0].task_id;
        const lastSeq = parseInt(lastId.split('-').pop(), 10);
        seq = lastSeq + 1;
    }

    return `sum-pred-${dateStr}-${seq.toString().padStart(3, '0')}`;
}

/**
 * 解析期号范围
 * @param {Object} periodRange - 期号范围配置
 * @param {Object} hit_dlts - 大乐透数据模型
 * @returns {Promise<Array>} 期号列表
 */
async function resolvePeriodRange(periodRange, hit_dlts) {
    let periods = [];

    switch (periodRange.type) {
        case 'all':
            // 全部历史期号
            const allData = await hit_dlts.find({}, { Issue: 1 })
                .sort({ Issue: 1 })
                .lean();
            periods = allData.map(d => d.Issue);
            break;

        case 'recent':
            // 最近N期
            const recentCount = periodRange.recent_count || 100;
            const recentData = await hit_dlts.find({}, { Issue: 1 })
                .sort({ Issue: -1 })
                .limit(recentCount)
                .lean();
            periods = recentData.map(d => d.Issue).reverse();
            break;

        case 'custom':
            // 自定义范围
            const startIssue = parseInt(periodRange.start_issue);
            const endIssue = parseInt(periodRange.end_issue);
            const customData = await hit_dlts.find({
                Issue: { $gte: startIssue, $lte: endIssue }
            }, { Issue: 1 })
                .sort({ Issue: 1 })
                .lean();
            periods = customData.map(d => d.Issue);
            break;

        default:
            throw new Error(`不支持的期号范围类型: ${periodRange.type}`);
    }

    return periods;
}

/**
 * 获取训练数据
 * @param {number} targetPeriod - 目标期号
 * @param {number} windowSize - 训练窗口大小
 * @param {Object} hit_dlts - 大乐透数据模型
 * @returns {Promise<Array>} 训练数据
 */
async function getTrainingData(targetPeriod, windowSize, hit_dlts) {
    // 获取目标期号之前的windowSize期数据
    const trainingData = await hit_dlts.find({
        Issue: { $lt: targetPeriod }
    })
        .sort({ Issue: -1 })
        .limit(windowSize)
        .lean();

    // 返回时按期号升序
    return trainingData.reverse();
}

/**
 * 处理和值预测任务
 * @param {string} taskId - 任务ID
 * @param {Object} hit_dlts - 大乐透数据模型
 * @param {Object} io - Socket.IO实例
 */
async function processSumPredictionTask(taskId, hit_dlts, io) {
    const task = await SumPredictionTask.findOne({ task_id: taskId });
    if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
    }

    try {
        // 更新状态为处理中
        task.status = 'processing';
        task.execution_stats = {
            start_time: new Date(),
            end_time: null,
            duration_ms: null
        };
        await task.save();

        // 发送任务开始事件
        if (io) {
            io.emit('sum-task-started', {
                task_id: taskId,
                total_periods: task.period_range.total_periods
            });
        }

        log(`📊 开始处理和值预测任务: ${taskId}`);

        // 解析期号范围
        const periods = await resolvePeriodRange(task.period_range, hit_dlts);
        const trainingWindow = task.training_window;

        // 更新总期数
        task.period_range.total_periods = periods.length;
        await task.save();

        // 统计变量
        let frontHits = 0, backHits = 0, bothHits = 0;
        let frontDiffSum = 0, backDiffSum = 0;
        let frontDiffCount = 0, backDiffCount = 0;
        let frontAbove = 0, frontBelow = 0, backAbove = 0, backBelow = 0;
        let processedCount = 0;

        // 逐期处理
        for (let i = 0; i < periods.length; i++) {
            const targetPeriod = periods[i];

            // 1. 获取训练数据
            const trainingData = await getTrainingData(targetPeriod, trainingWindow, hit_dlts);

            if (trainingData.length < Math.min(trainingWindow, 10)) {
                // 训练数据不足，跳过
                continue;
            }

            // 2. 计算预测
            const prediction = calculateSumPrediction(
                trainingData,
                task.front_strategy,
                task.back_strategy,
                task.technical_analysis
            );

            // 3. 获取实际开奖数据
            const actualData = await hit_dlts.findOne({ Issue: targetPeriod }).lean();
            if (!actualData) continue;

            const actual = {
                red_balls: [actualData.Red1, actualData.Red2, actualData.Red3, actualData.Red4, actualData.Red5],
                blue_balls: [actualData.Blue1, actualData.Blue2],
                front_sum: actualData.Red1 + actualData.Red2 + actualData.Red3 + actualData.Red4 + actualData.Red5,
                back_sum: actualData.Blue1 + actualData.Blue2
            };

            // 4. 验证命中
            const validation = validatePrediction(
                prediction,
                actual,
                task.front_strategy.method,
                task.front_strategy.history_set,
                task.back_strategy.method,
                task.back_strategy.history_set
            );

            // 5. 累计统计
            if (validation.front_hit) frontHits++;
            if (validation.back_hit) backHits++;
            if (validation.both_hit) bothHits++;

            if (validation.front_diff !== null) {
                frontDiffSum += validation.front_diff;
                frontDiffCount++;
            }
            if (validation.back_diff !== null) {
                backDiffSum += validation.back_diff;
                backDiffCount++;
            }

            if (validation.front_range_position === 'above') frontAbove++;
            if (validation.front_range_position === 'below') frontBelow++;
            if (validation.back_range_position === 'above') backAbove++;
            if (validation.back_range_position === 'below') backBelow++;

            processedCount++;

            // 6. 保存结果
            const resultDoc = {
                result_id: `${taskId}-${targetPeriod}`,
                task_id: taskId,
                period: targetPeriod,
                training_info: {
                    start_issue: trainingData[0]?.Issue,
                    end_issue: trainingData[trainingData.length - 1]?.Issue,
                    count: trainingData.length,
                    front_sum_set: task.front_strategy.method === 'history_set' ? prediction.front.sum_set : undefined,
                    back_sum_set: task.back_strategy.method === 'history_set' ? prediction.back.sum_set : undefined
                },
                prediction: {
                    front_sum: {
                        recommended: prediction.front.recommended,
                        range_min: prediction.front.range_min,
                        range_max: prediction.front.range_max,
                        ma_value: prediction.front.ma_value,
                        confidence: prediction.front.confidence,
                        tech_adjustment: prediction.front.tech_adjustment,
                        tech_signals: prediction.front.tech_signals,
                        // 历史和值集专用字段
                        sum_set: prediction.front.sum_set,
                        set_count: prediction.front.set_count,
                        set_min: prediction.front.set_min,
                        set_max: prediction.front.set_max,
                        range_expand: prediction.front.range_expand
                    },
                    back_sum: {
                        recommended: prediction.back.recommended,
                        range_min: prediction.back.range_min,
                        range_max: prediction.back.range_max,
                        ma_value: prediction.back.ma_value,
                        confidence: prediction.back.confidence,
                        tech_adjustment: prediction.back.tech_adjustment,
                        tech_signals: prediction.back.tech_signals,
                        // 历史和值集专用字段
                        sum_set: prediction.back.sum_set,
                        set_count: prediction.back.set_count,
                        set_min: prediction.back.set_min,
                        set_max: prediction.back.set_max,
                        range_expand: prediction.back.range_expand
                    }
                },
                actual,
                validation
            };

            // 使用upsert避免重复
            await SumPredictionResult.findOneAndUpdate(
                { result_id: resultDoc.result_id },
                resultDoc,
                { upsert: true, new: true }
            );

            // 7. 更新进度
            task.period_range.processed_periods = processedCount;

            // 每10期保存一次进度
            if (processedCount % 10 === 0) {
                await task.save();
            }

            // 8. 发送进度事件
            if (io && processedCount % 5 === 0) {
                io.emit('sum-task-progress', {
                    task_id: taskId,
                    current: processedCount,
                    total: periods.length,
                    percent: Math.round(processedCount / periods.length * 100),
                    current_period: targetPeriod
                });
            }
        }

        // 更新汇总统计
        const totalPeriods = processedCount;
        task.summary_stats = {
            front_hit_count: frontHits,
            back_hit_count: backHits,
            both_hit_count: bothHits,
            front_hit_rate: totalPeriods > 0 ? Math.round(frontHits / totalPeriods * 1000) / 10 : 0,
            back_hit_rate: totalPeriods > 0 ? Math.round(backHits / totalPeriods * 1000) / 10 : 0,
            both_hit_rate: totalPeriods > 0 ? Math.round(bothHits / totalPeriods * 1000) / 10 : 0,
            avg_front_diff: frontDiffCount > 0 ? Math.round(frontDiffSum / frontDiffCount * 10) / 10 : 0,
            avg_back_diff: backDiffCount > 0 ? Math.round(backDiffSum / backDiffCount * 10) / 10 : 0,
            front_above_count: frontAbove,
            front_below_count: frontBelow,
            back_above_count: backAbove,
            back_below_count: backBelow
        };

        task.period_range.processed_periods = processedCount;
        task.status = 'completed';
        task.execution_stats.end_time = new Date();
        task.execution_stats.duration_ms = task.execution_stats.end_time - task.execution_stats.start_time;
        task.updated_at = new Date();
        await task.save();

        log(`✅ 和值预测任务完成: ${taskId}, 处理${processedCount}期, 前区命中${frontHits}(${task.summary_stats.front_hit_rate}%), 后区命中${backHits}(${task.summary_stats.back_hit_rate}%)`);

        // 发送完成事件
        if (io) {
            io.emit('sum-task-completed', {
                task_id: taskId,
                summary_stats: task.summary_stats
            });
        }

    } catch (error) {
        log(`❌ 和值预测任务失败: ${taskId}, 错误: ${error.message}`);

        task.status = 'failed';
        task.execution_stats.end_time = new Date();
        task.updated_at = new Date();
        await task.save();

        // 发送错误事件
        if (io) {
            io.emit('sum-task-error', {
                task_id: taskId,
                error: error.message
            });
        }

        throw error;
    }
}

/**
 * 执行自动寻优
 * @param {Object} config - 寻优配置
 * @param {Object} hit_dlts - 大乐透数据模型
 * @param {Object} io - Socket.IO实例
 * @returns {Promise<Array>} 寻优结果
 */
async function runAutoOptimization(config, hit_dlts, io) {
    const {
        period_range,
        optimize_target,
        parameter_ranges,
        top_n
    } = config;

    // 解析期号范围
    const periods = await resolvePeriodRange(period_range, hit_dlts);
    const trainingWindow = parameter_ranges.training_windows?.[0] || 30;

    // 生成所有参数组合
    const combinations = [];
    const methods = parameter_ranges.methods || ['ma', 'weighted_ma', 'regression', 'history_set'];
    const maPeriods = parameter_ranges.ma_periods || [10, 15, 20, 30];
    const rangeExpands = parameter_ranges.range_expands || [8, 10, 12, 15];
    const windows = parameter_ranges.training_windows || [30];

    for (const method of methods) {
        if (method === 'history_set') {
            // history_set不需要ma_period
            for (const expand of [0, 3, 5]) {
                for (const window of windows) {
                    combinations.push({
                        method,
                        ma_period: null,
                        range_expand: expand,
                        training_window: window
                    });
                }
            }
        } else {
            for (const maPeriod of maPeriods) {
                for (const rangeExpand of rangeExpands) {
                    for (const window of windows) {
                        combinations.push({
                            method,
                            ma_period: maPeriod,
                            range_expand: rangeExpand,
                            training_window: window
                        });
                    }
                }
            }
        }
    }

    log(`🔍 开始自动寻优，共${combinations.length}种参数组合，验证${periods.length}期`);

    const results = [];
    let processedCombinations = 0;

    // 对每种参数组合进行验证
    for (const combo of combinations) {
        let frontHits = 0, backHits = 0, bothHits = 0;
        let processedCount = 0;

        // 构建策略配置
        const strategy = {
            method: combo.method,
            ma_period: combo.ma_period || 20,
            range_expand: combo.range_expand,
            history_set: combo.method === 'history_set' ? {
                match_mode: 'range',
                range_expand: combo.range_expand
            } : undefined
        };

        // 对每期进行预测和验证
        for (const targetPeriod of periods) {
            const trainingData = await getTrainingData(targetPeriod, combo.training_window, hit_dlts);

            if (trainingData.length < Math.min(combo.training_window, 10)) {
                continue;
            }

            // 计算预测 (前后区使用相同策略进行寻优)
            const prediction = calculateSumPrediction(
                trainingData,
                strategy,
                strategy,
                { enabled: false }
            );

            // 获取实际数据
            const actualData = await hit_dlts.findOne({ Issue: targetPeriod }).lean();
            if (!actualData) continue;

            const actual = {
                front_sum: actualData.Red1 + actualData.Red2 + actualData.Red3 + actualData.Red4 + actualData.Red5,
                back_sum: actualData.Blue1 + actualData.Blue2
            };

            // 验证
            const validation = validatePrediction(
                prediction,
                actual,
                strategy.method,
                strategy.history_set,
                strategy.method,
                strategy.history_set
            );

            if (validation.front_hit) frontHits++;
            if (validation.back_hit) backHits++;
            if (validation.both_hit) bothHits++;
            processedCount++;
        }

        // 计算命中率
        const frontHitRate = processedCount > 0 ? Math.round(frontHits / processedCount * 1000) / 10 : 0;
        const backHitRate = processedCount > 0 ? Math.round(backHits / processedCount * 1000) / 10 : 0;
        const bothHitRate = processedCount > 0 ? Math.round(bothHits / processedCount * 1000) / 10 : 0;

        results.push({
            method: combo.method,
            ma_period: combo.ma_period,
            range_expand: combo.range_expand,
            training_window: combo.training_window,
            front_hit_rate: frontHitRate,
            back_hit_rate: backHitRate,
            both_hit_rate: bothHitRate,
            front_hits: frontHits,
            back_hits: backHits,
            both_hits: bothHits,
            total_periods: processedCount
        });

        processedCombinations++;

        // 发送进度
        if (io && processedCombinations % 10 === 0) {
            io.emit('sum-optimize-progress', {
                current: processedCombinations,
                total: combinations.length,
                percent: Math.round(processedCombinations / combinations.length * 100)
            });
        }
    }

    // 按目标排序
    let sortKey = 'front_hit_rate';
    if (optimize_target === 'back_hit_rate') sortKey = 'back_hit_rate';
    if (optimize_target === 'both_hit_rate') sortKey = 'both_hit_rate';

    results.sort((a, b) => b[sortKey] - a[sortKey]);

    // 返回Top N
    const topResults = results.slice(0, top_n || 10);

    log(`✅ 自动寻优完成，最优配置: ${topResults[0]?.method} ${topResults[0]?.ma_period || '-'}期 ±${topResults[0]?.range_expand}, 命中率${topResults[0]?.[sortKey]}%`);

    return topResults;
}

/**
 * 注册和值预测API路由
 * @param {Object} app - Express应用实例
 * @param {Object} hit_dlts - 大乐透数据模型
 * @param {Object} io - Socket.IO实例
 */
function registerSumPredictionRoutes(app, hit_dlts, io) {

    // ========== 创建任务 ==========
    app.post('/api/dlt/sum-prediction-tasks/create', async (req, res) => {
        try {
            const {
                task_name,
                period_range,
                training_window,
                front_strategy,
                back_strategy,
                technical_analysis
            } = req.body;

            // 验证必填参数
            if (!task_name) {
                return res.status(400).json({ success: false, message: '任务名称不能为空' });
            }

            if (!period_range || !period_range.type) {
                return res.status(400).json({ success: false, message: '期号范围配置不能为空' });
            }

            // 生成任务ID
            const taskId = await generateTaskId();

            // 解析期号范围获取总期数
            const periods = await resolvePeriodRange(period_range, hit_dlts);

            // 创建任务
            const task = new SumPredictionTask({
                task_id: taskId,
                task_name,
                period_range: {
                    type: period_range.type,
                    recent_count: period_range.recent_count,
                    start_issue: period_range.start_issue,
                    end_issue: period_range.end_issue,
                    total_periods: periods.length,
                    processed_periods: 0
                },
                training_window: training_window || 30,
                front_strategy: {
                    method: front_strategy?.method || 'ma',
                    ma_period: front_strategy?.ma_period || 20,
                    range_expand: front_strategy?.range_expand || 10,
                    fixed_range: front_strategy?.fixed_range,
                    history_set: front_strategy?.history_set || { match_mode: 'range', range_expand: 0 }
                },
                back_strategy: {
                    method: back_strategy?.method || 'ma',
                    ma_period: back_strategy?.ma_period || 10,
                    range_expand: back_strategy?.range_expand || 3,
                    fixed_range: back_strategy?.fixed_range,
                    history_set: back_strategy?.history_set || { match_mode: 'range', range_expand: 0 }
                },
                technical_analysis: {
                    enabled: technical_analysis?.enabled || false,
                    rsi: technical_analysis?.rsi || { enabled: false, period: 14, overbought: 70, oversold: 30 },
                    macd: technical_analysis?.macd || { enabled: false, fast_period: 12, slow_period: 26, signal_period: 9 },
                    bollinger: technical_analysis?.bollinger || { enabled: false, period: 20, std_dev: 2 }
                },
                status: 'pending'
            });

            await task.save();

            log(`📝 和值预测任务已创建: ${taskId}, 名称: ${task_name}, 期数: ${periods.length}`);

            // 异步执行任务
            setImmediate(() => {
                processSumPredictionTask(taskId, hit_dlts, io).catch(err => {
                    log(`❌ 任务执行异常: ${taskId}, ${err.message}`);
                });
            });

            res.json({
                success: true,
                data: {
                    task_id: taskId,
                    task_name,
                    status: 'processing',
                    period_range: {
                        total_periods: periods.length,
                        start_issue: periods[0],
                        end_issue: periods[periods.length - 1]
                    }
                }
            });

        } catch (error) {
            log(`❌ 创建和值预测任务失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 查询任务列表 ==========
    app.get('/api/dlt/sum-prediction-tasks/list', async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                status
            } = req.query;

            const query = {};
            if (status && status !== 'all') {
                query.status = status;
            }

            const total = await SumPredictionTask.countDocuments(query);
            const tasks = await SumPredictionTask.find(query)
                .sort({ created_at: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean();

            res.json({
                success: true,
                data: {
                    tasks,
                    pagination: {
                        current: parseInt(page),
                        pageSize: parseInt(limit),
                        total
                    }
                }
            });

        } catch (error) {
            log(`❌ 查询任务列表失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 查询任务详情 ==========
    app.get('/api/dlt/sum-prediction-tasks/:taskId', async (req, res) => {
        try {
            const { taskId } = req.params;

            const task = await SumPredictionTask.findOne({ task_id: taskId }).lean();

            if (!task) {
                return res.status(404).json({ success: false, message: '任务不存在' });
            }

            res.json({
                success: true,
                data: task
            });

        } catch (error) {
            log(`❌ 查询任务详情失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 查询任务结果列表 ==========
    app.get('/api/dlt/sum-prediction-tasks/:taskId/results', async (req, res) => {
        try {
            const { taskId } = req.params;
            const {
                page = 1,
                limit = 20,
                hit_filter // 'all', 'front_hit', 'back_hit', 'both_hit', 'none'
            } = req.query;

            const query = { task_id: taskId };

            // 命中过滤
            if (hit_filter && hit_filter !== 'all') {
                switch (hit_filter) {
                    case 'front_hit':
                        query['validation.front_hit'] = true;
                        break;
                    case 'back_hit':
                        query['validation.back_hit'] = true;
                        break;
                    case 'both_hit':
                        query['validation.both_hit'] = true;
                        break;
                    case 'none':
                        query['validation.front_hit'] = false;
                        query['validation.back_hit'] = false;
                        break;
                }
            }

            const total = await SumPredictionResult.countDocuments(query);
            const results = await SumPredictionResult.find(query)
                .sort({ period: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean();

            res.json({
                success: true,
                data: {
                    results,
                    pagination: {
                        current: parseInt(page),
                        pageSize: parseInt(limit),
                        total
                    }
                }
            });

        } catch (error) {
            log(`❌ 查询任务结果失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 查询任务统计 ==========
    app.get('/api/dlt/sum-prediction-tasks/:taskId/statistics', async (req, res) => {
        try {
            const { taskId } = req.params;

            const task = await SumPredictionTask.findOne({ task_id: taskId }).lean();

            if (!task) {
                return res.status(404).json({ success: false, message: '任务不存在' });
            }

            // 获取命中分布
            const hitDistribution = await SumPredictionResult.aggregate([
                { $match: { task_id: taskId } },
                {
                    $group: {
                        _id: {
                            front_hit: '$validation.front_hit',
                            back_hit: '$validation.back_hit'
                        },
                        count: { $sum: 1 }
                    }
                }
            ]);

            // 获取偏差分布
            const diffDistribution = await SumPredictionResult.aggregate([
                { $match: { task_id: taskId, 'validation.front_diff': { $ne: null } } },
                {
                    $bucket: {
                        groupBy: '$validation.front_diff',
                        boundaries: [0, 5, 10, 15, 20, 30, 50, 100],
                        default: '100+',
                        output: { count: { $sum: 1 } }
                    }
                }
            ]);

            res.json({
                success: true,
                data: {
                    summary: task.summary_stats,
                    hit_distribution: hitDistribution,
                    diff_distribution: diffDistribution
                }
            });

        } catch (error) {
            log(`❌ 查询任务统计失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 自动寻优 ==========
    app.post('/api/dlt/sum-prediction-tasks/auto-optimize', async (req, res) => {
        try {
            const {
                period_range,
                optimize_target,
                parameter_ranges,
                top_n
            } = req.body;

            if (!period_range) {
                return res.status(400).json({ success: false, message: '期号范围配置不能为空' });
            }

            // 发送开始事件
            if (io) {
                io.emit('sum-optimize-started', { optimize_target });
            }

            const results = await runAutoOptimization({
                period_range,
                optimize_target: optimize_target || 'front_hit_rate',
                parameter_ranges: parameter_ranges || {},
                top_n: top_n || 10
            }, hit_dlts, io);

            // 发送完成事件
            if (io) {
                io.emit('sum-optimize-completed', { results });
            }

            res.json({
                success: true,
                data: {
                    optimize_target,
                    results
                }
            });

        } catch (error) {
            log(`❌ 自动寻优失败: ${error.message}`);

            if (io) {
                io.emit('sum-optimize-error', { error: error.message });
            }

            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 导出Excel ==========
    app.get('/api/dlt/sum-prediction-tasks/:taskId/export', async (req, res) => {
        try {
            const { taskId } = req.params;

            const task = await SumPredictionTask.findOne({ task_id: taskId }).lean();
            if (!task) {
                return res.status(404).json({ success: false, message: '任务不存在' });
            }

            const results = await SumPredictionResult.find({ task_id: taskId })
                .sort({ period: 1 })
                .lean();

            // 创建工作簿
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'HIT数据分析系统';
            workbook.created = new Date();

            // Sheet 1: 任务概览
            const overviewSheet = workbook.addWorksheet('任务概览');
            overviewSheet.columns = [
                { header: '项目', key: 'item', width: 20 },
                { header: '值', key: 'value', width: 40 }
            ];

            overviewSheet.addRows([
                { item: '任务ID', value: task.task_id },
                { item: '任务名称', value: task.task_name },
                { item: '期号范围类型', value: task.period_range.type },
                { item: '总期数', value: task.period_range.total_periods },
                { item: '已处理期数', value: task.period_range.processed_periods },
                { item: '训练窗口', value: `${task.training_window}期` },
                { item: '前区预测方法', value: task.front_strategy.method },
                { item: '前区MA周期', value: task.front_strategy.ma_period || '-' },
                { item: '前区范围扩展', value: `±${task.front_strategy.range_expand}` },
                { item: '后区预测方法', value: task.back_strategy.method },
                { item: '后区MA周期', value: task.back_strategy.ma_period || '-' },
                { item: '后区范围扩展', value: `±${task.back_strategy.range_expand}` },
                { item: '技术分析增强', value: task.technical_analysis?.enabled ? '启用' : '关闭' },
                { item: '前区命中率', value: `${task.summary_stats?.front_hit_rate || 0}% (${task.summary_stats?.front_hit_count || 0}/${task.period_range.processed_periods})` },
                { item: '后区命中率', value: `${task.summary_stats?.back_hit_rate || 0}% (${task.summary_stats?.back_hit_count || 0}/${task.period_range.processed_periods})` },
                { item: '双区命中率', value: `${task.summary_stats?.both_hit_rate || 0}% (${task.summary_stats?.both_hit_count || 0}/${task.period_range.processed_periods})` },
                { item: '前区平均偏差', value: task.summary_stats?.avg_front_diff || '-' },
                { item: '后区平均偏差', value: task.summary_stats?.avg_back_diff || '-' },
                { item: '任务创建时间', value: task.created_at },
                { item: '执行耗时', value: task.execution_stats?.duration_ms ? `${task.execution_stats.duration_ms}ms` : '-' }
            ]);

            // 设置标题行样式
            overviewSheet.getRow(1).font = { bold: true };
            overviewSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Sheet 2: 详细结果
            const detailSheet = workbook.addWorksheet('详细结果');
            detailSheet.columns = [
                { header: '期号', key: 'period', width: 10 },
                { header: '训练起始', key: 'train_start', width: 10 },
                { header: '训练结束', key: 'train_end', width: 10 },
                { header: '前区预测范围', key: 'front_range', width: 50 },
                { header: '前区推荐值', key: 'front_rec', width: 12 },
                { header: '前区实际', key: 'front_actual', width: 10 },
                { header: '前区偏差', key: 'front_diff', width: 10 },
                { header: '前区命中', key: 'front_hit', width: 10 },
                { header: '后区预测范围', key: 'back_range', width: 30 },
                { header: '后区推荐值', key: 'back_rec', width: 12 },
                { header: '后区实际', key: 'back_actual', width: 10 },
                { header: '后区偏差', key: 'back_diff', width: 10 },
                { header: '后区命中', key: 'back_hit', width: 10 }
            ];

            for (const result of results) {
                detailSheet.addRow({
                    period: result.period,
                    train_start: result.training_info?.start_issue || '-',
                    train_end: result.training_info?.end_issue || '-',
                    front_range: formatPredRange(result.prediction?.front_sum),
                    front_rec: result.prediction?.front_sum?.recommended || '-',
                    front_actual: result.actual?.front_sum,
                    front_diff: result.validation?.front_diff ?? '-',
                    front_hit: result.validation?.front_hit ? '✓' : '✗',
                    back_range: formatPredRange(result.prediction?.back_sum),
                    back_rec: result.prediction?.back_sum?.recommended || '-',
                    back_actual: result.actual?.back_sum,
                    back_diff: result.validation?.back_diff ?? '-',
                    back_hit: result.validation?.back_hit ? '✓' : '✗'
                });
            }

            // 设置标题行样式
            detailSheet.getRow(1).font = { bold: true };
            detailSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // 命中列条件格式
            for (let i = 2; i <= results.length + 1; i++) {
                const frontHitCell = detailSheet.getCell(`H${i}`);
                const backHitCell = detailSheet.getCell(`M${i}`);

                if (frontHitCell.value === '✓') {
                    frontHitCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
                } else {
                    frontHitCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCB' } };
                }

                if (backHitCell.value === '✓') {
                    backHitCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
                } else {
                    backHitCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCB' } };
                }
            }

            // 设置响应头
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sum-prediction-${taskId}.xlsx`);

            // 写入响应
            await workbook.xlsx.write(res);
            res.end();

            log(`📥 导出和值预测报表: ${taskId}`);

        } catch (error) {
            log(`❌ 导出Excel失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 删除任务 ==========
    app.delete('/api/dlt/sum-prediction-tasks/:taskId', async (req, res) => {
        try {
            const { taskId } = req.params;

            // 删除任务
            const task = await SumPredictionTask.findOneAndDelete({ task_id: taskId });

            if (!task) {
                return res.status(404).json({ success: false, message: '任务不存在' });
            }

            // 删除关联的结果
            const deletedResults = await SumPredictionResult.deleteMany({ task_id: taskId });

            log(`🗑️ 删除和值预测任务: ${taskId}, 关联结果${deletedResults.deletedCount}条`);

            res.json({
                success: true,
                data: {
                    task_id: taskId,
                    deleted_results: deletedResults.deletedCount
                }
            });

        } catch (error) {
            log(`❌ 删除任务失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========== 批量删除任务 ==========
    app.post('/api/dlt/sum-prediction-tasks/batch-delete', async (req, res) => {
        try {
            const { task_ids } = req.body;

            if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
                return res.status(400).json({ success: false, message: '任务ID列表不能为空' });
            }

            // 删除任务
            const deletedTasks = await SumPredictionTask.deleteMany({ task_id: { $in: task_ids } });

            // 删除关联的结果
            const deletedResults = await SumPredictionResult.deleteMany({ task_id: { $in: task_ids } });

            log(`🗑️ 批量删除和值预测任务: ${task_ids.length}个, 结果${deletedResults.deletedCount}条`);

            res.json({
                success: true,
                data: {
                    deleted_tasks: deletedTasks.deletedCount,
                    deleted_results: deletedResults.deletedCount
                }
            });

        } catch (error) {
            log(`❌ 批量删除失败: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    log('✅ 和值预测API路由已注册');
}

module.exports = {
    registerSumPredictionRoutes,
    processSumPredictionTask,
    runAutoOptimization,
    generateTaskId,
    resolvePeriodRange,
    getTrainingData
};
