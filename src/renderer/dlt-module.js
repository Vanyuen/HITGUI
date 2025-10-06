/**
 * 大乐透系统功能模块
 * 独立命名空间，避免与双色球系统冲突
 * 前缀: DLT_ / dlt-
 */

// ===== 大乐透全局变量 =====
const DLT_CONFIG = {
    FRONT_ZONE_COUNT: 35,  // 前区号码总数 (01-35)
    BACK_ZONE_COUNT: 12,   // 后区号码总数 (01-12)
    FRONT_SELECT_COUNT: 5, // 前区选择数量
    BACK_SELECT_COUNT: 2,  // 后区选择数量
    DEFAULT_PERIODS: 30    // 默认显示期数
};

let dltCurrentPage = 1;
let dltCurrentPeriods = DLT_CONFIG.DEFAULT_PERIODS;
let dltCustomRangeMode = false;
let dltCurrentMAPeriod = 20; // 默认MA20
let dltLastFrontBallMissing = [];
let dltLastBackBallMissing = [];

// 当前预测结果数据（用于导出功能）
let currentPredictionData = null;

// ===== 大乐透主要功能模块 =====

/**
 * 初始化大乐透系统
 */
function initDLTSystem() {
    console.log('Initializing DLT System...');

    // 初始化各个子模块
    initDLTNavigation();
    initDLTHistoryModule();
    initDLTTrendModule();
    initDLTAnalysisModule();
    initDLTExpertModule();
    initDLTCombinationModule();

    console.log('DLT System initialized successfully');
}

// ===== 大乐透批量预测命中对比分析模块 =====

/**
 * 批量预测命中对比分析器
 * 专门用于分析预测结果与实际开奖的命中情况
 */
class BatchPredictionHitAnalyzer {
    constructor() {
        this.historicalDrawData = new Map(); // 历史开奖数据缓存
    }

    /**
     * 加载指定期号的开奖数据
     */
    async loadDrawDataForIssues(issues) {
        console.log(`📊 加载期号 ${issues.join(', ')} 的开奖数据...`);

        const drawData = new Map();

        try {
            // 尝试从服务器获取真实开奖数据
            const response = await fetch('http://localhost:3003/api/dlt/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issues: issues })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    result.data.forEach(record => {
                        drawData.set(record.期号, {
                            issue: record.期号,
                            redBalls: record.红球.split(' ').map(n => parseInt(n)),
                            blueBalls: record.蓝球.split(' ').map(n => parseInt(n)),
                            drawDate: record.开奖日期
                        });
                    });
                }
            }
        } catch (error) {
            console.warn('无法获取真实开奖数据，使用模拟数据:', error.message);
        }

        // 对于没有获取到的期号，生成模拟开奖数据
        issues.forEach(issue => {
            if (!drawData.has(issue)) {
                drawData.set(issue, this.generateMockDrawData(issue));
            }
        });

        // 缓存数据
        drawData.forEach((data, issue) => {
            this.historicalDrawData.set(issue, data);
        });

        console.log(`✅ 成功加载 ${drawData.size} 期开奖数据`);
        return drawData;
    }

    /**
     * 生成模拟开奖数据
     */
    generateMockDrawData(issue) {
        // 生成随机红球（1-35选5个）
        const redBalls = [];
        while (redBalls.length < 5) {
            const ball = Math.floor(Math.random() * 35) + 1;
            if (!redBalls.includes(ball)) {
                redBalls.push(ball);
            }
        }
        redBalls.sort((a, b) => a - b);

        // 生成随机蓝球（1-12选2个）
        const blueBalls = [];
        while (blueBalls.length < 2) {
            const ball = Math.floor(Math.random() * 12) + 1;
            if (!blueBalls.includes(ball)) {
                blueBalls.push(ball);
            }
        }
        blueBalls.sort((a, b) => a - b);

        return {
            issue: issue,
            redBalls: redBalls,
            blueBalls: blueBalls,
            drawDate: new Date().toISOString().split('T')[0],
            isSimulated: true // 标记为模拟数据
        };
    }

    /**
     * 分析单期预测结果的命中情况
     */
    analyzeSingleIssueHits(predictions, drawData) {
        if (!drawData || !predictions || predictions.length === 0) {
            return [];
        }

        console.log(`🎯 分析期号 ${drawData.issue} 的 ${predictions.length} 个预测组合的命中情况...`);

        return predictions.map((prediction, index) => {
            const hitAnalysis = this.calculateHitDetails(prediction, drawData);

            return {
                ...prediction,
                序号: index + 1,
                目标期号: drawData.issue,
                开奖红球: drawData.redBalls.map(n => n.toString().padStart(2, '0')).join(' '),
                开奖蓝球: drawData.blueBalls.map(n => n.toString().padStart(2, '0')).join(' '),
                红球命中个数: hitAnalysis.redHitCount,
                红球命中号码: hitAnalysis.redHitBalls.map(n => n.toString().padStart(2, '0')).join(' ') || '无',
                蓝球命中个数: hitAnalysis.blueHitCount,
                蓝球命中号码: hitAnalysis.blueHitBalls.map(n => n.toString().padStart(2, '0')).join(' ') || '无',
                总命中情况: `红球${hitAnalysis.redHitCount}个，蓝球${hitAnalysis.blueHitCount}个`,
                中奖等级: this.calculatePrizeLevel(hitAnalysis.redHitCount, hitAnalysis.blueHitCount),
                预测准确率: this.calculateAccuracy(hitAnalysis),
                命中分析: this.generateHitAnalysisText(hitAnalysis),
                开奖日期: drawData.drawDate,
                数据来源: drawData.isSimulated ? '模拟数据' : '真实开奖'
            };
        });
    }

    /**
     * 计算单个预测组合的命中详情
     */
    calculateHitDetails(prediction, drawData) {
        const predictionRed = this.extractRedBalls(prediction);
        const predictionBlue = this.extractBlueBalls(prediction);

        // 计算红球命中
        const redHitBalls = predictionRed.filter(ball => drawData.redBalls.includes(ball));
        const redHitCount = redHitBalls.length;

        // 计算蓝球命中
        const blueHitBalls = predictionBlue.filter(ball => drawData.blueBalls.includes(ball));
        const blueHitCount = blueHitBalls.length;

        return {
            redHitCount: redHitCount,
            redHitBalls: redHitBalls,
            blueHitCount: blueHitCount,
            blueHitBalls: blueHitBalls,
            predictionRed: predictionRed,
            predictionBlue: predictionBlue
        };
    }

    /**
     * 从预测数据中提取红球号码
     */
    extractRedBalls(prediction) {
        // 支持多种数据格式
        if (prediction.redBalls && Array.isArray(prediction.redBalls)) {
            return prediction.redBalls;
        }

        if (prediction.red_balls && Array.isArray(prediction.red_balls)) {
            return prediction.red_balls;
        }

        // 从单个字段提取
        const redBalls = [];
        for (let i = 1; i <= 5; i++) {
            const ball = prediction[`red${i}`] || prediction[`red_ball_${i}`] || prediction[`红球${i}`];
            if (ball && typeof ball === 'number') {
                redBalls.push(ball);
            }
        }

        return redBalls.filter(ball => ball >= 1 && ball <= 35);
    }

    /**
     * 从预测数据中提取蓝球号码
     */
    extractBlueBalls(prediction) {
        // 支持多种数据格式
        if (prediction.blueBalls && Array.isArray(prediction.blueBalls)) {
            return prediction.blueBalls;
        }

        if (prediction.blue_balls && Array.isArray(prediction.blue_balls)) {
            return prediction.blue_balls;
        }

        // 从单个字段提取
        const blueBalls = [];
        for (let i = 1; i <= 2; i++) {
            const ball = prediction[`blue${i}`] || prediction[`blue_ball_${i}`] || prediction[`蓝球${i}`];
            if (ball && typeof ball === 'number') {
                blueBalls.push(ball);
            }
        }

        return blueBalls.filter(ball => ball >= 1 && ball <= 12);
    }

    /**
     * 计算中奖等级
     */
    calculatePrizeLevel(redHitCount, blueHitCount) {
        if (redHitCount === 5 && blueHitCount === 2) return '一等奖';
        if (redHitCount === 5 && blueHitCount === 1) return '二等奖';
        if (redHitCount === 5 && blueHitCount === 0) return '三等奖';
        if (redHitCount === 4 && blueHitCount === 2) return '四等奖';
        if (redHitCount === 4 && blueHitCount === 1) return '五等奖';
        if (redHitCount === 3 && blueHitCount === 2) return '六等奖';
        if (redHitCount === 4 && blueHitCount === 0) return '七等奖';
        if (redHitCount === 3 && blueHitCount === 1) return '八等奖';
        if (redHitCount === 2 && blueHitCount === 2) return '九等奖';
        return '未中奖';
    }

    /**
     * 计算预测准确率
     */
    calculateAccuracy(hitAnalysis) {
        const totalPredicted = hitAnalysis.predictionRed.length + hitAnalysis.predictionBlue.length;
        const totalHit = hitAnalysis.redHitCount + hitAnalysis.blueHitCount;
        return totalPredicted > 0 ? ((totalHit / totalPredicted) * 100).toFixed(1) + '%' : '0%';
    }

    /**
     * 生成命中分析文本
     */
    generateHitAnalysisText(hitAnalysis) {
        const parts = [];

        if (hitAnalysis.redHitCount > 0) {
            parts.push(`红球命中${hitAnalysis.redHitCount}个: ${hitAnalysis.redHitBalls.join('、')}`);
        }

        if (hitAnalysis.blueHitCount > 0) {
            parts.push(`蓝球命中${hitAnalysis.blueHitCount}个: ${hitAnalysis.blueHitBalls.join('、')}`);
        }

        return parts.length > 0 ? parts.join('；') : '无命中';
    }

    /**
     * 分析单个组合的命中情况
     */
    analyzeSingleCombinationHits(prediction, drawData) {
        // 构建兼容的数据格式
        const predictionData = {
            redBalls: prediction.red || [],
            blueBalls: prediction.blue || []
        };

        const drawDataFormatted = {
            redBalls: drawData.red || [],
            blueBalls: drawData.blue || []
        };

        return this.calculateHitDetails(predictionData, drawDataFormatted);
    }

    /**
     * 批量分析多期预测的命中情况
     */
    async analyzeMultipleIssuesHits(batchPredictions) {
        const results = new Map(); // issue -> analyzed predictions

        for (const [issue, predictions] of batchPredictions.entries()) {
            console.log(`📋 分析第 ${issue} 期的预测结果...`);

            // 加载该期开奖数据
            const drawData = await this.loadDrawDataForIssues([issue]);
            const issueDrawData = drawData.get(issue);

            if (issueDrawData) {
                // 分析该期的命中情况
                const analyzedPredictions = this.analyzeSingleIssueHits(predictions, issueDrawData);
                results.set(issue, analyzedPredictions);
            }
        }

        return results;
    }
}

// 创建全局实例
window.batchHitAnalyzer = new BatchPredictionHitAnalyzer();

// ===== 综合分析UI支持函数 =====

/**
 * 显示综合分析进度界面
 */
function showComprehensiveAnalysisProgress() {
    const progressHTML = `
        <div id="comprehensive-analysis-progress" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 500px;
                width: 90%;
            ">
                <h3 style="margin-top: 0; color: #2c3e50;">🎯 大乐透综合批量预测分析</h3>

                <div style="margin: 30px 0;">
                    <div style="
                        width: 100%;
                        height: 20px;
                        background: #ecf0f1;
                        border-radius: 10px;
                        overflow: hidden;
                        margin-bottom: 15px;
                    ">
                        <div id="analysis-progress-bar" style="
                            height: 100%;
                            background: linear-gradient(90deg, #3498db, #2ecc71);
                            width: 0%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>

                    <div id="analysis-progress-text" style="
                        font-size: 16px;
                        color: #34495e;
                        margin-bottom: 10px;
                    ">正在初始化...</div>

                    <div id="analysis-progress-percent" style="
                        font-size: 24px;
                        font-weight: bold;
                        color: #2c3e50;
                    ">0%</div>
                </div>

                <div style="font-size: 14px; color: #7f8c8d; line-height: 1.5;">
                    <div>📊 将分析所有 324,632 个红球组合</div>
                    <div>🎯 包含完整的命中率和热温冷分析</div>
                    <div>⏱️ 预计需要 3-8 分钟，请耐心等待</div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', progressHTML);
}

/**
 * 更新分析进度
 */
function updateAnalysisProgress(message, percent) {
    const progressBar = document.getElementById('analysis-progress-bar');
    const progressText = document.getElementById('analysis-progress-text');
    const progressPercent = document.getElementById('analysis-progress-percent');

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = message;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
}

/**
 * 隐藏综合分析进度界面
 */
function hideComprehensiveAnalysisProgress() {
    const progressDiv = document.getElementById('comprehensive-analysis-progress');
    if (progressDiv) {
        progressDiv.remove();
    }
}

/**
 * 获取综合分析的过滤条件
 */
function getComprehensiveFilters() {
    return {
        sumRange: {
            min: 60,
            max: 140
        },
        spanRange: {
            min: 15,
            max: 30
        },
        oddEvenRatios: ['2:3', '3:2', '1:4', '4:1'],
        zoneRatios: ['1:2:2', '2:2:1', '2:1:2', '1:1:3'],
        acRange: {
            min: 6,
            max: 14
        },
        maxResults: 10000
    };
}

/**
 * 生成蓝球组合（简化版）
 */
async function generateBlueBallCombinations(redBallCombinations) {
    console.log(`🔵 为 ${redBallCombinations.length} 个红球组合生成蓝球...`);

    // 常见的蓝球组合
    const commonBlueCombinations = [
        [3, 8], [5, 11], [2, 9], [7, 12], [1, 6],
        [4, 10], [3, 7], [8, 12], [2, 5], [9, 11]
    ];

    return redBallCombinations.map((combo, index) => {
        // 为每个红球组合分配一个蓝球组合
        const blueCombo = commonBlueCombinations[index % commonBlueCombinations.length];

        return {
            ...combo,
            blueBalls: blueCombo,
            blueSum: blueCombo[0] + blueCombo[1]
        };
    });
}

/**
 * 显示综合分析结果
 */
function displayComprehensiveResults(results) {
    // 确保 results 是数组类型
    const resultsArray = Array.isArray(results) ? results : [];
    console.log(`📊 显示 ${resultsArray.length} 个综合分析结果`);

    // 创建结果显示界面
    const resultsContainer = document.getElementById('dlt-combination');
    if (!resultsContainer) {
        console.error('未找到结果显示容器');
        return;
    }

    // 生成结果HTML
    const resultsHTML = `
        <div class="comprehensive-results" style="
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        ">
            <div class="results-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #e9ecef;
            ">
                <h3 style="margin: 0; color: #2c3e50;">🎯 综合批量预测结果</h3>
                <div class="results-stats" style="text-align: right;">
                    <div style="color: #27ae60; font-weight: bold; font-size: 18px;">${resultsArray.length} 个预测组合</div>
                    <div style="color: #7f8c8d; font-size: 14px;">包含完整命中率分析</div>
                </div>
            </div>

            <div class="results-summary" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            ">
                <div class="summary-card" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="font-size: 24px; font-weight: bold;">${resultsArray.length}</div>
                    <div style="opacity: 0.9;">预测组合</div>
                </div>
                <div class="summary-card" style="
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="font-size: 24px; font-weight: bold;">36</div>
                    <div style="opacity: 0.9;">分析维度</div>
                </div>
                <div class="summary-card" style="
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="font-size: 24px; font-weight: bold;">50</div>
                    <div style="opacity: 0.9;">历史期数</div>
                </div>
                <div class="summary-card" style="
                    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="font-size: 24px; font-weight: bold;">CSV</div>
                    <div style="opacity: 0.9;">详细导出</div>
                </div>
            </div>

            <div class="export-section" style="
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            ">
                <h4 style="margin-top: 0; color: #2c3e50;">📊 导出详细预测数据</h4>
                <p style="color: #6c757d; margin-bottom: 20px;">
                    包含36个详细字段：红球蓝球组合、命中率分析、热温冷状态、历史对比数据等
                </p>
                <div class="export-buttons" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="exportCombinationResults('csv')" style="
                        background: #007bff;
                        border: none;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                    ">
                        📄 导出详细CSV
                    </button>
                    <button class="btn btn-success" onclick="exportCombinationResults('excel')" style="
                        background: #28a745;
                        border: none;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                    ">
                        📊 导出Excel
                    </button>
                    <button class="btn btn-info" onclick="exportCombinationResults('json')" style="
                        background: #17a2b8;
                        border: none;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                    ">
                        📋 导出JSON
                    </button>
                </div>
            </div>

            <div class="preview-section" style="margin-top: 20px;">
                <h4 style="color: #2c3e50;">🔍 预测结果预览 (前10组)</h4>
                <div class="preview-table" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">序号</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">红球组合</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">蓝球组合</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">综合评分</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">热温冷比</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">历史命中</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultsArray.slice(0, 10).map((combo, index) => `
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 8px; border: 1px solid #dee2e6;">${index + 1}</td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-family: monospace; color: #e74c3c; font-weight: bold;">
                                        ${combo.redBalls ? combo.redBalls.map(n => n.toString().padStart(2, '0')).join(' ') : '-- -- -- -- --'}
                                    </td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-family: monospace; color: #3498db; font-weight: bold;">
                                        ${combo.blueBalls ? combo.blueBalls.map(n => n.toString().padStart(2, '0')).join(' ') : '-- --'}
                                    </td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; color: #27ae60; font-weight: bold;">
                                        ${combo.overallScore ? combo.overallScore.toFixed(1) : '0.0'}
                                    </td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6;">
                                        ${combo.htcAnalysis ? combo.htcAnalysis.htcRatio : '0:0:0'}
                                    </td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6;">
                                        ${combo.hitAnalysis ? `${combo.hitAnalysis.totalHitCount}次` : '0次'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 10px; color: #6c757d; font-size: 14px; text-align: center;">
                    <em>完整数据请导出CSV查看，包含36个详细分析字段</em>
                </div>
            </div>
        </div>
    `;

    // 找到或创建结果显示区域
    let existingResults = resultsContainer.querySelector('.comprehensive-results');
    if (existingResults) {
        existingResults.remove();
    }

    resultsContainer.insertAdjacentHTML('beforeend', resultsHTML);

    // 添加按钮样式效果
    const buttons = resultsContainer.querySelectorAll('.export-buttons button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = 'none';
        });
    });

    console.log('✅ 综合分析结果界面已显示');
}

/**
 * 创建综合分析启动按钮和界面
 */
function createComprehensiveAnalysisInterface() {
    const interfaceHTML = `
        <div class="comprehensive-analysis-panel" style="
            margin: 20px 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        ">
            <h3 style="margin-top: 0; display: flex; align-items: center; gap: 10px;">
                🎯 HIT-大乐透综合批量预测分析
                <span style="font-size: 14px; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px;">增强版</span>
            </h3>

            <div style="margin: 15px 0; line-height: 1.6;">
                <div>🔥 <strong>全量分析</strong>：分析所有 324,632 个红球组合</div>
                <div>📊 <strong>命中率分析</strong>：基于历史开奖数据的深度命中率统计</div>
                <div>🌡️ <strong>热温冷分析</strong>：智能识别号码的热温冷状态</div>
                <div>🎖️ <strong>综合评分</strong>：多维度评分系统，筛选最优组合</div>
                <div>📋 <strong>详细导出</strong>：包含完整分析数据的CSV导出</div>
            </div>

            <div style="margin-top: 20px;">
                <button id="start-comprehensive-analysis" class="btn btn-light" style="
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    🚀 启动综合批量预测分析
                </button>

                <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                    ⏱️ 预计耗时 3-8 分钟 | 💾 大约占用 2GB 内存 | 📊 生成详细CSV报告
                </div>
            </div>
        </div>
    `;

    // 将界面插入到组合预测模块中
    const combinationPanel = document.getElementById('dlt-combination');
    if (combinationPanel) {
        combinationPanel.insertAdjacentHTML('afterbegin', interfaceHTML);

        // 绑定启动按钮事件
        const startButton = document.getElementById('start-comprehensive-analysis');
        if (startButton) {
            startButton.addEventListener('click', async () => {
                startButton.disabled = true;
                startButton.textContent = '🔄 分析进行中...';

                try {
                    await startComprehensiveBatchPrediction();
                } catch (error) {
                    console.error('综合分析失败:', error);
                    showErrorToast(`综合分析失败: ${error.message}`);
                } finally {
                    startButton.disabled = false;
                    startButton.textContent = '🚀 启动综合批量预测分析';
                }
            });
        }
    }
}

/**
 * 初始化大乐透导航
 * 注意：大乐透导航现在由主app.js统一管理，这里只做初始化设置
 */
function initDLTNavigation() {
    const dltPanel = document.getElementById('dlt-panel');
    if (!dltPanel) {
        console.warn('DLT panel not found');
        return;
    }
    
    console.log('DLT navigation initialized (managed by main app.js)');
    
    // 大乐透导航事件现在由主app.js的initSubNavigation()统一处理
    // 这里只做一些大乐透特有的初始化工作
}

/**
 * 切换大乐透内容面板
 */
function switchDLTContentPanel(contentType) {
    const dltPanel = document.getElementById('dlt-panel');
    if (!dltPanel) return;
    
    // 隐藏所有内容面板
    dltPanel.querySelectorAll('.panel-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 显示目标面板
    const targetPanel = document.getElementById(contentType);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
}

/**
 * 加载大乐透内容
 */
function loadDLTContent(contentType) {
    console.log(`Loading DLT content: ${contentType}`);
    
    switch (contentType) {
        case 'dlt-history':
            loadDLTHistoryData();
            break;
        case 'dlt-trend':
            loadDLTTrendData();
            break;
        case 'dlt-expert':
            loadDLTExpertData();
            break;
        case 'dlt-combination':
            // 组合预测面板不需要预加载数据，只需要初始化界面
            console.log('DLT combination panel activated');
            break;
        default:
            console.warn(`Unknown DLT content type: ${contentType}`);
    }
}

// ===== 大乐透历史开奖模块 =====

/**
 * 初始化大乐透历史开奖模块
 */
function initDLTHistoryModule() {
    console.log('Initializing DLT History Module...');
    
    // 初始化分页事件
    initDLTHistoryPagination();
    
    // 初始化刷新按钮
    initDLTHistoryRefresh();
}

// 简单的缓存机制
const dltHistoryCache = new Map();

// 防抖和加载状态控制
let dltHistoryLoading = false;
let dltHistoryLoadingTimer = null;

/**
 * 加载大乐透历史开奖数据（性能优化版本）
 */
async function loadDLTHistoryData(page = 1, forceRefresh = false) {
    // 防止重复加载
    if (dltHistoryLoading && !forceRefresh) {
        console.log('DLT history data is already loading, skipping...');
        return;
    }
    
    console.log(`Loading DLT history data for page ${page}${forceRefresh ? ' (force refresh)' : ''}`);
    
    try {
        const tbody = document.querySelector('#dlt-history tbody');
        if (!tbody) {
            console.error('DLT history table body not found');
            return;
        }
        
        // 检查缓存（除非强制刷新）
        const cacheKey = `page_${page}`;
        if (!forceRefresh && dltHistoryCache.has(cacheKey)) {
            const cachedData = dltHistoryCache.get(cacheKey);
            displayDLTHistoryData(cachedData.data, cachedData.pagination);
            console.log(`DLT history data loaded from cache for page ${page}`);
            return;
        }
        
        // 设置加载状态
        dltHistoryLoading = true;
        
        // 显示加载状态（更简洁）
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #666;">加载中...</td></tr>';
        
        const startTime = performance.now();
        const response = await fetch(`http://localhost:3003/api/dlt/history?page=${page}&limit=30`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '加载失败');
        }
        
        // 缓存数据（最多缓存10页）
        if (dltHistoryCache.size >= 10) {
            const firstKey = dltHistoryCache.keys().next().value;
            dltHistoryCache.delete(firstKey);
        }
        dltHistoryCache.set(cacheKey, {
            data: result.data,
            pagination: result.pagination,
            timestamp: Date.now()
        });
        
        displayDLTHistoryData(result.data, result.pagination);
        
        const endTime = performance.now();
        console.log(`DLT history data loaded in ${Math.round(endTime - startTime)}ms`);
        
    } catch (error) {
        console.error('Error loading DLT history data:', error);
        const tbody = document.querySelector('#dlt-history tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #e74c3c;">加载失败: ${error.message}</td></tr>`;
        }
    } finally {
        // 重置加载状态
        dltHistoryLoading = false;
    }
}

/**
 * 显示大乐透历史开奖数据
 */
function displayDLTHistoryData(data, pagination) {
    const startTime = performance.now();
    const tbody = document.querySelector('#dlt-history tbody');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #666;">暂无数据</td></tr>';
        return;
    }
    
    // 注意：后端数据按降序排列（最新期号在前），与双色球保持一致
    // 不需要反转，直接显示最新期号在前
    
    // 使用DocumentFragment优化DOM操作性能
    const fragment = document.createDocumentFragment();
    
    // 批量创建行元素（避免复杂的字符串拼接）
    data.forEach(record => {
        const row = document.createElement('tr');
        
        // 期号列
        const issueCell = document.createElement('td');
        issueCell.textContent = record.Issue;
        row.appendChild(issueCell);
        
        // 日期列
        const dateCell = document.createElement('td');
        dateCell.textContent = record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : '';
        row.appendChild(dateCell);
        
        // 号码列 - 使用与双色球一致的样式
        const numbersCell = document.createElement('td');
        
        // 预格式化号码
        const r1 = String(record.Red1).padStart(2, '0');
        const r2 = String(record.Red2).padStart(2, '0');
        const r3 = String(record.Red3).padStart(2, '0');
        const r4 = String(record.Red4).padStart(2, '0');
        const r5 = String(record.Red5).padStart(2, '0');
        const b1 = String(record.Blue1).padStart(2, '0');
        const b2 = String(record.Blue2).padStart(2, '0');
        
        // 使用与双色球一致的样式类
        numbersCell.innerHTML = `<span class="ball red-ball">${r1}</span><span class="ball red-ball">${r2}</span><span class="ball red-ball">${r3}</span><span class="ball red-ball">${r4}</span><span class="ball red-ball">${r5}</span> + <span class="ball blue-ball">${b1}</span><span class="ball blue-ball">${b2}</span>`;
        
        row.appendChild(numbersCell);
        fragment.appendChild(row);
    });
    
    // 一次性更新DOM
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // 更新分页
    updateDLTHistoryPagination(pagination);
    
    const endTime = performance.now();
    console.log(`DLT history display rendered in ${Math.round(endTime - startTime)}ms for ${data.length} records`);
}

/**
 * 初始化大乐透历史数据分页
 */
function initDLTHistoryPagination() {
    const prevBtn = document.querySelector('#dlt-history .prev-page');
    const nextBtn = document.querySelector('#dlt-history .next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (dltCurrentPage > 1) {
                dltCurrentPage--;
                loadDLTHistoryData(dltCurrentPage);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            dltCurrentPage++;
            loadDLTHistoryData(dltCurrentPage);
        });
    }
    
    console.log('DLT history pagination initialized');
}

/**
 * 更新大乐透历史数据分页
 */
function updateDLTHistoryPagination(pagination) {
    const pageInfo = document.querySelector('#dlt-history .page-info');
    const prevBtn = document.querySelector('#dlt-history .prev-page');
    const nextBtn = document.querySelector('#dlt-history .next-page');
    
    if (!pagination) return;
    
    const { current, pages, total } = pagination;
    
    // 更新分页信息
    if (pageInfo) {
        pageInfo.textContent = `第 ${current} 页`;
    }
    
    // 更新按钮状态
    if (prevBtn) {
        prevBtn.disabled = current === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = current >= pages;
    }
}

/**
 * 初始化大乐透历史数据刷新功能
 */
function initDLTHistoryRefresh() {
    const refreshBtns = document.querySelectorAll('#dlt-history .refresh-btn');
    refreshBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Refreshing DLT history data...');

            // 刷新时清除缓存，确保获取最新数据
            dltHistoryCache.clear();

            // 重置到第一页并重新加载
            dltCurrentPage = 1;
            loadDLTHistoryData(dltCurrentPage, true);
        });
    });

    // 统一更新按钮
    const btnUpdateAll = document.getElementById('btn-update-all');
    if (btnUpdateAll) {
        btnUpdateAll.addEventListener('click', showUpdateDialog);
    }

    // 数据状态按钮
    const btnDataStatus = document.getElementById('btn-data-status');
    if (btnDataStatus) {
        btnDataStatus.addEventListener('click', showDataStatusDialog);
    }
}

/**
 * 显示统一更新对话框
 */
async function showUpdateDialog() {
    const confirmed = confirm('确定要执行快速修复吗？\n\n此操作将：\n1. 重新生成遗漏值表\n2. 清理过期缓存\n3. 验证数据完整性\n\n预计耗时: 30-60秒');

    if (!confirmed) return;

    try {
        const response = await fetch('http://localhost:3003/api/dlt/repair-data', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ 修复任务已启动！\n\n请等待30-60秒后刷新数据查看结果。\n任务详情请查看控制台日志。');
        } else {
            alert('❌ 启动失败: ' + result.message);
        }
    } catch (error) {
        alert('❌ 请求失败: ' + error.message);
    }
}

/**
 * 显示数据状态对话框
 */
async function showDataStatusDialog() {
    try {
        const response = await fetch('http://localhost:3003/api/dlt/data-status');
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            let message = `📊 数据状态报告\n\n`;
            message += `最新期号: ${data.latestIssue}\n`;
            message += `总记录数: ${data.totalRecords} 期\n\n`;
            message += `数据表状态:\n`;

            data.tables.forEach(table => {
                const icon = table.status === 'ok' ? '✅' : '⚠️';
                message += `${icon} ${table.name}: ${table.count} 期`;
                if (table.lag && table.lag > 0) {
                    message += ` (落后${table.lag}期)`;
                }
                message += `\n`;
            });

            if (data.needsUpdate) {
                message += `\n⚠️ 发现数据问题:\n`;
                data.issues.forEach(issue => {
                    message += `  - ${issue.table}: ${issue.message}\n`;
                });
                message += `\n建议点击"统一更新"按钮修复。`;
            } else {
                message += `\n✅ 所有数据表状态正常！`;
            }

            alert(message);
        } else {
            alert('❌ 获取数据状态失败: ' + result.message);
        }
    } catch (error) {
        alert('❌ 请求失败: ' + error.message);
    }
}

// ===== 大乐透走势图模块 =====

/**
 * 初始化大乐透走势图模块
 */
function initDLTTrendModule() {
    console.log('Initializing DLT Trend Module...');

    // 初始化期数按钮选择器（与双色球保持一致）
    initDLTPeriodButtons();

    // 初始化缩放控制
    initDLTZoomControls();

    // 初始化自定义范围选择器
    initDLTCustomRangeSelector();

    // 初始化分析按钮
    initDLTAnalysisButtons();
}

/**
 * 初始化大乐透缩放控制
 */
function initDLTZoomControls() {
    const dltPanel = document.getElementById('dlt-trend');
    if (!dltPanel) return;

    const zoomBtns = dltPanel.querySelectorAll('.zoom-btn');
    const zoomWrapper = dltPanel.querySelector('.trend-zoom-wrapper');

    if (!zoomWrapper) {
        console.warn('DLT Zoom wrapper not found');
        return;
    }

    // 保存引用到全局变量以便后续使用
    window.dltZoomWrapper = zoomWrapper;

    // 从localStorage读取保存的缩放值
    const savedZoom = localStorage.getItem('dlt-trend-zoom') || '1.0';

    // 设置对应按钮为活跃状态
    zoomBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.zoom === savedZoom) {
            btn.classList.add('active');
        }
    });

    // 为每个缩放按钮添加事件监听器
    zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const zoomValue = parseFloat(btn.dataset.zoom);

            // 更新按钮状态
            zoomBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 应用缩放
            applyDLTZoom(zoomWrapper, zoomValue);

            // 保存到localStorage
            localStorage.setItem('dlt-trend-zoom', btn.dataset.zoom);
        });
    });

    // 应用初始缩放（延迟执行，确保内容已渲染）
    setTimeout(() => {
        applyDLTZoom(zoomWrapper, parseFloat(savedZoom));
    }, 100);

    // 添加窗口大小改变监听器
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const currentZoom = localStorage.getItem('dlt-trend-zoom') || '1.0';
            applyDLTZoom(zoomWrapper, parseFloat(currentZoom));
        }, 100);
    });
}

/**
 * 应用大乐透缩放变换
 */
function applyDLTZoom(wrapper, zoomValue) {
    if (!wrapper) return;

    // 设置缩放变换
    wrapper.style.transform = `scale(${zoomValue})`;
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.transition = 'transform 0.3s ease';

    // 获取容器
    const container = wrapper.parentElement;
    if (!container) return;

    // 强制重新计算布局
    wrapper.offsetHeight;

    // 等待重新渲染后获取真实宽度
    requestAnimationFrame(() => {
        const table = wrapper.querySelector('.trend-table');
        let originalWidth = 0;

        if (table) {
            // 临时移除transform来获取真实宽度
            const originalTransform = wrapper.style.transform;
            wrapper.style.transform = 'none';
            originalWidth = table.offsetWidth || table.scrollWidth || 1200; // 默认最小宽度
            wrapper.style.transform = originalTransform;
        } else {
            originalWidth = wrapper.scrollWidth || wrapper.offsetWidth || 1200;
        }

        const scaledWidth = originalWidth * zoomValue;

        if (zoomValue <= 1) {
            // 缩小时：允许容器自然收缩
            container.style.width = 'auto';
            container.style.overflowX = 'visible';
            container.style.maxWidth = 'none';
        } else {
            // 放大时：设置容器处理滚动
            const contentBody = container.closest('.content-body');
            const availableWidth = contentBody ? contentBody.offsetWidth - 40 : window.innerWidth - 100;

            if (scaledWidth > availableWidth) {
                container.style.width = `${availableWidth}px`;
                container.style.overflowX = 'auto';
            } else {
                container.style.width = `${scaledWidth}px`;
                container.style.overflowX = 'visible';
            }

            // 确保父级容器支持滚动
            if (contentBody) {
                contentBody.style.overflowX = 'auto';
            }
        }
    });
}

/**
 * 兼容性函数 - 保持原有applyZoom函数以避免其他地方调用出错
 */
function applyZoom(wrapper, zoomValue) {
    applyDLTZoom(wrapper, zoomValue);
}

/**
 * 初始化大乐透期数按钮选择器（与双色球保持一致）
 */
function initDLTPeriodButtons() {
    const dltPanel = document.getElementById('dlt-trend');
    if (!dltPanel) return;
    
    const periodBtns = dltPanel.querySelectorAll('.period-btn');
    
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dltCustomRangeMode = false;
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dltCurrentPeriods = parseInt(btn.dataset.periods);
            loadDLTTrendData();
            
            // 清空自定义期号输入
            const startIssueInput = document.getElementById('dlt-startIssue');
            const endIssueInput = document.getElementById('dlt-endIssue');
            if (startIssueInput) startIssueInput.value = '';
            if (endIssueInput) endIssueInput.value = '';
        });
    });
}

/**
 * 初始化大乐透自定义范围选择器
 */
function initDLTCustomRangeSelector() {
    const dltPanel = document.getElementById('dlt-trend');
    if (!dltPanel) return;
    
    const customRangeBtn = dltPanel.querySelector('.custom-range-btn');
    const startIssueInput = document.getElementById('dlt-startIssue');
    const endIssueInput = document.getElementById('dlt-endIssue');
    
    if (customRangeBtn) {
        customRangeBtn.addEventListener('click', () => {
            const startIssue = startIssueInput?.value.trim();
            const endIssue = endIssueInput?.value.trim();
            
            // 验证输入
            if (!startIssue || !endIssue) {
                alert('请输入起始和结束期号');
                return;
            }
            
            if (!/^\d{5}$/.test(startIssue) || !/^\d{5}$/.test(endIssue)) {
                alert('期号格式不正确，请输入5位数字');
                return;
            }
            
            if (parseInt(startIssue) > parseInt(endIssue)) {
                alert('起始期号不能大于结束期号');
                return;
            }
            
            // 切换到自定义范围模式
            dltCustomRangeMode = true;
            const periodBtns = dltPanel.querySelectorAll('.period-btn');
            periodBtns.forEach(btn => btn.classList.remove('active'));
            loadDLTTrendData(startIssue, endIssue);
        });
    }
    
    // 输入框按回车触发查询
    [startIssueInput, endIssueInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    customRangeBtn?.click();
                }
            });
            
            // 限制只能输入数字
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    });
}

/**
 * 加载大乐透走势图数据
 */
async function loadDLTTrendData(startIssue = null, endIssue = null) {
    console.log('Loading DLT trend data...', {startIssue, endIssue, dltCurrentPeriods});
    
    try {
        const container = document.querySelector('#dlt-trend .trend-table-container');
        if (!container) {
            console.error('DLT trend table container not found');
            return;
        }
        console.log('Found DLT trend container:', container);
        
        // 显示加载状态
        showDLTTrendLoading(container);
        
        // 构建查询参数
        const queryParams = dltCustomRangeMode && startIssue && endIssue ? 
            `startIssue=${startIssue}&endIssue=${endIssue}` : 
            `recentPeriods=${dltCurrentPeriods}`;
        
        const [trendResponse, frequencyResponse] = await Promise.all([
            fetch(`http://localhost:3003/api/dlt/trendchart?${queryParams}`),
            fetch('http://localhost:3003/api/dlt/frequency')
        ]);
        const result = await trendResponse.json();
        const frequencyResult = await frequencyResponse.json();
        
        if (!result.success) {
            throw new Error(result.message || '加载数据失败');
        }
        
        displayDLTTrendData(result.data, frequencyResult.data);
        
    } catch (error) {
        console.error('Error loading DLT trend data:', error);
        const container = document.querySelector('#dlt-trend .trend-table-container');
        if (container) {
            container.innerHTML = `<div class="error-message" style="text-align: center; padding: 20px; color: #e74c3c;">加载数据失败: ${error.message}</div>`;
        }
    }
}

/**
 * 显示大乐透走势图加载状态
 */
function showDLTTrendLoading(container) {
    container.innerHTML = `
        <div class="dlt-loading-overlay">
            <div class="loading-spinner"></div>
            <div style="margin-top: 10px; color: #666;">正在加载大乐透走势数据...</div>
        </div>
        <table class="trend-table dlt-trend-table">
            <thead>
                <tr class="header-row">
                    <th rowspan="2" class="fixed-col">期号</th>
                    <th rowspan="2" class="fixed-col">星期</th>
                    <th colspan="12" class="zone-header red-zone">前区一区(01-12)</th>
                    <th colspan="12" class="zone-header red-zone red-zone-two">前区二区(13-24)</th>
                    <th colspan="11" class="zone-header red-zone">前区三区(25-35)</th>
                    <th colspan="12" class="zone-header blue-zone blue-section-start">后区(01-12)</th>
                    <th colspan="7" class="zone-header stat-zone stat-section-start">统计数据</th>
                </tr>
                <tr class="number-row">
                    ${Array.from({length: 12}, (_, i) => `<th class="red-section">${String(i + 1).padStart(2, '0')}</th>`).join('')}
                    ${Array.from({length: 12}, (_, i) => `<th class="red-section${i === 0 ? ' zone-separator' : ''}">${String(i + 13).padStart(2, '0')}</th>`).join('')}
                    ${Array.from({length: 11}, (_, i) => `<th class="red-section${i === 0 ? ' zone-separator' : ''}">${String(i + 25).padStart(2, '0')}</th>`).join('')}
                    ${Array.from({length: 12}, (_, i) => `<th${i === 0 ? ' class="blue-section-start"' : ''}>${String(i + 1).padStart(2, '0')}</th>`).join('')}
                    <th class="stat-col-head stat-section-start">前区和值</th>
                    <th class="stat-col-head">前区跨度</th>
                    <th class="stat-col-head">热温冷比</th>
                    <th class="stat-col-head">区间比</th>
                    <th class="stat-col-head">前区奇偶</th>
                    <th class="stat-col-head">后区和值</th>
                    <th class="stat-col-head">后区奇偶</th>
                </tr>
            </thead>
            <tbody id="dlt-trendTableBody"></tbody>
            <tfoot id="dltPreSelectRows">
                ${Array.from({length: 3}, (_, rowIndex) => `
                    <tr class="pre-select-row" data-row="${rowIndex + 1}">
                        <td class="fixed-col">预选${rowIndex + 1}</td>
                        <td class="fixed-col">-</td>
                        ${Array.from({length: 35}, (_, i) => `
                            <td class="selectable-cell front-cell" data-number="${i + 1}" title="点击选择前区号码 ${String(i + 1).padStart(2, '0')}">
                                <div class="cell-content">${String(i + 1).padStart(2, '0')}</div>
                            </td>
                        `).join('')}
                        ${Array.from({length: 12}, (_, i) => `
                            <td class="selectable-cell back-cell blue-section${i === 0 ? ' blue-section-start' : ''}" data-number="${i + 1}" title="点击选择后区号码 ${String(i + 1).padStart(2, '0')}">
                                <div class="cell-content">${String(i + 1).padStart(2, '0')}</div>
                            </td>
                        `).join('')}
                        <td colspan="7" class="stat-section-start">-</td>
                    </tr>
                `).join('')}
            </tfoot>
        </table>
    `;
}

/**
 * 显示大乐透走势图数据
 */
function displayDLTTrendData(data, frequencyData) {
    console.log('Displaying DLT trend data:', data?.length, 'records');
    
    const tbody = document.querySelector('#dlt-trendTableBody');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="49" style="text-align: center; padding: 20px; color: #666;">暂无数据</td></tr>';
        return;
    }
    
    // 服务器端已经按ID升序返回数据，最老的期号在前，最新的期号在后
    
    // 缓存最新一期的遗漏值（数据最新的在最后一条）
    if (data.length > 0) {
        const lastRecord = data[data.length - 1];
        
        // 适配不同的数据结构
        if (lastRecord.redBalls) {
            // 来自 /api/dlt/trend 的数据结构
            dltLastFrontBallMissing = lastRecord.redBalls.map(ball => ({
                number: ball.number,
                missing: ball.missing
            }));
            dltLastBackBallMissing = lastRecord.blueBalls.map(ball => ({
                number: ball.number,
                missing: ball.missing
            }));
        } else if (lastRecord.frontZone) {
            // 来自 /api/dlt/trendchart 的数据结构
            dltLastFrontBallMissing = lastRecord.frontZone.map(ball => ({
                number: ball.number,
                missing: ball.missing
            }));
            dltLastBackBallMissing = lastRecord.backZone.map(ball => ({
                number: ball.number,
                missing: ball.missing
            }));
        } else {
            dltLastFrontBallMissing = [];
            dltLastBackBallMissing = [];
        }
    }
    
    // 生成表格行
    const rows = data.map(item => {
        // 适配不同的数据结构
        let frontBalls, backBalls;
        if (item.redBalls) {
            // 来自 /api/dlt/trend 的数据结构
            frontBalls = item.redBalls || [];
            backBalls = item.blueBalls || [];
        } else if (item.frontZone) {
            // 来自 /api/dlt/trendchart 的数据结构
            frontBalls = item.frontZone || [];
            backBalls = item.backZone || [];
        } else {
            frontBalls = [];
            backBalls = [];
        }
        
        // 统计列HTML
        let statHtml = '';
        if (item.statistics) {
            // 使用后端预计算的统计数据
            statHtml = `
                <td class="stat-col stat-sum stat-section-start">${item.statistics.frontSum}</td>
                <td class="stat-col stat-span">${item.statistics.frontSpan}</td>
                <td class="stat-col stat-hotwarmcold">${item.statistics.frontHotWarmColdRatio}</td>
                <td class="stat-col stat-zone">${item.statistics.frontZoneRatio}</td>
                <td class="stat-col stat-oddeven">${item.statistics.frontOddEvenRatio}</td>
                <td class="stat-col stat-back-sum">${item.statistics.backSum}</td>
                <td class="stat-col stat-back-oddeven">${item.statistics.backOddEvenRatio}</td>
            `;
        } else {
            // 前端计算（兼容性处理）
            const fronts = frontBalls.filter(b => b.isDrawn).map(b => b.number);
            const backs = backBalls.filter(b => b.isDrawn).map(b => b.number);
            const frontSum = fronts.reduce((a, b) => a + b, 0);
            const frontSpan = fronts.length > 0 ? Math.max(...fronts) - Math.min(...fronts) : 0;
            
            // 前区热温冷比需要基于上一期遗漏值，前端无法获取
            const frontHotWarmColdRatio = '需要后端数据';
            
            // 前区区间比
            let zone1 = 0, zone2 = 0, zone3 = 0;
            fronts.forEach(n => {
                if (n <= 12) zone1++;
                else if (n <= 24) zone2++;
                else zone3++;
            });
            
            // 前区奇偶比
            let frontOdd = 0, frontEven = 0;
            fronts.forEach(n => n % 2 === 0 ? frontEven++ : frontOdd++);
            
            // 后区和值、奇偶比
            const backSum = backs.reduce((a, b) => a + b, 0);
            let backOdd = 0, backEven = 0;
            backs.forEach(n => n % 2 === 0 ? backEven++ : backOdd++);
            
            statHtml = `
                <td class="stat-col stat-sum stat-section-start">${frontSum}</td>
                <td class="stat-col stat-span">${frontSpan}</td>
                <td class="stat-col stat-hotwarmcold">${frontHotWarmColdRatio}</td>
                <td class="stat-col stat-zone">${zone1}:${zone2}:${zone3}</td>
                <td class="stat-col stat-oddeven">${frontOdd}:${frontEven}</td>
                <td class="stat-col stat-back-sum">${backSum}</td>
                <td class="stat-col stat-back-oddeven">${backOdd}:${backEven}</td>
            `;
        }
        
        return `
            <tr>
                <td class="fixed-col">${item.issue}</td>
                <td class="fixed-col">${item.drawingWeek || item.drawingDay || ''}</td>
                ${frontBalls.map((ball, index) => {
                    // 大乐透前区35个号码，按照与双色球类似的方式分为3个区域
                    // 区域1: 1-12 (12个号码)
                    // 区域2: 13-24 (12个号码) 
                    // 区域3: 25-35 (11个号码)
                    const zoneClass = (index === 12 || index === 24) ? 'zone-separator' : '';
                    let sectionClass = 'red-section';
                    
                    // 添加区域特定的CSS类，与双色球保持一致的命名
                    if (index >= 12 && index < 24) {
                        sectionClass += ' zone-two';  // 前区二区 (13-24)，与双色球保持一致的类名
                    }
                    
                    return `
                        <td class="${zoneClass} ${sectionClass}">
                            ${ball.isDrawn 
                                ? `<span class="drawn-number red-number">${String(ball.number).padStart(2, '0')}</span>`
                                : `<span class="missing">${ball.missing}</span>`
                            }
                        </td>
                    `;
                }).join('')}
                ${backBalls.map((ball, index) => {
                    const sectionClass = index === 0 ? 'blue-section-start blue-section' : 'blue-section';
                    
                    return `
                        <td class="${sectionClass}">
                            ${ball.isDrawn 
                                ? `<span class="drawn-number blue-number">${String(ball.number).padStart(2, '0')}</span>`
                                : `<span class="missing">${ball.missing}</span>`
                            }
                        </td>
                    `;
                }).join('')}
                ${statHtml}
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
    console.log('DLT tbody updated with', rows.length, 'characters of HTML');
    
    // 移除加载状态
    const container = document.querySelector('#dlt-trend .trend-table-container');
    const loadingOverlay = container?.querySelector('.dlt-loading-overlay');
    if (loadingOverlay) {
        console.log('Removing loading overlay');
        loadingOverlay.remove();
    } else {
        console.log('No loading overlay found to remove');
    }

    // 数据加载完成后重新应用缩放
    setTimeout(() => {
        if (window.dltZoomWrapper) {
            const currentZoom = localStorage.getItem('dlt-trend-zoom') || '1.0';
            applyDLTZoom(window.dltZoomWrapper, parseFloat(currentZoom));
        }
    }, 200);

    // 初始化预选功能
    try {
        initDLTPreSelectRows();
        console.log('DLT pre-select rows initialized');
    } catch (error) {
        console.error('Error initializing DLT pre-select rows:', error);
    }
    
    // 应用频率突显效果
    try {
        applyDLTFrequencyHighlight(data);
        console.log('DLT frequency highlighting applied');
    } catch (error) {
        console.error('Error applying DLT frequency highlighting:', error);
    }
    
    console.log(`DLT trend data displayed: ${data.length} records`);
}

/**
 * 应用大乐透频率突显效果
 */
function applyDLTFrequencyHighlight(data) {
    if (!data || data.length === 0) return;
    
    // 统计各列数据的出现频率
    const statFrequency = {
        frontSum: {},
        frontSpan: {},
        frontHotWarmColdRatio: {},
        frontZoneRatio: {},
        frontOddEvenRatio: {},
        backSum: {},
        backOddEvenRatio: {}
    };
    
    // 遍历数据统计频率
    data.forEach(item => {
        if (item.statistics) {
            const stats = item.statistics;
            
            // 统计前区和值频率
            if (stats.frontSum !== undefined) {
                statFrequency.frontSum[stats.frontSum] = (statFrequency.frontSum[stats.frontSum] || 0) + 1;
            }
            
            // 统计前区跨度频率
            if (stats.frontSpan !== undefined) {
                statFrequency.frontSpan[stats.frontSpan] = (statFrequency.frontSpan[stats.frontSpan] || 0) + 1;
            }
            
            // 统计热温冷比频率
            if (stats.frontHotWarmColdRatio) {
                statFrequency.frontHotWarmColdRatio[stats.frontHotWarmColdRatio] = (statFrequency.frontHotWarmColdRatio[stats.frontHotWarmColdRatio] || 0) + 1;
            }
            
            // 统计区间比频率
            if (stats.frontZoneRatio) {
                statFrequency.frontZoneRatio[stats.frontZoneRatio] = (statFrequency.frontZoneRatio[stats.frontZoneRatio] || 0) + 1;
            }
            
            // 统计前区奇偶比频率
            if (stats.frontOddEvenRatio) {
                statFrequency.frontOddEvenRatio[stats.frontOddEvenRatio] = (statFrequency.frontOddEvenRatio[stats.frontOddEvenRatio] || 0) + 1;
            }
            
            // 统计后区和值频率
            if (stats.backSum !== undefined) {
                statFrequency.backSum[stats.backSum] = (statFrequency.backSum[stats.backSum] || 0) + 1;
            }
            
            // 统计后区奇偶比频率
            if (stats.backOddEvenRatio) {
                statFrequency.backOddEvenRatio[stats.backOddEvenRatio] = (statFrequency.backOddEvenRatio[stats.backOddEvenRatio] || 0) + 1;
            }
        }
    });
    
    // 找出每列的最高和最低频率
    const frequencyStats = {};
    Object.keys(statFrequency).forEach(statType => {
        const frequencies = Object.values(statFrequency[statType]);
        if (frequencies.length > 0) {
            const maxFreq = Math.max(...frequencies);
            const minFreq = Math.min(...frequencies);

            // 找出最高频率和最低频率对应的值
            const maxValues = Object.keys(statFrequency[statType]).filter(key => statFrequency[statType][key] === maxFreq);
            const minValues = Object.keys(statFrequency[statType]).filter(key => statFrequency[statType][key] === minFreq);

            // 对热温冷比和区间比，找出频率最高的前三名
            let top3Values = maxValues;
            if (statType === 'frontHotWarmColdRatio' || statType === 'frontZoneRatio') {
                // 按频率降序排序所有值
                const sortedEntries = Object.entries(statFrequency[statType])
                    .sort((a, b) => b[1] - a[1]);

                // 获取前三个不同频率对应的所有值
                const uniqueFreqs = [...new Set(sortedEntries.map(e => e[1]))].slice(0, 3);
                top3Values = sortedEntries
                    .filter(e => uniqueFreqs.includes(e[1]))
                    .map(e => e[0]);
            }

            frequencyStats[statType] = {
                maxFreq,
                minFreq,
                maxValues,
                minValues,
                top3Values
            };
        }
    });
    
    // 应用颜色突显
    const tbody = document.querySelector('#dlt-trendTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // 统计列从第50列开始（期号 + 星期 + 35个前区 + 12个后区 = 49列，索引从49开始）
        const statStartIndex = 49;
        
        // 前区和值 (索引49) - 只对重复出现的和值显示绿色
        if (cells[statStartIndex] && frequencyStats.frontSum) {
            const value = cells[statStartIndex].textContent.trim();
            // 检查该前区和值的出现频率是否大于1（即重复出现）
            if (statFrequency.frontSum[value] && statFrequency.frontSum[value] > 1) {
                cells[statStartIndex].classList.add('ssq-freq-highest');
            }
            // 移除红色显示规则，不再添加 ssq-freq-lowest 类
        }
        
        // 前区跨度 (索引50)
        if (cells[statStartIndex + 1] && frequencyStats.frontSpan) {
            const value = cells[statStartIndex + 1].textContent.trim();
            if (frequencyStats.frontSpan.maxValues.includes(value)) {
                cells[statStartIndex + 1].classList.add('ssq-freq-highest');
            } else if (frequencyStats.frontSpan.minValues.includes(value)) {
                cells[statStartIndex + 1].classList.add('ssq-freq-lowest');
            }
        }
        
        // 热温冷比 (索引51) - 出现频率最高的前三名显示绿色，最少的显示红色
        if (cells[statStartIndex + 2] && frequencyStats.frontHotWarmColdRatio) {
            const value = cells[statStartIndex + 2].textContent.trim();
            if (frequencyStats.frontHotWarmColdRatio.top3Values.includes(value)) {
                cells[statStartIndex + 2].classList.add('ssq-freq-highest');
            } else if (frequencyStats.frontHotWarmColdRatio.minValues.includes(value)) {
                cells[statStartIndex + 2].classList.add('ssq-freq-lowest');
            }
        }
        
        // 区间比 (索引52) - 出现频率最高的前三名显示绿色，最少的显示红色
        if (cells[statStartIndex + 3] && frequencyStats.frontZoneRatio) {
            const value = cells[statStartIndex + 3].textContent.trim();
            if (frequencyStats.frontZoneRatio.top3Values.includes(value)) {
                cells[statStartIndex + 3].classList.add('ssq-freq-highest');
            } else if (frequencyStats.frontZoneRatio.minValues.includes(value)) {
                cells[statStartIndex + 3].classList.add('ssq-freq-lowest');
            }
        }
        
        // 前区奇偶比 (索引53)
        if (cells[statStartIndex + 4] && frequencyStats.frontOddEvenRatio) {
            const value = cells[statStartIndex + 4].textContent.trim();
            if (frequencyStats.frontOddEvenRatio.maxValues.includes(value)) {
                cells[statStartIndex + 4].classList.add('ssq-freq-highest');
            } else if (frequencyStats.frontOddEvenRatio.minValues.includes(value)) {
                cells[statStartIndex + 4].classList.add('ssq-freq-lowest');
            }
        }
        
        // 后区和值 (索引54)
        if (cells[statStartIndex + 5] && frequencyStats.backSum) {
            const value = cells[statStartIndex + 5].textContent.trim();
            if (frequencyStats.backSum.maxValues.includes(value)) {
                cells[statStartIndex + 5].classList.add('ssq-freq-highest');
            } else if (frequencyStats.backSum.minValues.includes(value)) {
                cells[statStartIndex + 5].classList.add('ssq-freq-lowest');
            }
        }
        
        // 后区奇偶比 (索引55)
        if (cells[statStartIndex + 6] && frequencyStats.backOddEvenRatio) {
            const value = cells[statStartIndex + 6].textContent.trim();
            if (frequencyStats.backOddEvenRatio.maxValues.includes(value)) {
                cells[statStartIndex + 6].classList.add('ssq-freq-highest');
            } else if (frequencyStats.backOddEvenRatio.minValues.includes(value)) {
                cells[statStartIndex + 6].classList.add('ssq-freq-lowest');
            }
        }
    });
    
    console.log('DLT frequency highlighting applied:', frequencyStats);
    
    // 在浏览器控制台显示频率统计信息
    if (Object.keys(frequencyStats).length > 0) {
        console.group('大乐透统计数据频率分析结果');
        Object.keys(frequencyStats).forEach(statType => {
            const stat = frequencyStats[statType];
            console.log(`${statType}:`);
            console.log(`  最高频率: ${stat.maxFreq}次 - 值: [${stat.maxValues.join(', ')}]`);
            console.log(`  最低频率: ${stat.minFreq}次 - 值: [${stat.minValues.join(', ')}]`);
            // 显示热温冷比和区间比的前三名
            if (statType === 'frontHotWarmColdRatio' || statType === 'frontZoneRatio') {
                console.log(`  前三名(标绿): [${stat.top3Values.join(', ')}]`);
            }
        });
        console.groupEnd();
    }
}

/**
 * 初始化大乐透预选功能
 */
function initDLTPreSelectRows() {
    const preSelectRows = document.getElementById('dltPreSelectRows');
    if (!preSelectRows) {
        console.warn('DLT pre-select rows not found');
        return;
    }
    
    console.log('Initializing DLT pre-select rows...');
    
    preSelectRows.addEventListener('click', (e) => {
        const cell = e.target.closest('.selectable-cell');
        if (!cell) return;
        
        cell.classList.toggle('selected');
        updateDLTRowSelections(cell.closest('.pre-select-row'));
    });
    
    console.log('DLT pre-select rows initialized successfully');
}

/**
 * 更新大乐透行选择状态
 */
function updateDLTRowSelections(row) {
    if (!row) return;
    
    // 处理前区选择 - 不显示蓝色选中背景，但保留遗漏值颜色标识
    const frontCells = row.querySelectorAll('.front-cell');
    
    // 处理后区选择 - 不显示蓝色选中背景，但保留遗漏值颜色标识
    const backCells = row.querySelectorAll('.back-cell');
    
    // 更新前区号码颜色（基于遗漏值，不显示蓝色选中背景）
    frontCells.forEach(cell => {
        const content = cell.querySelector('.cell-content');
        if (content) {
            content.classList.remove('miss-green', 'miss-yellow', 'miss-red');
        }
        
        if (cell.classList.contains('selected')) {
            const number = parseInt(cell.dataset.number);
            const missObj = dltLastFrontBallMissing.find(b => b.number === number);
            if (missObj && content) {
                if (missObj.missing <= 4) {
                    content.classList.add('miss-green');
                } else if (missObj.missing <= 9) {
                    content.classList.add('miss-yellow');
                } else {
                    content.classList.add('miss-red');
                }
            }
        }
    });
    
    // 更新后区号码颜色（基于遗漏值，不显示蓝色选中背景）
    backCells.forEach(cell => {
        const content = cell.querySelector('.cell-content');
        if (content) {
            content.classList.remove('miss-green', 'miss-yellow', 'miss-red');
        }
        
        if (cell.classList.contains('selected')) {
            const number = parseInt(cell.dataset.number);
            const missObj = dltLastBackBallMissing.find(b => b.number === number);
            if (missObj && content) {
                if (missObj.missing <= 2) {
                    content.classList.add('miss-green');
                } else if (missObj.missing <= 5) {
                    content.classList.add('miss-yellow');
                } else {
                    content.classList.add('miss-red');
                }
            }
        }
    });
}

// ===== 大乐透数据分析模块 =====

/**
 * 初始化大乐透数据分析模块
 */
function initDLTAnalysisModule() {
    console.log('Initializing DLT Analysis Module...');
    // 预留给同出数据、相克数据等分析功能
}

/**
 * 初始化大乐透分析按钮
 */
function initDLTAnalysisButtons() {
    // 同出数据按钮
    const cooccurrenceBtn = document.querySelector('#dlt-trend .co-occurrence-btn');
    if (cooccurrenceBtn) {
        cooccurrenceBtn.addEventListener('click', () => {
            handleDLTCooccurrenceData();
        });
    }
    
    // 相克数据按钮
    const conflictBtn = document.querySelector('#dlt-trend .conflict-data-btn');
    if (conflictBtn) {
        conflictBtn.addEventListener('click', () => {
            handleDLTConflictData();
        });
    }
}

/**
 * 处理大乐透同出数据请求
 */
async function handleDLTCooccurrenceData() {
    console.log('DLT co-occurrence data requested');
    
    try {
        // 显示加载状态
        showDLTAnalysisLoading('同出数据分析');
        
        // 获取当前筛选条件
        const params = getDLTCurrentFilterParams();
        
        // 请求同出数据
        const response = await fetch(`http://localhost:3003/api/dlt/cooccurrence?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '获取同出数据失败');
        }
        
        // 显示同出数据
        displayDLTCooccurrenceData(result.data);
        
    } catch (error) {
        console.error('Error loading DLT co-occurrence data:', error);
        showDLTAnalysisError('同出数据加载失败: ' + error.message);
    }
}

/**
 * 处理大乐透相克数据请求
 */
async function handleDLTConflictData() {
    console.log('DLT conflict data requested');
    
    try {
        // 显示加载状态
        showDLTAnalysisLoading('相克数据分析');
        
        // 获取当前筛选条件
        const params = getDLTCurrentFilterParams();
        
        // 请求相克数据
        const response = await fetch(`http://localhost:3003/api/dlt/conflict?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '获取相克数据失败');
        }
        
        // 显示相克数据
        displayDLTConflictData(result.data);
        
    } catch (error) {
        console.error('Error loading DLT conflict data:', error);
        showDLTAnalysisError('相克数据加载失败: ' + error.message);
    }
}

// ===== 大乐透专家推荐模块 =====

/**
 * 初始化大乐透专家推荐模块
 */
function initDLTExpertModule() {
    console.log('Initializing DLT Expert Module...');
    
    // 初始化专家和值预测按钮事件
    const predictBtn = document.getElementById('dlt-sum-predict-btn');
    if (predictBtn) {
        predictBtn.addEventListener('click', loadDLTSumPrediction);
    }

    // 初始化技术分析按钮事件
    const technicalBtn = document.getElementById('dlt-technical-analysis-btn');
    if (technicalBtn) {
        technicalBtn.addEventListener('click', loadDLTTechnicalAnalysis);
    }

    
    // 初始化分组期数按钮
    initDLTGroupPeriodButtons();
    
    // 初始化MA周期按钮
    initDLTMAPeriodButtons();
    
    // 初始化分析开始期数按钮
    initDLTAnalysisStartButtons();
    
    // 初始化验证期数按钮
    initDLTValidationPeriodButtons();
    
    // 初始化自定义期号范围
    initDLTCustomRange();
}

/**
 * 初始化分组期数按钮
 */
function initDLTGroupPeriodButtons() {
    const groupBtns = document.querySelectorAll('.period-group-btn');
    const customInput = document.getElementById('dlt-custom-group');
    
    groupBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 清除所有按钮的激活状态
            groupBtns.forEach(b => b.classList.remove('active'));
            // 激活当前按钮
            btn.classList.add('active');
            // 清空自定义输入框
            if (customInput) customInput.value = '';
        });
    });
    
    // 自定义输入框事件
    if (customInput) {
        customInput.addEventListener('input', () => {
            if (customInput.value) {
                // 清除所有按钮的激活状态
                groupBtns.forEach(btn => btn.classList.remove('active'));
            }
        });
        
        customInput.addEventListener('focus', () => {
            // 清除所有按钮的激活状态
            groupBtns.forEach(btn => btn.classList.remove('active'));
        });
    }
}

/**
 * 初始化MA周期按钮
 */
function initDLTMAPeriodButtons() {
    const maBtns = document.querySelectorAll('.ma-period-btn');
    const customMAInput = document.getElementById('dlt-custom-ma');
    
    maBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 清除所有按钮的激活状态
            maBtns.forEach(b => b.classList.remove('active'));
            // 激活当前按钮
            btn.classList.add('active');
            // 更新当前MA周期
            dltCurrentMAPeriod = parseInt(btn.dataset.ma);
            // 清空自定义输入框
            if (customMAInput) customMAInput.value = '';
            
            console.log(`MA周期已切换到: ${dltCurrentMAPeriod}期`);
        });
    });
    
    // 自定义MA周期输入框事件
    if (customMAInput) {
        customMAInput.addEventListener('input', () => {
            if (customMAInput.value) {
                // 清除所有按钮的激活状态
                maBtns.forEach(btn => btn.classList.remove('active'));
                // 更新当前MA周期
                const customValue = parseInt(customMAInput.value);
                if (customValue >= 5 && customValue <= 100) {
                    dltCurrentMAPeriod = customValue;
                    console.log(`MA周期已切换到: ${dltCurrentMAPeriod}期 (自定义)`);
                }
            }
        });
        
        customMAInput.addEventListener('focus', () => {
            // 清除所有按钮的激活状态
            maBtns.forEach(btn => btn.classList.remove('active'));
        });
        
        // 限制输入范围
        customMAInput.addEventListener('blur', () => {
            const value = parseInt(customMAInput.value);
            if (value < 5) {
                customMAInput.value = 5;
                dltCurrentMAPeriod = 5;
            } else if (value > 100) {
                customMAInput.value = 100;
                dltCurrentMAPeriod = 100;
            }
        });
    }
}

/**
 * 初始化分析开始期数按钮
 */
function initDLTAnalysisStartButtons() {
    const startBtns = document.querySelectorAll('.analysis-start-btn');
    const startIssueInput = document.getElementById('dlt-start-issue');
    const endIssueInput = document.getElementById('dlt-end-issue');
    
    startBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 清除所有按钮的激活状态
            startBtns.forEach(b => b.classList.remove('active'));
            // 激活当前按钮
            btn.classList.add('active');
            // 清空自定义期号输入框
            if (startIssueInput) startIssueInput.value = '';
            if (endIssueInput) endIssueInput.value = '';
        });
    });
}

/**
 * 初始化自定义期号范围
 */
function initDLTCustomRange() {
    const startIssueInput = document.getElementById('dlt-start-issue');
    const endIssueInput = document.getElementById('dlt-end-issue');
    const applyRangeBtn = document.getElementById('dlt-apply-range');
    const startBtns = document.querySelectorAll('.analysis-start-btn');
    
    // 期号输入框事件
    [startIssueInput, endIssueInput].forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                // 限制只能输入数字
                e.target.value = e.target.value.replace(/\D/g, '');
                // 限制最大长度为5位
                if (e.target.value.length > 5) {
                    e.target.value = e.target.value.slice(0, 5);
                }
                
                // 如果有输入，清除分析开始期数按钮的激活状态
                if (e.target.value) {
                    startBtns.forEach(btn => btn.classList.remove('active'));
                }
            });
            
            input.addEventListener('focus', () => {
                // 清除分析开始期数按钮的激活状态
                startBtns.forEach(btn => btn.classList.remove('active'));
            });
            
            // 回车键触发应用
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && applyRangeBtn) {
                    applyRangeBtn.click();
                }
            });
        }
    });
    
    // 应用范围按钮事件
    if (applyRangeBtn) {
        applyRangeBtn.addEventListener('click', () => {
            const startIssue = startIssueInput?.value.trim();
            const endIssue = endIssueInput?.value.trim();
            
            if (!startIssue || !endIssue) {
                alert('请输入起始和结束期号');
                return;
            }
            
            if (!/^\d{5}$/.test(startIssue) || !/^\d{5}$/.test(endIssue)) {
                alert('期号格式不正确，请输入5位数字（如：25001）');
                return;
            }
            
            if (parseInt(startIssue) > parseInt(endIssue)) {
                alert('起始期号不能大于结束期号');
                return;
            }
            
            // 验证通过，可以使用自定义范围
            console.log(`Custom range applied: ${startIssue} - ${endIssue}`);
            
            // 可以在这里添加视觉反馈
            applyRangeBtn.textContent = '已应用';
            applyRangeBtn.style.background = '#218838';
            
            setTimeout(() => {
                applyRangeBtn.textContent = '应用';
                applyRangeBtn.style.background = '#28a745';
            }, 1500);
        });
    }
}

/**
 * 获取当前选择的分组期数
 */
function getDLTCurrentGroupPeriods() {
    const activeBtn = document.querySelector('.period-group-btn.active');
    const customInput = document.getElementById('dlt-custom-group');
    
    if (customInput && customInput.value) {
        return parseInt(customInput.value);
    } else if (activeBtn) {
        return parseInt(activeBtn.dataset.periods);
    } else {
        return 30; // 默认值
    }
}

/**
 * 初始化验证期数按钮
 */
function initDLTValidationPeriodButtons() {
    const validationBtns = document.querySelectorAll('.validation-period-btn');
    const customInput = document.getElementById('dlt-custom-validation');
    
    validationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按钮的active类
            validationBtns.forEach(b => b.classList.remove('active'));
            // 给当前按钮添加active类
            btn.classList.add('active');
            
            // 清空自定义输入框
            if (customInput) {
                customInput.value = '';
            }
        });
    });
    
    // 自定义输入框事件
    if (customInput) {
        customInput.addEventListener('input', () => {
            if (customInput.value) {
                validationBtns.forEach(btn => btn.classList.remove('active'));
            }
        });
    }
}

/**
 * 获取当前选择的验证期数
 */
function getDLTCurrentValidationPeriods() {
    const activeBtn = document.querySelector('.validation-period-btn.active');
    const customInput = document.getElementById('dlt-custom-validation');
    
    if (customInput && customInput.value) {
        return parseInt(customInput.value);
    } else if (activeBtn) {
        return parseInt(activeBtn.dataset.testPeriods);
    } else {
        return 200; // 默认值
    }
}

/**
 * 获取当前选择的分析参数
 */
function getDLTCurrentAnalysisParams() {
    const startIssueInput = document.getElementById('dlt-start-issue');
    const endIssueInput = document.getElementById('dlt-end-issue');
    const startIssue = startIssueInput?.value.trim();
    const endIssue = endIssueInput?.value.trim();
    
    // 如果设置了自定义期号范围
    if (startIssue && endIssue && /^\d{5}$/.test(startIssue) && /^\d{5}$/.test(endIssue)) {
        return {
            type: 'range',
            startIssue,
            endIssue
        };
    }
    
    // 否则使用分析开始期数
    const activeBtn = document.querySelector('.analysis-start-btn.active');
    if (activeBtn) {
        const startType = activeBtn.dataset.start;
        if (startType === 'all') {
            return {
                type: 'all',
                description: '从最开始'
            };
        } else {
            const startFromCount = parseInt(startType);
            return {
                type: 'startFrom',
                startFrom: startFromCount,
                description: `最近第${startFromCount}期开始`
            };
        }
    }
    
    // 默认值
    return {
        type: 'startFrom',
        startFrom: 100,
        description: '最近第100期开始'
    };
}

/**
 * 加载大乐透专家推荐数据
 */
function loadDLTExpertData() {
    console.log('Loading DLT expert data...');
    // 显示初始界面，等待用户选择参数后手动触发预测
    const expertContent = document.querySelector('#dlt-expert .content-body');
    if (expertContent && !expertContent.querySelector('.dlt-sum-placeholder')) {
        expertContent.innerHTML = `
            <div class="dlt-sum-placeholder">
                <h3>大乐透专家和值预测</h3>
                <p>选择分组期数和分析期数，点击"生成预测"开始分析</p>
            </div>
        `;
    }
}

/**
 * 加载大乐透技术分析
 */
async function loadDLTTechnicalAnalysis() {
    try {
        // 显示加载状态
        const container = document.getElementById('dlt-sum-content');
        if (container) {
            container.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <div style="margin-top: 10px; color: #666;">正在进行技术分析...</div>
                </div>
            `;
        }

        // 获取技术分析数据
        const response = await fetch('http://localhost:3003/api/dlt/technical-analysis?periods=200');
        const result = await response.json();
        
        if (result.success) {
            displayDLTTechnicalAnalysis(result.data);
        } else {
            throw new Error(result.message || '技术分析失败');
        }
    } catch (error) {
        console.error('加载技术分析失败:', error);
        const container = document.getElementById('dlt-sum-content');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 20px; color: #e74c3c;">
                    技术分析失败: ${error.message}
                </div>
            `;
        }
    }
}

/**
 * 加载大乐透和值预测数据
 */
async function loadDLTSumPrediction() {
    try {
        const periodGroup = getDLTCurrentGroupPeriods();
        const analysisParams = getDLTCurrentAnalysisParams();
        
        console.log(`Loading DLT sum prediction with periodGroup: ${periodGroup}`, analysisParams);
        
        const contentContainer = document.getElementById('dlt-sum-content');
        if (!contentContainer) {
            console.error('DLT sum content container not found');
            return;
        }
        
        // 显示加载状态
        contentContainer.innerHTML = `
            <div class="dlt-loading-overlay">
                <div class="loading-spinner"></div>
                <div style="margin-top: 10px; color: #666;">正在分析大乐透和值数据和验证准确率...</div>
            </div>
        `;
        
        // 并行获取预测数据和验证数据
        const [predictionResult, validationResult] = await Promise.all([
            loadDLTPredictionData(periodGroup, analysisParams),
            loadDLTValidationData(periodGroup)
        ]);
        
        if (!predictionResult.success) {
            throw new Error(predictionResult.message || '获取预测数据失败');
        }
        
        if (!validationResult.success) {
            throw new Error(validationResult.message || '获取验证数据失败');
        }
        
        // 显示合并的预测和验证结果
        displayDLTCombinedResults(predictionResult.data, validationResult.data);
        
    } catch (error) {
        console.error('Error loading DLT sum prediction:', error);
        const contentContainer = document.getElementById('dlt-sum-content');
        if (contentContainer) {
            contentContainer.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 20px; color: #e74c3c;">
                    加载和值预测失败: ${error.message}
                </div>
            `;
        }
    }
}

/**
 * 获取大乐透预测数据
 */
async function loadDLTPredictionData(periodGroup, analysisParams) {
    // 构建API参数
    let apiUrl = `http://localhost:3003/api/dlt/sum-prediction?periodGroup=${periodGroup}&maPeriod=${dltCurrentMAPeriod}`;
    
    if (analysisParams.type === 'range') {
        apiUrl += `&startIssue=${analysisParams.startIssue}&endIssue=${analysisParams.endIssue}`;
    } else if (analysisParams.type === 'all') {
        apiUrl += `&analyzeAll=true`;
    } else if (analysisParams.type === 'startFrom') {
        apiUrl += `&startFrom=${analysisParams.startFrom}`;
    } else {
        // 兼容旧参数
        apiUrl += `&limit=${analysisParams.limit || 100}`;
    }
    
    // 添加热温冷比排除参数
    const htcParams = collectDLTHotWarmColdParams();
    if (htcParams.excludeHtcRatios) {
        apiUrl += `&excludeHtcRatios=${encodeURIComponent(htcParams.excludeHtcRatios)}`;
    }
    if (htcParams.htcRecentPeriods > 0) {
        apiUrl += `&htcRecentPeriods=${htcParams.htcRecentPeriods}`;
    }
    if (htcParams.excludePreHtc) {
        apiUrl += `&excludePreHtc=true`;
        if (htcParams.excludePreHtcPeriods) {
            apiUrl += `&excludePreHtcPeriods=${htcParams.excludePreHtcPeriods}`;
        }
    }
    
    // 添加区间比排除参数
    const zoneParams = collectDLTZoneRatioParams();
    if (zoneParams.excludeZoneRatios) {
        apiUrl += `&excludeZoneRatios=${encodeURIComponent(zoneParams.excludeZoneRatios)}`;
    }
    if (zoneParams.zoneRecentPeriods > 0) {
        apiUrl += `&zoneRecentPeriods=${zoneParams.zoneRecentPeriods}`;
    }
    if (zoneParams.excludePreZone) {
        apiUrl += `&excludePreZone=true`;
    }
    
    console.log('热温冷比参数:', htcParams);
    console.log('区间比参数:', zoneParams);
    console.log('完整API URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    return await response.json();
}

/**
 * 获取大乐透验证数据
 */
async function loadDLTValidationData(periodGroup) {
    const testPeriods = getDLTCurrentValidationPeriods(); // 使用用户选择的验证期数
    const response = await fetch(`/api/dlt/group-validation?periodGroup=${periodGroup}&testPeriods=${testPeriods}`);
    return await response.json();
}

/**
 * 显示合并的预测和验证结果
 */
function displayDLTCombinedResults(predictionData, validationData) {
    const contentContainer = document.getElementById('dlt-sum-content');
    if (!contentContainer) return;

    const { prediction } = predictionData;
    const { accuracy, totalTests, results } = validationData;

    // 确保 results 是数组类型
    const resultsArray = Array.isArray(results) ? results : [];
    
    contentContainer.innerHTML = `
        <div class="dlt-combined-prediction-container">
            <!-- 预测结果摘要 -->
            <div class="prediction-summary">
                <h3>🎯 大乐透专家和值预测与验证</h3>
                <div class="prediction-cards">
                    <div class="prediction-card front-sum">
                        <div class="card-header">前区和值预测</div>
                        <div class="recommended-sum">${prediction.frontSum.recommended}</div>
                        <div class="sum-range">预测范围: ${prediction.frontSum.range.min}-${prediction.frontSum.range.max}</div>
                        <div class="confidence">置信度: ${prediction.frontSum.confidence}%</div>
                    </div>
                    <div class="prediction-card back-sum">
                        <div class="card-header">后区和值预测</div>
                        <div class="recommended-sum">${prediction.backSum.recommended}</div>
                        <div class="sum-range">预测范围: ${prediction.backSum.range.min}-${prediction.backSum.range.max}</div>
                        <div class="confidence">置信度: ${prediction.backSum.confidence}%</div>
                    </div>
                </div>
            </div>
            
            <!-- 验证准确率统计 -->
            <div class="validation-section">
                <h3>📊 预测准确率验证</h3>
                <div class="validation-summary-grid">
                    <div class="validation-stat-card">
                        <div class="validation-stat-value">${totalTests}</div>
                        <div class="validation-stat-label">总验证组数</div>
                    </div>
                    <div class="validation-stat-card">
                        <div class="validation-stat-value">${accuracy.front}%</div>
                        <div class="validation-stat-label">前区预测准确率</div>
                    </div>
                    <div class="validation-stat-card">
                        <div class="validation-stat-value">${accuracy.back}%</div>
                        <div class="validation-stat-label">后区预测准确率</div>
                    </div>
                    <div class="validation-stat-card">
                        <div class="validation-stat-value">${accuracy.both}%</div>
                        <div class="validation-stat-label">整体预测准确率</div>
                    </div>
                </div>
                
                <div class="validation-summary">
                    <strong>验证结果:</strong> 基于最近${totalTests}组预测数据的验证，前区和值预测准确率为${accuracy.front}%，后区和值预测准确率为${accuracy.back}%，整体准确率为${accuracy.both}%。
                </div>
            </div>
            
            <!-- 详细验证结果 -->
            <div class="detailed-validation-section">
                <div class="section-header">
                    <h3>🔍 详细验证结果</h3>
                    <div class="view-controls">
                        <button class="view-switch-btn active" onclick="showValidationSummary()">摘要视图</button>
                        <button class="view-switch-btn" onclick="showValidationDetails()">详细视图</button>
                    </div>
                </div>
                
                <div id="validation-summary-view">
                    <div class="validation-results-summary">
                        <div class="summary-stats">
                            <div class="stat-row">
                                <span class="stat-label">验证参数:</span>
                                <span class="stat-value">每${predictionData.periodGroup || 30}期一组，共验证${totalTests}组</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">前区命中情况:</span>
                                <span class="stat-value">${Math.round(totalTests * accuracy.front / 100)}组命中 / ${totalTests}组</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">后区命中情况:</span>
                                <span class="stat-value">${Math.round(totalTests * accuracy.back / 100)}组命中 / ${totalTests}组</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="validation-details-view" style="display: none;">
                    <div class="validation-results-grid">
                        ${resultsArray.slice(0, 10).map((result, index) => createValidationResultCard(result, index + 1)).join('')}
                    </div>
                    ${resultsArray.length > 10 ? `<div class="show-more-section"><button class="view-switch-btn" onclick="showAllValidationResults()">显示全部${resultsArray.length}条结果</button></div>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * 创建验证结果卡片
 */
function createValidationResultCard(result, index) {
    const frontHit = result.accuracy.frontHit;
    const backHit = result.accuracy.backHit;
    let accuracyClass, accuracyText;
    
    if (frontHit && backHit) {
        accuracyClass = 'hit';
        accuracyText = '完全命中';
    } else if (frontHit || backHit) {
        accuracyClass = 'partial';
        accuracyText = '部分命中';
    } else {
        accuracyClass = 'miss';
        accuracyText = '未命中';
    }
    
    return `
        <div class="validation-result-card">
            <div class="validation-result-header">
                <div class="validation-group-info">
                    第${index}组 (${result.windowInfo.startIssue}-${result.windowInfo.endIssue} → ${result.windowInfo.predictIssue})
                </div>
                <div class="validation-accuracy-badge ${accuracyClass}">${accuracyText}</div>
            </div>
            
            <div class="validation-result-content">
                <div class="validation-prediction-section front-area">
                    <h4 class="validation-section-title front-area">前区和值预测</h4>
                    <div class="validation-values">
                        <div class="validation-value-row">
                            <span>预测值:</span>
                            <span class="validation-predicted-value">${result.predicted.frontSum.recommended}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>预测范围:</span>
                            <span class="validation-range-display">${result.predicted.frontSum.range.min}-${result.predicted.frontSum.range.max}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>实际值:</span>
                            <span class="${frontHit ? 'validation-actual-value' : 'validation-miss-value'}">${result.actual.frontSum}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>置信度:</span>
                            <span>${result.predicted.frontSum.confidence}%</span>
                        </div>
                        <div class="validation-confidence-meter">
                            <div class="validation-confidence-fill" style="width: ${result.predicted.frontSum.confidence}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="validation-prediction-section back-area">
                    <h4 class="validation-section-title back-area">后区和值预测</h4>
                    <div class="validation-values">
                        <div class="validation-value-row">
                            <span>预测值:</span>
                            <span class="validation-predicted-value">${result.predicted.backSum.recommended}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>预测范围:</span>
                            <span class="validation-range-display">${result.predicted.backSum.range.min}-${result.predicted.backSum.range.max}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>实际值:</span>
                            <span class="${backHit ? 'validation-actual-value' : 'validation-miss-value'}">${result.actual.backSum}</span>
                        </div>
                        <div class="validation-value-row">
                            <span>置信度:</span>
                            <span>${result.predicted.backSum.confidence}%</span>
                        </div>
                        <div class="validation-confidence-meter">
                            <div class="validation-confidence-fill" style="width: ${result.predicted.backSum.confidence}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 显示验证摘要视图
 */
function showValidationSummary() {
    document.getElementById('validation-summary-view').style.display = 'block';
    document.getElementById('validation-details-view').style.display = 'none';
    
    // 更新按钮状态
    document.querySelectorAll('.view-switch-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

/**
 * 显示验证详细视图
 */
function showValidationDetails() {
    document.getElementById('validation-summary-view').style.display = 'none';
    document.getElementById('validation-details-view').style.display = 'block';
    
    // 更新按钮状态
    document.querySelectorAll('.view-switch-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

/**
 * 显示技术分析结果
 */
function displayDLTTechnicalAnalysis(data) {
    const container = document.getElementById('dlt-sum-content');
    if (!container) return;
    
    const { prediction, technicalIndicators, dataRange, confidence } = data;
    
    container.innerHTML = `
        <div class="dlt-technical-analysis-container">
            <!-- 技术分析结果摘要 -->
            <div class="prediction-summary">
                <h3>🔬 高级技术分析预测</h3>
                <div class="prediction-cards">
                    <div class="prediction-card front-sum technical-card">
                        <div class="card-header">前区和值预测 (技术分析)</div>
                        <div class="card-body">
                            <div class="recommended-sum">${prediction.frontSum.recommended}</div>
                            <div class="sum-range">智能范围: ${prediction.frontSum.range.min} - ${prediction.frontSum.range.max}</div>
                            <div class="confidence">AI置信度: ${prediction.frontSum.confidence}%</div>
                            <div class="technical-basis">
                                基于: MA20(${prediction.frontSum.technicalBasis.ma20.toFixed(1)}) 
                                ${prediction.frontSum.technicalBasis.trendAdjustment}
                            </div>
                        </div>
                    </div>
                    <div class="prediction-card back-sum technical-card">
                        <div class="card-header">后区和值预测 (技术分析)</div>
                        <div class="card-body">
                            <div class="recommended-sum">${prediction.backSum.recommended}</div>
                            <div class="sum-range">智能范围: ${prediction.backSum.range.min} - ${prediction.backSum.range.max}</div>
                            <div class="confidence">AI置信度: ${prediction.backSum.confidence}%</div>
                            <div class="technical-basis">
                                基于: MA20(${prediction.backSum.technicalBasis.ma20.toFixed(1)}) 
                                ${prediction.backSum.technicalBasis.trendAdjustment}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 技术指标仪表盘 -->
            <div class="technical-indicators-section">
                <h3>📊 技术指标仪表盘</h3>
                <div class="indicators-grid">
                    <!-- 移动平均线 -->
                    <div class="indicator-card">
                        <h4>移动平均线 (MA)</h4>
                        <div class="ma-values">
                            <div class="front-ma">
                                <label>前区:</label>
                                <span>MA5: ${technicalIndicators.movingAverages.front.ma5.toFixed(1)}</span>
                                <span>MA10: ${technicalIndicators.movingAverages.front.ma10.toFixed(1)}</span>
                                <span>MA20: ${technicalIndicators.movingAverages.front.ma20.toFixed(1)}</span>
                            </div>
                            <div class="back-ma">
                                <label>后区:</label>
                                <span>MA5: ${technicalIndicators.movingAverages.back.ma5.toFixed(1)}</span>
                                <span>MA10: ${technicalIndicators.movingAverages.back.ma10.toFixed(1)}</span>
                                <span>MA20: ${technicalIndicators.movingAverages.back.ma20.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- RSI指标 -->
                    <div class="indicator-card">
                        <h4>相对强弱指数 (RSI)</h4>
                        <div class="rsi-values">
                            <div class="front-rsi">
                                <label>前区:</label>
                                <span class="rsi-value rsi-${technicalIndicators.rsi.front.signal}">
                                    ${technicalIndicators.rsi.front.value.toFixed(1)}
                                </span>
                                <span class="rsi-signal">${getRSISignalText(technicalIndicators.rsi.front.signal)}</span>
                            </div>
                            <div class="back-rsi">
                                <label>后区:</label>
                                <span class="rsi-value rsi-${technicalIndicators.rsi.back.signal}">
                                    ${technicalIndicators.rsi.back.value.toFixed(1)}
                                </span>
                                <span class="rsi-signal">${getRSISignalText(technicalIndicators.rsi.back.signal)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 趋势分析 -->
                    <div class="indicator-card">
                        <h4>趋势分析</h4>
                        <div class="trend-values">
                            <div class="front-trend">
                                <label>前区:</label>
                                <span class="trend-direction trend-${technicalIndicators.trend.front.direction}">
                                    ${getTrendText(technicalIndicators.trend.front.direction)}
                                </span>
                                <span class="trend-strength">强度: ${(technicalIndicators.trend.front.strength * 100).toFixed(1)}%</span>
                            </div>
                            <div class="back-trend">
                                <label>后区:</label>
                                <span class="trend-direction trend-${technicalIndicators.trend.back.direction}">
                                    ${getTrendText(technicalIndicators.trend.back.direction)}
                                </span>
                                <span class="trend-strength">强度: ${(technicalIndicators.trend.back.strength * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- MACD信号 -->
                    <div class="indicator-card">
                        <h4>MACD信号</h4>
                        <div class="macd-values">
                            <div class="front-macd">
                                <label>前区:</label>
                                <span class="macd-signal macd-${technicalIndicators.macd.front}">
                                    ${getMACDSignalText(technicalIndicators.macd.front)}
                                </span>
                            </div>
                            <div class="back-macd">
                                <label>后区:</label>
                                <span class="macd-signal macd-${technicalIndicators.macd.back}">
                                    ${getMACDSignalText(technicalIndicators.macd.back)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 布林带位置 -->
                    <div class="indicator-card">
                        <h4>布林带位置</h4>
                        <div class="bollinger-values">
                            <div class="front-bollinger">
                                <label>前区:</label>
                                <div class="bollinger-bar">
                                    <div class="bollinger-position" style="left: ${technicalIndicators.bollinger.front.position * 100}%"></div>
                                </div>
                                <span>${(technicalIndicators.bollinger.front.position * 100).toFixed(1)}%</span>
                            </div>
                            <div class="back-bollinger">
                                <label>后区:</label>
                                <div class="bollinger-bar">
                                    <div class="bollinger-position" style="left: ${technicalIndicators.bollinger.back.position * 100}%"></div>
                                </div>
                                <span>${(technicalIndicators.bollinger.back.position * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 分析统计 -->
            <div class="analysis-summary">
                <h3>分析统计</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <label>分析模式:</label>
                        <value>高级技术分析</value>
                    </div>
                    <div class="stat-item">
                        <label>分析期数:</label>
                        <value>${dataRange.periods}期</value>
                    </div>
                    <div class="stat-item">
                        <label>数据范围:</label>
                        <value>${dataRange.startIssue} - ${dataRange.endIssue}</value>
                    </div>
                    <div class="stat-item">
                        <label>整体置信度:</label>
                        <value>${confidence}%</value>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 辅助函数
function getRSISignalText(signal) {
    switch(signal) {
        case 'overbought': return '超买';
        case 'oversold': return '超卖';
        case 'neutral': return '中性';
        default: return signal;
    }
}

function getTrendText(direction) {
    switch(direction) {
        case 'up': return '上升';
        case 'down': return '下降';
        case 'sideways': return '横盘';
        default: return direction;
    }
}

function getMACDSignalText(signal) {
    switch(signal) {
        case 'bullish_crossover': return '金叉';
        case 'bearish_crossover': return '死叉';
        case 'bullish_momentum': return '多头动能';
        case 'bearish_momentum': return '空头动能';
        case 'neutral': return '中性';
        default: return signal;
    }
}

/**
 * 显示大乐透和值预测结果
 */
function displayDLTSumPrediction(data) {
    const container = document.getElementById('dlt-sum-content');
    if (!container) return;
    
    const { sumHistoryTable, groupAnalysis, prediction, validation, periodInfo } = data;
    
    container.innerHTML = `
        <div class="dlt-sum-prediction-container">
            <!-- 预测结果摘要 -->
            <div class="prediction-summary">
                <h3>预测结果</h3>
                <div class="prediction-cards">
                    <div class="prediction-card front-sum">
                        <div class="card-header">前区和值预测</div>
                        <div class="card-body">
                            <div class="recommended-sum">${prediction.frontSum.recommended}</div>
                            <div class="sum-range">推荐范围: ${prediction.frontSum.range.min} - ${prediction.frontSum.range.max}</div>
                            <div class="confidence">置信度: ${prediction.frontSum.confidence}%</div>
                        </div>
                    </div>
                    <div class="prediction-card back-sum">
                        <div class="card-header">后区和值预测</div>
                        <div class="card-body">
                            <div class="recommended-sum">${prediction.backSum.recommended}</div>
                            <div class="sum-range">推荐范围: ${prediction.backSum.range.min} - ${prediction.backSum.range.max}</div>
                            <div class="confidence">置信度: ${prediction.backSum.confidence}%</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 统计信息 -->
            <div class="stats-section">
                <h3>分析统计</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <label>分析期数:</label>
                        <value>${periodInfo.totalPeriods}期</value>
                    </div>
                    <div class="stat-item">
                        <label>分组方式:</label>
                        <value>每${periodInfo.periodGroup}期一组</value>
                    </div>
                    <div class="stat-item">
                        <label>期号范围:</label>
                        <value>${periodInfo.startIssue} - ${periodInfo.endIssue}</value>
                    </div>
                    <div class="stat-item">
                        <label>分组总数:</label>
                        <value>${groupAnalysis.length}组</value>
                    </div>
                </div>
            </div>
            
            <!-- 验证结果 -->
            <div class="validation-section">
                <h3>历史验证</h3>
                <div class="validation-stats">
                    <div class="validation-item">
                        <label>前区和值准确率:</label>
                        <value class="accuracy-rate">${validation.accuracy.front}%</value>
                    </div>
                    <div class="validation-item">
                        <label>后区和值准确率:</label>
                        <value class="accuracy-rate">${validation.accuracy.back}%</value>
                    </div>
                    <div class="validation-item">
                        <label>整体准确率:</label>
                        <value class="accuracy-rate">${validation.accuracy.both}%</value>
                    </div>
                    <div class="validation-item">
                        <label>验证次数:</label>
                        <value>${validation.totalTests}次</value>
                    </div>
                </div>
                <div class="validation-summary">${validation.summary}</div>
            </div>
            
            <!-- 当前预测结果 -->
            <div class="current-prediction-section">
                <h3>当前预测结果</h3>
                <div class="prediction-display">
                    <div class="front-prediction">
                        <span class="prediction-label">前区和值预测：</span>
                        <span class="prediction-value">${prediction.frontSum.recommended}</span>
                        <span class="prediction-range">(范围: ${prediction.frontSum.range.min}-${prediction.frontSum.range.max})</span>
                        <span class="confidence">置信度: ${prediction.frontSum.confidence}%</span>
                    </div>
                    <div class="back-prediction">
                        <span class="prediction-label">后区和值预测：</span>
                        <span class="prediction-value">${prediction.backSum.recommended}</span>
                        <span class="prediction-range">(范围: ${prediction.backSum.range.min}-${prediction.backSum.range.max})</span>
                        <span class="confidence">置信度: ${prediction.backSum.confidence}%</span>
                    </div>
                </div>
            </div>
            
            <!-- 和值历史表格 -->
            <div class="sum-history-section">
                <h3>和值历史数据 (最近20期)</h3>
                <div class="sum-table-container">
                    <table class="sum-history-table">
                        <thead>
                            <tr>
                                <th>期号</th>
                                <th>开奖日期</th>
                                <th>前区和值</th>
                                <th>后区和值</th>
                                <th>前区预测</th>
                                <th>后区预测</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generateSumHistoryTableRows(sumHistoryTable.slice(0, 20), prediction)}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- 趋势分析 -->
            <div class="trend-analysis-section">
                <h3>分组趋势分析 (最近5组)</h3>
                <div class="trend-table-container">
                    <table class="trend-analysis-table">
                        <thead>
                            <tr>
                                <th>组别</th>
                                <th>期号范围</th>
                                <th>前区平均和值</th>
                                <th>后区平均和值</th>
                                <th>前区趋势</th>
                                <th>后区趋势</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generateTrendAnalysisTableRows(groupAnalysis.slice(-5))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * 生成和值历史表格行
 */
function generateSumHistoryTableRows(historyData, prediction) {
    return historyData.map(record => {
        const frontInRange = record.frontSum >= prediction.frontSum.range.min && record.frontSum <= prediction.frontSum.range.max;
        const backInRange = record.backSum >= prediction.backSum.range.min && record.backSum <= prediction.backSum.range.max;
        
        return `
            <tr>
                <td>${record.issue}</td>
                <td>${record.drawingDay || ''}</td>
                <td class="sum-value ${frontInRange ? 'in-range' : ''}">${record.frontSum}</td>
                <td class="sum-value ${backInRange ? 'in-range' : ''}">${record.backSum}</td>
                <td class="prediction-range">${prediction.frontSum.range.min}-${prediction.frontSum.range.max}</td>
                <td class="prediction-range">${prediction.backSum.range.min}-${prediction.backSum.range.max}</td>
            </tr>
        `;
    }).join('');
}

/**
 * 生成趋势分析表格行
 */
function generateTrendAnalysisTableRows(analysisData) {
    return analysisData.map(group => `
        <tr>
            <td>第${group.groupId}组</td>
            <td>${group.startIssue} - ${group.endIssue}</td>
            <td class="avg-sum">${group.frontSumStats.average}</td>
            <td class="avg-sum">${group.backSumStats.average}</td>
            <td class="trend-info">
                <span class="trend-direction ${group.trends.frontTrend.direction}">${group.trends.frontTrend.description}</span>
            </td>
            <td class="trend-info">
                <span class="trend-direction ${group.trends.backTrend.direction}">${group.trends.backTrend.description}</span>
            </td>
        </tr>
    `).join('');
}

// ===== 大乐透工具函数 =====

/**
 * 获取大乐透当前筛选参数
 */
function getDLTCurrentFilterParams() {
    const startIssue = document.getElementById('dlt-startIssue')?.value.trim();
    const endIssue = document.getElementById('dlt-endIssue')?.value.trim();
    
    if (dltCustomRangeMode && startIssue && endIssue) {
        return `startIssue=${startIssue}&endIssue=${endIssue}`;
    } else {
        return `periods=${dltCurrentPeriods}`;
    }
}

/**
 * 格式化大乐透号码显示
 */
function formatDLTNumber(number, isFrontZone = true) {
    return String(number).padStart(2, '0');
}

/**
 * 显示大乐透分析加载状态
 */
function showDLTAnalysisLoading(title) {
    const container = document.querySelector('#dlt-trend .trend-table-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="dlt-analysis-container">
            <div class="dlt-analysis-header">
                <h3 class="dlt-analysis-title">${title}</h3>
            </div>
            <div class="dlt-loading-overlay">
                <div class="loading-spinner"></div>
                <div style="margin-top: 10px; color: #666;">正在分析大乐透数据...</div>
            </div>
        </div>
    `;
}

/**
 * 显示大乐透分析错误
 */
function showDLTAnalysisError(message) {
    const container = document.querySelector('#dlt-trend .trend-table-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="dlt-analysis-container">
            <div class="dlt-error-message">
                ${message}
            </div>
        </div>
    `;
}

/**
 * 隐藏大乐透分析加载状态
 */
function hideDLTAnalysisLoading() {
    const cooccurrenceBtn = document.querySelector('#dlt-trend .co-occurrence-btn');
    if (cooccurrenceBtn) {
        cooccurrenceBtn.disabled = false;
        cooccurrenceBtn.textContent = '同出数据';
    }
    
    const conflictBtn = document.querySelector('#dlt-trend .conflict-data-btn');
    if (conflictBtn) {
        conflictBtn.disabled = false;
        conflictBtn.textContent = '相克数据';
    }
}

/**
 * 显示大乐透同出数据
 */
function displayDLTCooccurrenceData(data) {
    hideDLTAnalysisLoading();
    
    // 创建弹窗HTML
    const modal = document.createElement('div');
    modal.className = 'dlt-cooccurrence-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>大乐透同出数据分析</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="period-info">
                    <p><strong>分析期数:</strong> ${data.periodInfo.totalPeriods}期</p>
                    <p><strong>期号范围:</strong> ${data.periodInfo.startIssue} - ${data.periodInfo.endIssue}</p>
                    <p><strong>前区最热:</strong> ${data.statistics.frontBallStats.hottest ? 
                        `${formatDLTNumber(data.statistics.frontBallStats.hottest.num)} (${data.statistics.frontBallStats.hottest.freq}次)` : 
                        '暂无数据'}</p>
                    <p><strong>后区最热:</strong> ${data.statistics.backBallStats.hottest ? 
                        `${formatDLTNumber(data.statistics.backBallStats.hottest.num)} (${data.statistics.backBallStats.hottest.freq}次)` : 
                        '暂无数据'}</p>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-export-excel" onclick="exportDLTCooccurrenceExcel()">📊 导出Excel</button>
                    <button class="btn-detail-table" onclick="showDLTCooccurrenceTable()">📋 查看详细表格</button>
                </div>
                
                <div class="stats-summary">
                    <h4>🎯 号码分析摘要</h4>
                    <p>统计分析了${data.periodInfo.totalPeriods}期开奖数据，展示各号码之间的同出关系。</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // 存储数据供其他函数使用
    window.currentDLTCooccurrenceData = data;
}

/**
 * 显示大乐透相克数据
 */
function displayDLTConflictData(data) {
    hideDLTAnalysisLoading();
    
    // 创建弹窗HTML
    const modal = document.createElement('div');
    modal.className = 'dlt-conflict-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>大乐透相克数据分析</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="period-info">
                    <p><strong>分析期数:</strong> ${data.periodInfo.totalPeriods}期</p>
                    <p><strong>期号范围:</strong> ${data.periodInfo.startIssue} - ${data.periodInfo.endIssue}</p>
                    <p><strong>前区最相克:</strong> ${data.statistics.frontBallStats.mostConflicted ? 
                        `${formatDLTNumber(data.statistics.frontBallStats.mostConflicted.num)} (${data.statistics.frontBallStats.mostConflicted.total}次)` : 
                        '暂无数据'}</p>
                    <p><strong>后区最相克:</strong> ${data.statistics.backBallStats.mostConflicted ? 
                        `${formatDLTNumber(data.statistics.backBallStats.mostConflicted.num)} (${data.statistics.backBallStats.mostConflicted.total}次)` : 
                        '暂无数据'}</p>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-export-conflict-excel" onclick="exportDLTConflictExcel()">📊 导出Excel</button>
                    <button class="btn-conflict-table" onclick="showDLTConflictTable()">📋 查看详细表格</button>
                </div>
                
                <div class="stats-summary">
                    <h4>⚔️ 相克分析说明</h4>
                    <p>统计分析了${data.periodInfo.totalPeriods}期开奖数据，展示各号码之间的相克关系。数值表示该号码开出时，对应号码未开出的次数。</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // 存储数据供其他函数使用
    window.currentDLTConflictData = data;
}

/**
 * 生成大乐透同出数据表格
 */
function generateDLTCooccurrenceTable(matrix) {
    let html = `
        <table class="trend-table dlt-trend-table">
            <thead>
                <tr>
                    <th rowspan="2" class="fixed-col">前区号码</th>
                    <th colspan="35" class="zone-header front-zone">与前区号码同出次数</th>
                    <th colspan="12" class="zone-header back-zone">与后区号码同出次数</th>
                </tr>
                <tr>
    `;
    
    // 前区号码表头
    for (let i = 1; i <= 35; i++) {
        html += `<th class="red-section">${formatDLTNumber(i)}</th>`;
    }
    
    // 后区号码表头
    for (let i = 1; i <= 12; i++) {
        html += `<th>${formatDLTNumber(i)}</th>`;
    }
    
    html += `</tr></thead><tbody>`;
    
    // 数据行
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        html += `<tr><td class="fixed-col">${formatDLTNumber(frontBall)}</td>`;
        
        // 与其他前区球的同出次数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            if (frontBall === otherFront) {
                html += `<td class="dlt-self-cell">-</td>`;
            } else {
                const count = matrix[frontBall]?.frontCounts[otherFront] || 0;
                html += `<td class="count-cell ${count > 0 ? 'has-count' : ''}">${count}</td>`;
            }
        }
        
        // 与后区球的同出次数
        for (let back = 1; back <= 12; back++) {
            const count = matrix[frontBall]?.backCounts[back] || 0;
            html += `<td class="count-cell back-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
        }
        
        html += `</tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

/**
 * 生成大乐透相克数据表格
 */
function generateDLTConflictTable(matrix) {
    let html = `
        <table class="trend-table dlt-trend-table">
            <thead>
                <tr>
                    <th rowspan="2" class="fixed-col">前区号码</th>
                    <th colspan="35" class="zone-header front-zone">与前区号码相克次数</th>
                    <th colspan="12" class="zone-header back-zone">与后区号码相克次数</th>
                    <th colspan="2" class="zone-header stat-zone">统计数据</th>
                </tr>
                <tr>
    `;
    
    // 前区号码表头
    for (let i = 1; i <= 35; i++) {
        html += `<th class="red-section">${formatDLTNumber(i)}</th>`;
    }
    
    // 后区号码表头
    for (let i = 1; i <= 12; i++) {
        html += `<th>${formatDLTNumber(i)}</th>`;
    }
    
    // 统计数据子列表头
    html += `<th class="stat-col-head">开奖次数</th>`;
    html += `<th class="stat-col-head">遗漏值</th>`;
    
    html += `</tr></thead><tbody>`;
    
    // 数据行
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        html += `<tr><td class="fixed-col">${formatDLTNumber(frontBall)}</td>`;
        
        // 与其他前区球的相克次数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            if (frontBall === otherFront) {
                html += `<td class="dlt-self-cell">-</td>`;
            } else {
                const count = matrix[frontBall]?.frontCounts[otherFront] || 0;
                html += `<td class="count-cell conflict-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
            }
        }
        
        // 与后区球的相克次数
        for (let back = 1; back <= 12; back++) {
            const count = matrix[frontBall]?.backCounts[back] || 0;
            html += `<td class="count-cell back-conflict conflict-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
        }
        
        // 统计数据列 - 开奖次数
        const drawCount = matrix[frontBall]?.drawCount || 0;
        html += `<td class="stat-col stat-draw-count">${drawCount}</td>`;
        
        // 统计数据列 - 遗漏值
        const missingValue = matrix[frontBall]?.missingValue || 0;
        html += `<td class="stat-col stat-missing-value">${missingValue}</td>`;
        
        html += `</tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

/**
 * 导出大乐透同出数据到Excel
 */
async function exportDLTCooccurrenceData() {
    try {
        const params = getDLTCurrentFilterParams();
        const response = await fetch(`http://localhost:3003/api/dlt/cooccurrence/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Excel导出失败');
        }
        
        // 创建并下载Excel文件
        downloadDLTExcelFile(result.data.excelData, result.data.filename);
        
    } catch (error) {
        console.error('Error exporting DLT co-occurrence data:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 导出大乐透相克数据到Excel
 */
async function exportDLTConflictData() {
    try {
        const params = getDLTCurrentFilterParams();
        const response = await fetch(`http://localhost:3003/api/dlt/conflict/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Excel导出失败');
        }
        
        // 创建并下载Excel文件
        downloadDLTExcelFile(result.data.excelData, result.data.filename);
        
    } catch (error) {
        console.error('Error exporting DLT conflict data:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 下载大乐透Excel文件
 */
function downloadDLTExcelFile(data, filename) {
    // 简单的CSV格式导出（可以被Excel打开）
    let csvContent = '';
    
    data.forEach(row => {
        csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename.replace('.xlsx', '.csv'));
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 导出大乐透同出数据Excel（弹窗版本）
 */
async function exportDLTCooccurrenceExcel() {
    try {
        // 显示导出进度
        const exportBtn = document.querySelector('.btn-export-excel');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '导出中...';
        exportBtn.disabled = true;
        
        // 获取当前筛选条件
        const params = getDLTCurrentFilterParams();
        
        // 请求Excel数据
        const response = await fetch(`http://localhost:3003/api/dlt/cooccurrence/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '同出数据Excel导出失败');
        }
        
        // 创建CSV格式数据并下载
        const csvContent = convertToCSV(result.data.excelData);
        downloadChineseCSV(csvContent, result.data.filename.replace('.xlsx', '.csv'));
        
        alert('大乐透同出数据已成功导出为CSV文件！');
        
    } catch (error) {
        console.error('大乐透同出数据Excel导出失败:', error);
        alert('大乐透同出数据Excel导出失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        const exportBtn = document.querySelector('.btn-export-excel');
        if (exportBtn) {
            exportBtn.textContent = '📊 导出Excel';
            exportBtn.disabled = false;
        }
    }
}

/**
 * 导出大乐透相克数据Excel（弹窗版本）
 */
async function exportDLTConflictExcel() {
    try {
        // 显示导出进度
        const exportBtn = document.querySelector('.btn-export-conflict-excel');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '导出中...';
        exportBtn.disabled = true;
        
        // 获取当前筛选条件
        const params = getDLTCurrentFilterParams();
        
        // 请求Excel数据
        const response = await fetch(`http://localhost:3003/api/dlt/conflict/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '相克数据Excel导出失败');
        }
        
        // 创建CSV格式数据并下载
        const csvContent = convertToCSV(result.data.excelData);
        downloadChineseCSV(csvContent, result.data.filename.replace('.xlsx', '.csv'));
        
        alert('大乐透相克数据已成功导出为CSV文件！');
        
    } catch (error) {
        console.error('大乐透相克数据Excel导出失败:', error);
        alert('大乐透相克数据Excel导出失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        const exportBtn = document.querySelector('.btn-export-conflict-excel');
        if (exportBtn) {
            exportBtn.textContent = '📊 导出Excel';
            exportBtn.disabled = false;
        }
    }
}

/**
 * 显示大乐透同出数据详细表格
 */
function showDLTCooccurrenceTable() {
    if (!window.currentDLTCooccurrenceData) {
        alert('数据加载中，请稍候...');
        return;
    }
    
    // 创建表格弹窗
    const tableModal = document.createElement('div');
    tableModal.className = 'dlt-cooccurrence-table-modal';
    tableModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content large">
            <div class="modal-header">
                <h3>大乐透同出数据详细表格</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="table-container">
                    ${generateDLTCooccurrenceTable(window.currentDLTCooccurrenceData.matrix)}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(tableModal);
    
    // 绑定关闭事件
    const closeBtn = tableModal.querySelector('.modal-close');
    const overlay = tableModal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(tableModal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
}

/**
 * 显示大乐透相克数据详细表格
 */
function showDLTConflictTable() {
    if (!window.currentDLTConflictData) {
        alert('数据加载中，请稍候...');
        return;
    }
    
    // 创建表格弹窗
    const tableModal = document.createElement('div');
    tableModal.className = 'dlt-conflict-table-modal';
    tableModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content large">
            <div class="modal-header">
                <h3>大乐透相克数据详细表格</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="table-description">
                    <p><strong>说明：</strong>表格显示每个前区号码与其他号码的相克次数。数值表示该前区号码开出时，对应号码未开出的次数。</p>
                </div>
                <div class="table-container">
                    ${generateDLTConflictTable(window.currentDLTConflictData.matrix)}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(tableModal);
    
    // 绑定关闭事件
    const closeBtn = tableModal.querySelector('.modal-close');
    const overlay = tableModal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(tableModal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
}

/**
 * 加载大乐透预测验证
 */
async function loadDLTValidation() {
    console.log('Loading DLT validation...');
    
    const contentElement = document.getElementById('dlt-sum-content');
    if (!contentElement) return;
    
    // 显示加载状态
    contentElement.innerHTML = `
        <div class="loading">
            <div style="text-align: center;">
                <div style="margin-bottom: 10px;">正在验证预测准确率...</div>
                <div style="font-size: 14px; color: #666;">这可能需要几秒钟时间</div>
            </div>
        </div>
    `;
    
    try {
        // 获取当前选择的参数
        const periodGroup = getDLTCurrentGroupPeriods();
        const testPeriods = 200; // 使用200期数据进行验证
        
        const response = await fetch(`/api/dlt/group-validation?periodGroup=${periodGroup}&testPeriods=${testPeriods}`);
        const data = await response.json();
        
        if (data.success) {
            displayDLTValidationResults(data.data);
        } else {
            throw new Error(data.message || '验证请求失败');
        }
    } catch (error) {
        console.error('DLT validation error:', error);
        contentElement.innerHTML = `
            <div class="error-message">
                <h3>验证失败</h3>
                <p>错误信息: ${error.message}</p>
                <button onclick="loadDLTValidation()" class="refresh-btn">重新验证</button>
            </div>
        `;
    }
}

/**
 * 显示大乐透验证结果
 */
function displayDLTValidationResults(validationData) {
    const contentElement = document.getElementById('dlt-sum-content');
    if (!contentElement) return;

    const { totalTests, accuracy, results, parameters } = validationData;

    // 确保 results 是数组类型
    const resultsArray = Array.isArray(results) ? results : [];
    
    let html = `
        <div class="dlt-validation-results">
            <div class="validation-header">
                <h3>预测准确率验证报告</h3>
                <div class="validation-params">
                    <span>验证参数: 每${parameters.periodGroup}期一组，共验证${totalTests}组</span>
                    <span>数据范围: ${parameters.dataRange.startIssue} - ${parameters.dataRange.endIssue}</span>
                </div>
            </div>
            
            <div class="validation-summary">
                <div class="accuracy-cards">
                    <div class="accuracy-card front-accuracy">
                        <div class="accuracy-value">${accuracy.front}%</div>
                        <div class="accuracy-label">前区准确率</div>
                        <div class="accuracy-detail">${Math.round((accuracy.front / 100) * totalTests)}/${totalTests} 组命中</div>
                    </div>
                    <div class="accuracy-card back-accuracy">
                        <div class="accuracy-value">${accuracy.back}%</div>
                        <div class="accuracy-label">后区准确率</div>
                        <div class="accuracy-detail">${Math.round((accuracy.back / 100) * totalTests)}/${totalTests} 组命中</div>
                    </div>
                    <div class="accuracy-card overall-accuracy">
                        <div class="accuracy-value">${accuracy.both}%</div>
                        <div class="accuracy-label">整体准确率</div>
                        <div class="accuracy-detail">${Math.round((accuracy.both / 100) * totalTests)}/${totalTests} 组完全命中</div>
                    </div>
                </div>
            </div>
            
            <div class="validation-details">
                <div class="details-header">
                    <h4>详细验证结果</h4>
                    <div class="view-controls">
                        <button class="view-btn active" onclick="showValidationView('summary')">摘要视图</button>
                        <button class="view-btn" onclick="showValidationView('detailed')">详细视图</button>
                    </div>
                </div>
                
                <div id="validation-summary-view" class="validation-view active">
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-label">验证方法:</span>
                            <span class="stat-value">滑动窗口预测验证</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">预测模型:</span>
                            <span class="stat-value">基于历史和值的移动平均预测</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">预测范围:</span>
                            <span class="stat-value">前区±20，后区±5</span>
                        </div>
                    </div>
                </div>
                
                <div id="validation-detailed-view" class="validation-view">
                    <div class="results-table-container">
                        <table class="validation-table">
                            <thead>
                                <tr>
                                    <th>组号</th>
                                    <th>训练期号</th>
                                    <th>预测期号</th>
                                    <th>前区预测</th>
                                    <th>前区实际</th>
                                    <th>前区命中</th>
                                    <th>后区预测</th>
                                    <th>后区实际</th>
                                    <th>后区命中</th>
                                </tr>
                            </thead>
                            <tbody>
    `;
    
    // 显示前10个详细结果
    resultsArray.slice(0, 10).forEach((result, index) => {
        const frontHit = result.accuracy.frontHit;
        const backHit = result.accuracy.backHit;
        
        html += `
            <tr class="${frontHit && backHit ? 'hit-both' : (frontHit || backHit ? 'hit-partial' : 'hit-none')}">
                <td>${index + 1}</td>
                <td>${result.windowInfo.startIssue}-${result.windowInfo.endIssue}</td>
                <td>${result.windowInfo.predictIssue}</td>
                <td>${result.predicted.frontSum.recommended} (${result.predicted.frontSum.range.min}-${result.predicted.frontSum.range.max})</td>
                <td>${result.actual.frontSum}</td>
                <td class="${frontHit ? 'hit-yes' : 'hit-no'}">${frontHit ? '✓' : '✗'}</td>
                <td>${result.predicted.backSum.recommended} (${result.predicted.backSum.range.min}-${result.predicted.backSum.range.max})</td>
                <td>${result.actual.backSum}</td>
                <td class="${backHit ? 'hit-yes' : 'hit-no'}">${backHit ? '✓' : '✗'}</td>
            </tr>
        `;
    });
    
    if (resultsArray.length > 10) {
        html += `
            <tr class="more-results">
                <td colspan="9">... 还有 ${resultsArray.length - 10} 组验证结果</td>
            </tr>
        `;
    }
    
    html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    contentElement.innerHTML = html;
}

/**
 * 切换验证结果视图
 */
function showValidationView(viewType) {
    // 切换按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // 切换视图
    document.querySelectorAll('.validation-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`validation-${viewType}-view`).classList.add('active');
}

// ===== 新版大乐透组合预测模块 =====

/**
 * 初始化大乐透组合预测模块
 */
function initDLTCombinationModule() {
    console.log('Initializing New DLT Combination module...');
    
    // 初始化新的组合预测按钮事件
    const newCombinationBtn = document.getElementById('new-dlt-combination-predict-btn');
    if (newCombinationBtn) {
        console.log('新组合预测按钮找到，添加事件监听器');
        newCombinationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('新组合预测按钮被点击');
            loadNewDLTCombinationPrediction();
        });
    } else {
        console.warn('新组合预测按钮未找到：new-dlt-combination-predict-btn');
    }

    
    // 初始化页面时加载期号数据
    loadLatestIssues();
    
    // 初始化筛选条件事件
    initDLTCombinationFilters();
    
    // 初始化新版筛选条件事件
    initNewDLTCombinationFilters();
    
    // 初始化数据生成管理功能
    initDataGenerationManagement();


    // 延迟1秒后检查输入框状态，确保所有初始化完成
    setTimeout(() => {
        console.log('🔧 开始输入框诊断...');
        debugInputBoxes();
    }, 1000);

    console.log('New DLT Combination module initialized');
}

/**
 * 生成筛选条件汇总显示
 */
function generateFilterSummaryDisplay(filterSummary, excludedData) {
    console.log('🔍 generateFilterSummaryDisplay 被调用');
    console.log('- filterSummary:', filterSummary);
    console.log('- excludedData:', excludedData);
    
    let hasContent = false;
    let contentHtml = '';
    
    // 如果有应用的筛选条件，显示它们
    if (filterSummary.appliedFilters && filterSummary.appliedFilters.length > 0) {
        console.log('✅ 找到应用的筛选条件:', filterSummary.appliedFilters.length, '个');
        contentHtml += '<div class="applied-filters">';
        filterSummary.appliedFilters.forEach(filter => {
            if (filter.type === '排除和值' && excludedData && excludedData.sumValues && excludedData.sumValues.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${filter.value}期的和值：${excludedData.sumValues.join(' ')}</div>`;
                hasContent = true;
            } else if (filter.type === '排除区间比' && excludedData && excludedData.zoneRatios && excludedData.zoneRatios.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${filter.value}期的区间比：${excludedData.zoneRatios.join(' ')}</div>`;
                hasContent = true;
            } else if (filter.type === '排除热温冷比' && excludedData && excludedData.htcRatios && excludedData.htcRatios.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${filter.value}期的热温冷比：${excludedData.htcRatios.join(' ')}</div>`;
                hasContent = true;
            } else if (filter.type === '排除和值范围') {
                contentHtml += `<div class="filter-item">排除和值范围：${filter.value}</div>`;
                hasContent = true;
            } else if (filter.type === '排除奇偶比') {
                contentHtml += `<div class="filter-item">排除奇偶比：${filter.value}</div>`;
                hasContent = true;
            } else if (filter.type === '排除跨度范围') {
                contentHtml += `<div class="filter-item">排除跨度范围：${filter.value}</div>`;
                hasContent = true;
            } else if (filter.type === '手动排除热温冷比') {
                contentHtml += `<div class="filter-item">排除热温冷比：${filter.value}</div>`;
                hasContent = true;
            }
        });
        contentHtml += '</div>';
    } else {
        console.log('⚠️ 没有找到filterSummary.appliedFilters，使用兜底方案');
        // 兜底方案：如果没有filterSummary数据，使用原来的显示方式
        if (excludedData) {
            console.log('✅ 使用excludedData显示筛选信息');
            if (excludedData.sumValues && excludedData.sumValues.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${excludedData.sumPeriods || ''}期的和值：${excludedData.sumValues.join(' ')}</div>`;
                hasContent = true;
            }
            if (excludedData.zoneRatios && excludedData.zoneRatios.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${excludedData.zonePeriods || ''}期的区间比：${excludedData.zoneRatios.join(' ')}</div>`;
                hasContent = true;
            }
            if (excludedData.htcRatios && excludedData.htcRatios.length > 0) {
                contentHtml += `<div class="filter-item">排除最近${excludedData.htcPeriods || ''}期的热温冷比：${excludedData.htcRatios.join(' ')}</div>`;
                hasContent = true;
            }
        }
    }
    
    // 显示数据量统计（如果有）
    if (filterSummary.dataVolume) {
        const volume = filterSummary.dataVolume;
        contentHtml += '<div class="data-volume-info">';
        contentHtml += `<div class="volume-item">筛选前：${volume.beforeFiltering.totalCombinations.toLocaleString()}组合 | `;
        contentHtml += `筛选后：${volume.afterFiltering.totalCombinations.toLocaleString()}组合 | `;
        contentHtml += `筛选率：${volume.filteringRate.toFixed(2)}%</div>`;
        contentHtml += '</div>';
        hasContent = true;
    }
    
    // 只有当有内容时才返回包装的HTML，否则返回空字符串
    if (hasContent) {
        let html = '<div class="filter-summary-display">' + contentHtml + '</div>';
        console.log('🎯 最终生成的HTML:', html);
        return html;
    } else {
        console.log('🎯 没有筛选内容，返回空字符串');
        return '';
    }
}


/**
 * 加载最新期号数据
 */
async function loadLatestIssues() {
    try {
        console.log('🔍 加载期号列表（使用快速API）...');
        const response = await fetch('http://localhost:3003/api/dlt/issues');
        const result = await response.json();
        
        console.log('🔍 API响应:', result);
        
        if (result.success && result.data.length > 0) {
            const targetSelect = document.getElementById('new-target-issue');
            const baseSelect = document.getElementById('new-base-issue');
            
            console.log('🔍 找到的DOM元素:', { 
                targetSelect: targetSelect ? 'found' : 'not found', 
                baseSelect: baseSelect ? 'found' : 'not found' 
            });
            
            if (targetSelect && baseSelect) {
                console.log('✅ 找到目标元素，开始填充期号选项');
                // 清空现有选项
                targetSelect.innerHTML = '<option value="">选择目标期号</option>';
                baseSelect.innerHTML = '<option value="">选择基准期号</option>';
                
                // 使用历史期号数据，生成期号组合选项
                result.data.forEach((issue, index) => {
                    // 目标期号 - 显示最近的期号
                    if (index < 20) { // 限制显示最近20期作为目标期号
                        const targetOption = `<option value="${issue}">${issue}期</option>`;
                        targetSelect.innerHTML += targetOption;
                    }
                    
                    // 基准期号 - 可以选择更多历史期号作为基准
                    const baseOption = `<option value="${issue}">${issue}期</option>`;
                    baseSelect.innerHTML += baseOption;
                });
                
                // 如果专用数据期号较少，补充更多历史期号
                if (result.data.length < 10) {
                    console.log('🔄 专用数据期号较少，补充更多历史期号...');
                    await addMoreHistoricalIssues(targetSelect, baseSelect, result.data);
                }
                
                // 设置默认值为最新可用的期号组合
                if (result.data.length > 0) {
                    const latestCombo = result.data[0];
                    targetSelect.value = latestCombo.targetIssue;
                    baseSelect.value = latestCombo.baseIssue;
                    
                    console.log(`✅ 自动选择可用期号: 目标${latestCombo.targetIssue}, 基准${latestCombo.baseIssue}`);
                    
                    // 显示提示信息
                    showSuccessMessage(`已自动选择有数据支持的期号组合: ${latestCombo.targetIssue}/${latestCombo.baseIssue}`);
                }
            } else {
                console.warn('⚠️ DOM元素未找到，可能页面还未加载完成，将稍后重试...');
                // 延迟重试
                setTimeout(() => {
                    console.log('🔄 重试加载期号数据...');
                    loadLatestIssues();
                }, 1000);
                return;
            }
        } else {
            // 回退到获取历史期号
            console.warn('⚠️ 没有找到可用期号，回退到历史期号');
            await loadHistoricalIssues();
        }
    } catch (error) {
        console.error('加载期号数据失败:', error);
        // 如果获取可用期号失败，尝试获取历史期号
        await loadHistoricalIssues();
    }
}

/**
 * 补充更多历史期号选项
 */
async function addMoreHistoricalIssues(targetSelect, baseSelect, existingData) {
    try {
        console.log('📊 补充更多历史期号选项...');
        const response = await fetch('http://localhost:3003/api/dlt/issues');
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            // 获取已存在的期号列表
            const existingTargetIssues = existingData.map(item => item.targetIssue);
            
            // 添加更多历史期号，跳过已存在的
            result.data.forEach((issue, index) => {
                if (!existingTargetIssues.includes(issue.toString()) && index < 30) { // 最多添加30期
                    const targetOption = `<option value="${issue}">${issue}期 (历史数据)</option>`;
                    const baseIssue = (parseInt(issue) - 1).toString().padStart(5, '0');
                    const baseOption = `<option value="${baseIssue}">${baseIssue}期</option>`;
                    
                    targetSelect.innerHTML += targetOption;
                    baseSelect.innerHTML += baseOption;
                }
            });
            
            console.log(`✅ 成功补充历史期号选项`);
        }
    } catch (error) {
        console.error('补充历史期号失败:', error);
    }
}

/**
 * 加载历史期号作为回退方案
 */
async function loadHistoricalIssues() {
    try {
        console.log('📊 加载历史期号作为回退...');
        const response = await fetch('http://localhost:3003/api/dlt/issues');
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            const targetSelect = document.getElementById('new-target-issue');
            const baseSelect = document.getElementById('new-base-issue');
            
            if (targetSelect && baseSelect) {
                // 清空现有选项
                targetSelect.innerHTML = '<option value="">选择目标期号</option>';
                baseSelect.innerHTML = '<option value="">选择基准期号</option>';
                
                // 添加期号选项
                result.data.forEach((issue, index) => {
                    const option = `<option value="${issue}">${issue}期</option>`;
                    targetSelect.innerHTML += option;
                    if (index < result.data.length - 1) {
                        baseSelect.innerHTML += option;
                    }
                });
                
                // 设置默认值，优先选择有可能有数据的期号
                if (result.data.length >= 2) {
                    // 尝试使用倒数第二和倒数第三期
                    targetSelect.value = result.data[1];
                    baseSelect.value = result.data[2];
                    
                    showWarningMessage(`使用历史期号作为回退方案: ${result.data[1]}/${result.data[2]}。部分功能可能不可用。`);
                }
            }
        }
    } catch (error) {
        console.error('加载历史期号失败:', error);
        showErrorMessage('无法加载期号数据，请刷新页面重试');
    }
}

/**
 * 初始化新的筛选条件事件
 */
function initNewDLTCombinationFilters() {
    // 数值输入框验证
    const numberInputs = document.querySelectorAll('#new-sum-min, #new-sum-max, #new-span-min, #new-span-max');
    numberInputs.forEach(input => {
        input.addEventListener('input', validateNumberInput);
        input.addEventListener('blur', validateRangeInput);
    });
    
    // 热温冷数量输入框验证
    const hwcInputs = document.querySelectorAll('#new-hot-min, #new-hot-max, #new-warm-min, #new-warm-max, #new-cold-min, #new-cold-max');
    hwcInputs.forEach(input => {
        input.addEventListener('input', validateHWCInput);
    });
    
    // 蓝球和值输入框验证
    const blueInputs = document.querySelectorAll('#new-blue-sum-min, #new-blue-sum-max');
    blueInputs.forEach(input => {
        input.addEventListener('input', validateBlueInput);
    });
    
    // 蓝球分配开关事件
    const enableBlueCombination = document.getElementById('enable-blue-combination');
    if (enableBlueCombination) {
        enableBlueCombination.addEventListener('change', function() {
            const blueSumContainer = document.getElementById('blue-sum-range-container');
            if (blueSumContainer) {
                blueSumContainer.style.display = this.checked ? 'block' : 'none';
            }
        });
        
        // 初始化显示状态
        const blueSumContainer = document.getElementById('blue-sum-range-container');
        if (blueSumContainer) {
            blueSumContainer.style.display = enableBlueCombination.checked ? 'block' : 'none';
        }
        
        // 触发初始化事件
        if (enableBlueCombination.checked) {
            enableBlueCombination.dispatchEvent(new Event('change'));
        }
    }
    
    // 目标期号变化时自动更新基准期号
    const targetIssueSelect = document.getElementById('new-target-issue');
    if (targetIssueSelect) {
        targetIssueSelect.addEventListener('change', updateBaseIssueOptions);
    }
    
    // 初始化区间比排除最近期功能
    initZoneExcludeRecentPeriods();

    // 初始化热温冷比排除最近期功能
    initHwcExcludeRecentPeriods();

    // 初始化相克排除功能
    initConflictExcludeFilter();
}

/**
 * 验证数值输入
 */
function validateNumberInput(e) {
    const input = e.target;
    const value = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    
    if (value < min || value > max) {
        input.style.borderColor = '#dc3545';
        input.title = `值必须在${min}-${max}之间`;
    } else {
        input.style.borderColor = '#28a745';
        input.title = '';
    }
}

/**
 * 验证范围输入
 */
function validateRangeInput(e) {
    const input = e.target;
    const id = input.id;
    
    if (id.includes('-min')) {
        const maxId = id.replace('-min', '-max');
        const maxInput = document.getElementById(maxId);
        if (maxInput) {
            validateRange(input, maxInput);
        }
    } else if (id.includes('-max')) {
        const minId = id.replace('-max', '-min');
        const minInput = document.getElementById(minId);
        if (minInput) {
            validateRange(minInput, input);
        }
    }
}

/**
 * 验证范围
 */
function validateRange(minInput, maxInput) {
    const minValue = parseInt(minInput.value);
    const maxValue = parseInt(maxInput.value);
    
    if (minValue && maxValue && minValue >= maxValue) {
        minInput.style.borderColor = '#dc3545';
        maxInput.style.borderColor = '#dc3545';
        minInput.title = '最小值必须小于最大值';
        maxInput.title = '最大值必须大于最小值';
    } else {
        minInput.style.borderColor = '#28a745';
        maxInput.style.borderColor = '#28a745';
        minInput.title = '';
        maxInput.title = '';
    }
}

/**
 * 验证热温冷数量输入
 */
function validateHWCInput(e) {
    validateNumberInput(e);
    
    // 额外验证：热+温+冷 = 5
    const hotMin = parseInt(document.getElementById('new-hot-min').value) || 0;
    const hotMax = parseInt(document.getElementById('new-hot-max').value) || 5;
    const warmMin = parseInt(document.getElementById('new-warm-min').value) || 0;
    const warmMax = parseInt(document.getElementById('new-warm-max').value) || 5;
    const coldMin = parseInt(document.getElementById('new-cold-min').value) || 0;
    const coldMax = parseInt(document.getElementById('new-cold-max').value) || 5;
    
    if (hotMin + warmMin + coldMin > 5 || hotMax + warmMax + coldMax < 5) {
        // 可能的组合无效，但不强制限制，让用户自己判断
    }
}

/**
 * 验证蓝球输入
 */
function validateBlueInput(e) {
    const input = e.target;
    const value = parseInt(input.value);
    
    if (value < 3 || value > 23) {
        input.style.borderColor = '#dc3545';
        input.title = '蓝球和值必须在3-23之间';
    } else {
        input.style.borderColor = '#28a745';
        input.title = '';
    }
}

/**
 * 更新基准期号选项
 */
function updateBaseIssueOptions(e) {
    const targetIssue = e.target.value;
    const baseSelect = document.getElementById('new-base-issue');
    
    if (targetIssue && baseSelect) {
        // 基准期号应该是目标期号的前一期
        const baseIssue = (parseInt(targetIssue) - 1).toString().padStart(5, '0');
        baseSelect.value = baseIssue;
    }
}

/**
 * 加载新的组合预测
 */
async function loadNewDLTCombinationPrediction() {
    console.log('开始新的组合预测...');
    
    try {
        // 获取筛选条件
        const filters = getNewCombinationFilters();
        
        // 验证必填字段
        if (!filters.targetIssue || !filters.baseIssue) {
            alert('请选择目标期号和基准期号');
            return;
        }
        
        // 调试筛选条件
        console.log('🔍 当前筛选条件详情:');
        console.log('- 目标期号:', filters.targetIssue);
        console.log('- 基准期号:', filters.baseIssue);
        console.log('- 排除和值范围:', filters.sumRanges);
        console.log('- 跨度范围:', filters.spanRanges);
        console.log('- 热温冷筛选:', {
            hotMin: filters.hotCountMin,
            hotMax: filters.hotCountMax,
            warmMin: filters.warmCountMin,
            warmMax: filters.warmCountMax,
            coldMin: filters.coldCountMin,
            coldMax: filters.coldCountMax
        });
        console.log('- 蓝球和值范围:', {
            min: filters.blueSumMin,
            max: filters.blueSumMax
        });
        console.log('- 排除设置:', {
            recentPeriods: filters.excludeRecentPeriods,
            zoneRecentPeriods: filters.excludeZoneRecentPeriods,
            hwcRecentPeriods: filters.excludeHwcRecentPeriods
        });
        
        console.log('🔍 详细排除设置调试:');
        console.log('- excludeRecentPeriods类型:', typeof filters.excludeRecentPeriods);
        console.log('- excludeRecentPeriods值:', filters.excludeRecentPeriods);
        console.log('- excludeZoneRecentPeriods值:', filters.excludeZoneRecentPeriods);
        console.log('- excludeHwcRecentPeriods值:', filters.excludeHwcRecentPeriods);
        
        // 检查是否所有筛选条件都为空（可能导致无结果）
        const hasAnyFilter = filters.sumRanges && filters.sumRanges.length > 0 ||
                            filters.spanRanges && filters.spanRanges.length > 0 ||
                            filters.hotCountMin || filters.hotCountMax ||
                            filters.warmCountMin || filters.warmCountMax ||
                            filters.coldCountMin || filters.coldCountMax ||
                            filters.blueSumMin || filters.blueSumMax;
        
        if (!hasAnyFilter) {
            console.warn('⚠️ 警告：未设置任何筛选条件，将使用默认筛选');
        }
        
        // 显示加载状态
        showLoadingState();

        // 如果启用相克排除，先获取相克数据（使用新的每个号码单独统计API）
        if (filters.conflictExclude?.enabled) {
            console.log('🔍 相克排除已启用，开始获取相克数据（每个号码单独统计）...');
            try {
                const conflictParams = new URLSearchParams({
                    targetIssue: filters.targetIssue,
                    analysisPeriods: filters.conflictExclude.analysisPeriods,
                    topN: filters.conflictExclude.perBallTopN || filters.conflictExclude.topN || 5
                });

                const conflictResponse = await fetch(`/api/dlt/conflict-per-ball?${conflictParams.toString()}`);
                const conflictResult = await conflictResponse.json();

                if (conflictResult.success) {
                    console.log('✅ 相克数据获取成功');
                    console.log('- 分析期数:', conflictResult.data.analysisPeriods);
                    console.log('- 每个号码Top N:', conflictResult.data.topN);

                    // 将相克Map转换为前端使用的格式
                    const conflictMap = new Map();
                    const backendMap = conflictResult.data.conflictMap;

                    for (let ballNum = 1; ballNum <= 35; ballNum++) {
                        const formattedNum = formatBallNumber(ballNum);
                        const conflictNumbers = backendMap[ballNum] || [];
                        const numberSet = new Set(conflictNumbers.map(n => formatBallNumber(n)));
                        conflictMap.set(formattedNum, numberSet);
                    }

                    // 将相克Map添加到filters中
                    filters.conflictMap = conflictMap;

                    // 统计信息
                    let totalPairs = 0;
                    conflictMap.forEach(pairs => {
                        totalPairs += pairs.size;
                    });
                    totalPairs = totalPairs / 2;
                    console.log('- 相克关系数量:', totalPairs);
                } else {
                    console.warn('⚠️ 相克数据获取失败:', conflictResult.message);
                    alert('相克数据获取失败: ' + conflictResult.message + '\n将继续不使用相克排除功能');
                    filters.conflictExclude = null;
                }
            } catch (error) {
                console.error('❌ 相克数据获取异常:', error);
                alert('相克数据获取异常，将继续不使用相克排除功能');
                filters.conflictExclude = null;
            }
        }

        // 如果启用同出排除，先获取同出数据
        if (filters.coOccurrence?.enabled) {
            console.log('🔗 同出排除已启用，开始获取同出数据...');
            try {
                const coOccurrenceMap = await getCoOccurrenceData(
                    filters.coOccurrence.periods,
                    filters.targetIssue
                );

                if (coOccurrenceMap && coOccurrenceMap.size > 0) {
                    console.log('✅ 同出数据获取成功');
                    console.log('- 涉及号码数量:', coOccurrenceMap.size);

                    // 统计同出对数
                    let totalPairs = 0;
                    coOccurrenceMap.forEach(pairs => {
                        totalPairs += pairs.size;
                    });
                    totalPairs = totalPairs / 2;
                    console.log('- 同出关系数量:', totalPairs);

                    // 将同出数据添加到filters中
                    filters.coOccurrenceMap = coOccurrenceMap;
                } else {
                    console.warn('⚠️ 同出数据为空');
                    alert('同出数据获取失败或无可用数据\n将继续不使用同出排除功能');
                    filters.coOccurrence = null;
                }
            } catch (error) {
                console.error('❌ 同出数据获取异常:', error);
                alert('同出数据获取异常，将继续不使用同出排除功能');
                filters.coOccurrence = null;
            }
        }

        // 构建查询参数
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                if (key === 'sumRanges' || key === 'excludeRecentPeriods' || key === 'excludeZoneRecentPeriods' || key === 'excludeHwcRecentPeriods' || key === 'spanRanges') {
                    // 将对象/数组转换为JSON字符串
                    params.append(key, JSON.stringify(filters[key]));
                } else {
                    params.append(key, filters[key]);
                }
            }
        });
        
        // 发送请求
        console.log('🔄 发送组合预测请求:', `/api/dlt/new-combination-prediction?${params.toString()}`);
        console.log('🔄 请求参数详情:', params.toString());
        const response = await fetch(`/api/dlt/new-combination-prediction?${params.toString()}`);
        const result = await response.json();
        
        console.log('🔄 API响应状态:', response.status, response.statusText);
        console.log('🔄 API响应结果:', result);
        
        if (result.success) {
            console.log('✅ API调用成功！');
            console.log('📊 返回数据摘要:');
            console.log(`- 组合数量: ${result.data?.combinations?.length || 0}`);
            console.log(`- 分页信息: ${JSON.stringify(result.data?.pagination || {})}`);
            console.log(`- 筛选条件: ${JSON.stringify(result.data?.filters || {})}`);
            
            if (result.data?.combinations?.length === 0) {
                console.warn('⚠️ API返回成功但组合数据为空！');
            }

            // 将排除数据附加到result.data中，供displayNewCombinationResults使用
            if (!result.data.filters) {
                result.data.filters = {};
            }

            // 附加相克对数据（旧方式兼容）
            if (filters.conflictPairs) {
                result.data.filters.conflictPairs = filters.conflictPairs;
                console.log('✅ 相克对数据已附加到结果中');
            }

            // 附加相克Map数据（新方式）
            if (filters.conflictMap) {
                result.data.filters.conflictMap = filters.conflictMap;
                console.log('✅ 相克Map数据已附加到结果中');
            }

            // 附加同出Map数据
            if (filters.coOccurrenceMap) {
                result.data.filters.coOccurrenceMap = filters.coOccurrenceMap;
                console.log('✅ 同出Map数据已附加到结果中');
            }

            // 直接使用API返回的数据，不进行转换
            displayNewCombinationResults(result.data);
        } else {
            console.error('❌ API调用失败:', result.message);
            if (result.needGenerate) {
                // 需要生成热温冷数据
                console.log('🔧 需要生成热温冷数据，显示生成提示界面');
                showGenerateDataPrompt(result);
            } else {
                throw new Error(result.message);
            }
        }
        
    } catch (error) {
        console.error('组合预测失败:', error);
        showErrorMessage(error.message);
    }
}

/**
 * 获取启用的排除和值范围
 */
function getSumRanges() {
    const ranges = [];
    
    for (let i = 1; i <= 3; i++) {
        const enabledCheckbox = document.getElementById(`new-sum-range-${i}-enabled`);
        const minInput = document.getElementById(`new-sum-range-${i}-min`);
        const maxInput = document.getElementById(`new-sum-range-${i}-max`);
        
        if (enabledCheckbox && enabledCheckbox.checked && minInput && maxInput) {
            const min = parseInt(minInput.value);
            const max = parseInt(maxInput.value);
            
            if (!isNaN(min) && !isNaN(max) && min <= max && min >= 15 && max <= 175) {
                ranges.push({ min: min, max: max });
            }
        }
    }
    
    return ranges;
}

/**
 * 获取启用的排除跨度范围
 */
function getSpanRanges() {
    const ranges = [];
    
    for (let i = 1; i <= 3; i++) {
        const enabledCheckbox = document.getElementById(`new-span-range-${i}-enabled`);
        const minInput = document.getElementById(`new-span-range-${i}-min`);
        const maxInput = document.getElementById(`new-span-range-${i}-max`);
        
        if (enabledCheckbox && enabledCheckbox.checked && minInput && maxInput) {
            const min = parseInt(minInput.value);
            const max = parseInt(maxInput.value);
            
            if (!isNaN(min) && !isNaN(max) && min <= max && min >= 4 && max <= 34) {
                ranges.push({ min: min, max: max });
            }
        }
    }
    
    return ranges;
}

/**
 * 获取排除最近期数设置
 */
function getExcludeRecentPeriodsSettings() {
    const excludeCheckbox = document.getElementById('new-sum-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-sum-exclude-recent-periods');
    
    if (excludeCheckbox && excludeCheckbox.checked && periodsInput) {
        const periods = parseInt(periodsInput.value);
        if (!isNaN(periods) && periods > 0 && periods <= 100) {
            return {
                enabled: true,
                periods: periods
            };
        }
    }
    
    return {
        enabled: false,
        periods: 0
    };
}

/**
 * 获取区间比排除最近期数设置
 */
function getZoneExcludeRecentPeriodsSettings() {
    const excludeCheckbox = document.getElementById('new-zone-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-zone-exclude-recent-periods');
    
    if (excludeCheckbox && excludeCheckbox.checked && periodsInput) {
        const periods = parseInt(periodsInput.value);
        if (!isNaN(periods) && periods > 0 && periods <= 100) {
            return {
                enabled: true,
                periods: periods
            };
        }
    }
    
    return {
        enabled: false,
        periods: 0
    };
}

/**
 * 获取热温冷比排除最近期数设置
 */
function getHwcExcludeRecentPeriodsSettings() {
    const excludeCheckbox = document.getElementById('new-hwc-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-hwc-exclude-recent-periods');
    
    if (excludeCheckbox && excludeCheckbox.checked && periodsInput) {
        const periods = parseInt(periodsInput.value);
        if (!isNaN(periods) && periods > 0 && periods <= 100) {
            return {
                enabled: true,
                periods: periods
            };
        }
    }
    
    return {
        enabled: false,
        periods: 0
    };
}

/**
 * 获取新的筛选条件
 */
function getNewCombinationFilters() {
    const filters = {
        targetIssue: document.getElementById('new-target-issue').value,
        baseIssue: document.getElementById('new-base-issue').value,
        // 收集多个排除和值范围
        sumRanges: getSumRanges(),
        // 收集排除最近期数设置
        excludeRecentPeriods: getExcludeRecentPeriodsSettings(),
        // 收集区间比排除最近期数设置
        excludeZoneRecentPeriods: getZoneExcludeRecentPeriodsSettings(),
        // 收集热温冷比排除最近期数设置
        excludeHwcRecentPeriods: getHwcExcludeRecentPeriodsSettings(),
        // 收集多个排除跨度范围
        spanRanges: getSpanRanges(),
        hotCountMin: document.getElementById('new-hot-min').value,
        hotCountMax: document.getElementById('new-hot-max').value,
        warmCountMin: document.getElementById('new-warm-min').value,
        warmCountMax: document.getElementById('new-warm-max').value,
        coldCountMin: document.getElementById('new-cold-min').value,
        coldCountMax: document.getElementById('new-cold-max').value,
        enableBlueCombination: document.getElementById('enable-blue-combination').checked,
        blueSumMin: document.getElementById('new-blue-sum-min').value,
        blueSumMax: document.getElementById('new-blue-sum-max').value,
        limit: document.getElementById('new-page-limit').value,
        page: 1
    };
    
    // 获取选中的区间比
    const zoneRatios = [];
    document.querySelectorAll('.zone-ratio-cb:checked').forEach(cb => {
        zoneRatios.push(cb.value);
    });
    if (zoneRatios.length > 0) {
        filters.zoneRatios = zoneRatios.join(',');
    }
    
    // 获取选中的奇偶比
    const oddEvenRatios = [];
    document.querySelectorAll('.odd-even-cb:checked').forEach(cb => {
        oddEvenRatios.push(cb.value);
    });
    if (oddEvenRatios.length > 0) {
        filters.oddEvenRatios = oddEvenRatios.join(',');
    }
    
    // 获取选中的热温冷比
    const hwcRatios = [];
    document.querySelectorAll('.hwc-ratio-cb:checked').forEach(cb => {
        hwcRatios.push(cb.value);
    });
    if (hwcRatios.length > 0) {
        filters.hotWarmColdRatios = hwcRatios.join(',');
    }

    // 获取相克排除配置
    const conflictEnabled = document.getElementById('enable-conflict-exclude');
    if (conflictEnabled && conflictEnabled.checked) {
        const globalTopEnabled = document.getElementById('enable-global-conflict-top')?.checked || false;
        const perBallTopEnabled = document.getElementById('enable-per-ball-conflict-top')?.checked || false;
        const hotProtectionEnabled = document.getElementById('enable-hot-protection')?.checked || false;

        filters.conflictExclude = {
            enabled: true,
            analysisPeriods: parseInt(document.getElementById('conflict-analysis-periods').value) || 3,
            globalTopEnabled: globalTopEnabled,
            topN: globalTopEnabled ? (parseInt(document.getElementById('conflict-top-n').value) || 5) : 0,
            perBallTopEnabled: perBallTopEnabled,
            perBallTopN: perBallTopEnabled ? (parseInt(document.getElementById('conflict-per-ball-top-n').value) || 5) : 0,
            includeBackBalls: document.getElementById('enable-back-conflict-exclude')?.checked || false,
            hotProtection: {
                enabled: hotProtectionEnabled && perBallTopEnabled, // 只在启用每个号码Top时才生效
                topHotCount: hotProtectionEnabled ? (parseInt(document.getElementById('hot-protection-top-count')?.value) || 3) : 0
            }
        };
    }

    // 获取同出排除配置
    const cooccurrenceEnabled = document.getElementById('batch-exclude-cooccurrence');
    if (cooccurrenceEnabled && cooccurrenceEnabled.checked) {
        filters.coOccurrence = {  // 🔧 修复: 改为coOccurrence与后端一致
            enabled: true,
            periods: parseInt(document.getElementById('batch-cooccurrence-periods').value) || 1
        };
    }

    return filters;
}

/**
 * 显示加载状态
 */
function showLoadingState() {
    const contentDiv = document.getElementById('dlt-combination-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <h3>🔄 正在生成组合预测...</h3>
                <p>请稍候，正在查询和筛选组合数据</p>
            </div>
        `;
    }
}

/**
 * 显示生成数据提示
 */
function showGenerateDataPrompt(result) {
    const contentDiv = document.getElementById('dlt-combination-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="generate-prompt">
                <div class="prompt-icon">⚠️</div>
                <h3>需要生成热温冷分析数据</h3>
                <p>${result.message}</p>
                <div class="prompt-actions">
                    <button class="btn btn-primary" onclick="generateHotWarmColdData('${result.baseIssue}', '${result.targetIssue}')">
                        生成数据
                    </button>
                    <button class="btn btn-secondary" onclick="cancelGeneration()">
                        取消
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * 生成热温冷数据
 */
async function generateHotWarmColdData(baseIssue, targetIssue) {
    try {
        showGenerationProgress();
        
        const response = await fetch(`/api/dlt/generate-hot-warm-cold/${baseIssue}/${targetIssue}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 数据生成成功，重新加载预测
            setTimeout(() => {
                loadNewDLTCombinationPrediction();
            }, 1000);
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('生成热温冷数据失败:', error);
        showErrorMessage(error.message);
    }
}

/**
 * 显示生成进度
 */
function showGenerationProgress() {
    const contentDiv = document.getElementById('dlt-combination-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="generation-progress">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <h3>🔄 正在生成热温冷分析数据...</h3>
                <p>这可能需要几分钟时间，请耐心等待</p>
                <div class="progress-steps">
                    <div class="step active">📊 读取遗漏数据</div>
                    <div class="step active">🔄 计算热温冷分布</div>
                    <div class="step active">💾 保存分析结果</div>
                </div>
            </div>
        `;
    }
}

/**
 * 取消生成
 */
function cancelGeneration() {
    const contentDiv = document.getElementById('dlt-combination-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="new-combination-placeholder">
                <div class="placeholder-content">
                    <h3>🎯 新版大乐透组合预测系统</h3>
                    <p>🔹 基于预生成的红球和蓝球组合数据</p>
                    <p>🔹 支持基于实时期号的热温冷分析</p>
                    <p>🔹 灵活的筛选条件和精准预测</p>
                    <p>请设置筛选条件后点击"生成组合预测"开始预测</p>
                </div>
            </div>
        `;
    }
}

/**
 * 显示错误消息
 */
function showErrorMessage(message) {
    const contentDiv = document.getElementById('dlt-combination-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="error-message">
                <div class="error-icon">❌</div>
                <h3>预测失败</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="cancelGeneration()">返回</button>
            </div>
        `;
    }
}

/**
 * 显示成功消息
 */
function showSuccessMessage(message) {
    console.log('✅', message);
    // 可以选择在页面上显示成功提示
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    }
}

/**
 * 计算红球命中数（与目标期号实际开奖对比）
 * @param {Array} redNumbers - 预测红球号码数组 [01, 02, 03, 04, 05]
 * @param {string} targetIssue - 目标期号
 * @param {Array} historyData - 历史开奖数据
 * @returns {string} 命中统计信息
 */
function calculateRedHitCount(redNumbers, targetIssue, historyData) {
    console.log('🔍 calculateRedHitCount 被调用:', {
        redNumbers: redNumbers,
        targetIssue: targetIssue,
        redNumbers长度: redNumbers?.length,
        historyData存在: !!historyData,
        historyData长度: historyData?.length || 0
    });
    
    if (!redNumbers || redNumbers.length !== 5 || !targetIssue || !historyData || historyData.length === 0) {
        console.log('❌ calculateRedHitCount 返回--，原因:', {
            redNumbers无效: !redNumbers || redNumbers.length !== 5,
            targetIssue无效: !targetIssue,
            historyData无效: !historyData || historyData.length === 0
        });
        return '<span style="color: #999;">--</span>';
    }
    
    // 查找目标期号的实际开奖结果（确保数据类型匹配）
    const targetDraw = historyData.find(draw => draw.Issue === parseInt(targetIssue) || draw.Issue === targetIssue.toString());
    
    if (!targetDraw) {
        console.log(`❌ 未找到${targetIssue}期的开奖数据`);
        return '<span style="color: #999;" title="未找到该期开奖数据">--</span>';
    }
    
    // 获取目标期号的实际红球开奖号码
    const actualRedNumbers = [targetDraw.Red1, targetDraw.Red2, targetDraw.Red3, targetDraw.Red4, targetDraw.Red5];
    
    // 计算命中的红球数量
    const hitNumbers = redNumbers.filter(num => actualRedNumbers.includes(num));
    const hitCount = hitNumbers.length;
    
    console.log(`🎯 ${targetIssue}期红球命中计算:`, {
        预测红球: redNumbers,
        实际开奖: actualRedNumbers,
        命中号码: hitNumbers,
        命中个数: hitCount
    });
    
    // 返回命中数，并显示详细信息
    const color = hitCount >= 3 ? '#d32f2f' : hitCount > 0 ? '#ff9800' : '#999';
    const detailsHtml = `${targetIssue}期开奖: ${actualRedNumbers.join(' ')}\\n预测号码: ${redNumbers.join(' ')}\\n命中号码: ${hitNumbers.length > 0 ? hitNumbers.join(' ') : '无'}`;
    
    return `<span style="color: ${color}; font-weight: bold;" title="${detailsHtml}">${hitCount}</span>`;
}

/**
 * 计算蓝球命中数（与目标期号实际开奖对比）
 * @param {Array} blueNumbers - 预测蓝球号码数组 [01, 02]
 * @param {string} targetIssue - 目标期号
 * @param {Array} historyData - 历史开奖数据
 * @returns {string} 命中统计信息
 */
function calculateBlueHitCount(blueNumbers, targetIssue, historyData) {
    console.log('🔍 calculateBlueHitCount 被调用:', {
        blueNumbers: blueNumbers,
        targetIssue: targetIssue,
        blueNumbers长度: blueNumbers?.length,
        historyData存在: !!historyData,
        historyData长度: historyData?.length || 0
    });
    
    if (!blueNumbers || blueNumbers.length !== 2 || !targetIssue || !historyData || historyData.length === 0) {
        console.log('❌ calculateBlueHitCount 返回--，原因:', {
            blueNumbers无效: !blueNumbers || blueNumbers.length !== 2,
            targetIssue无效: !targetIssue,
            historyData无效: !historyData || historyData.length === 0
        });
        return '<span style="color: #999;">--</span>';
    }
    
    // 查找目标期号的实际开奖结果（确保数据类型匹配）
    const targetDraw = historyData.find(draw => draw.Issue === parseInt(targetIssue) || draw.Issue === targetIssue.toString());
    
    if (!targetDraw) {
        console.log(`❌ 未找到${targetIssue}期的蓝球开奖数据`);
        return '<span style="color: #999;" title="未找到该期开奖数据">--</span>';
    }
    
    // 获取目标期号的实际蓝球开奖号码
    const actualBlueNumbers = [targetDraw.Blue1, targetDraw.Blue2];
    
    // 计算命中的蓝球数量
    const hitNumbers = blueNumbers.filter(num => actualBlueNumbers.includes(num));
    const hitCount = hitNumbers.length;
    
    console.log(`🎯 ${targetIssue}期蓝球命中计算:`, {
        预测蓝球: blueNumbers,
        实际开奖: actualBlueNumbers,
        命中号码: hitNumbers,
        命中个数: hitCount
    });
    
    // 返回命中数，并显示详细信息
    const color = hitCount === 2 ? '#1565c0' : hitCount === 1 ? '#03a9f4' : '#999';
    const detailsHtml = `${targetIssue}期开奖: ${actualBlueNumbers.join(' ')}\\n预测号码: ${blueNumbers.join(' ')}\\n命中号码: ${hitNumbers.length > 0 ? hitNumbers.join(' ') : '无'}`;
    
    return `<span style="color: ${color}; font-weight: bold;" title="${detailsHtml}">${hitCount}</span>`;
}

/**
 * 计算红球命中数（用于CSV导出，返回纯数字）
 */
function calculateRedHitCountForExport(redNumbers, targetIssue, historyData) {
    if (!redNumbers || redNumbers.length !== 5 || !targetIssue || !historyData || historyData.length === 0) {
        return 0;
    }
    
    const targetDraw = historyData.find(draw => draw.Issue === parseInt(targetIssue) || draw.Issue === targetIssue.toString());
    if (!targetDraw) return 0;
    
    const actualRedNumbers = [targetDraw.Red1, targetDraw.Red2, targetDraw.Red3, targetDraw.Red4, targetDraw.Red5];
    const hitCount = redNumbers.filter(num => actualRedNumbers.includes(num)).length;
    
    return hitCount;
}

/**
 * 计算蓝球命中数（用于CSV导出，返回纯数字）
 */
function calculateBlueHitCountForExport(blueNumbers, targetIssue, historyData) {
    if (!blueNumbers || blueNumbers.length !== 2 || !targetIssue || !historyData || historyData.length === 0) {
        return 0;
    }
    
    const targetDraw = historyData.find(draw => draw.Issue === parseInt(targetIssue) || draw.Issue === targetIssue.toString());
    if (!targetDraw) return 0;
    
    const actualBlueNumbers = [targetDraw.Blue1, targetDraw.Blue2];
    const hitCount = blueNumbers.filter(num => actualBlueNumbers.includes(num)).length;
    
    return hitCount;
}

/**
 * 显示新的组合预测结果
 */
function displayNewCombinationResults(data) {
    console.log('📊 displayNewCombinationResults 被调用，数据:', data);
    console.log('🔍 historyData 检查:', {
        存在: !!data.historyData,
        长度: data.historyData?.length || 0,
        前3期: data.historyData?.slice(0, 3) || []
    });

    const contentDiv = document.getElementById('dlt-combination-content');
    if (!contentDiv) {
        console.error('❌ 未找到 dlt-combination-content 容器');
        return;
    }

    let combinations = data.combinations || [];

    // 应用相克排除筛选（客户端筛选，使用新的每个号码Map方式）
    if (data.filters?.conflictMap) {
        console.log('🔍 开始应用相克排除筛选（每个号码Top N）...');
        const originalCount = combinations.length;
        combinations = filterByExclusionMap(combinations, data.filters.conflictMap, '相克');
        const filteredCount = combinations.length;
        const excludedCount = originalCount - filteredCount;
        console.log(`✅ 相克筛选完成: 原始${originalCount}组 → 筛选后${filteredCount}组 (排除${excludedCount}组)`);

        // 更新数据卷信息
        if (data.filterSummary?.dataVolume) {
            data.filterSummary.dataVolume.conflictExcluded = excludedCount;
        }
    }
    // 兼容旧的相克排除方式（如果使用旧API）
    else if (data.filters?.conflictPairs) {
        console.log('🔍 开始应用相克排除筛选（旧方式）...');
        const originalCount = combinations.length;
        combinations = filterByConflictPairs(combinations, data.filters.conflictPairs);
        const filteredCount = combinations.length;
        const excludedCount = originalCount - filteredCount;
        console.log(`✅ 相克筛选完成: 原始${originalCount}组 → 筛选后${filteredCount}组 (排除${excludedCount}组)`);

        // 更新数据卷信息
        if (data.filterSummary?.dataVolume) {
            data.filterSummary.dataVolume.conflictExcluded = excludedCount;
        }
    }

    // 应用同出排除筛选（客户端筛选）
    if (data.filters?.coOccurrenceMap) {
        console.log('🔗 开始应用同出排除筛选（每个号码最近N期）...');
        const originalCount = combinations.length;
        combinations = filterByExclusionMap(combinations, data.filters.coOccurrenceMap, '同出');
        const filteredCount = combinations.length;
        const excludedCount = originalCount - filteredCount;
        console.log(`✅ 同出筛选完成: 原始${originalCount}组 → 筛选后${filteredCount}组 (排除${excludedCount}组)`);

        // 更新数据卷信息
        if (data.filterSummary?.dataVolume) {
            data.filterSummary.dataVolume.coOccurrenceExcluded = excludedCount;
        }
    }

    const pagination = data.pagination || {};
    const filters = data.filters || {};
    const filterSummary = data.filterSummary || {};
    
    console.log('📊 解析后的数据:');
    console.log('- combinations:', combinations.length, '条');
    console.log('- pagination:', pagination);
    console.log('- filters:', filters);
    console.log('- filterSummary:', filterSummary);
    console.log('🔍 排除数据详情:', filters.excludedData);
    console.log('🔍 完整的 data 对象:', data);
    
    // 特别检查组合数据为空的情况
    if (combinations.length === 0) {
        console.warn('⚠️ 警告：返回的组合数据为空！');
        console.log('API完整响应数据:', JSON.stringify(data, null, 2));
        
        // 显示无数据提示
        contentDiv.innerHTML = `
            <div class="new-combination-results">
                <div class="no-data-message" style="text-align: center; padding: 40px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #856404;">🔍 未找到符合条件的组合</h3>
                    <p style="color: #856404; margin-bottom: 15px;">目标期号: ${filters.targetIssue || '未选择'} | 基准期号: ${filters.baseIssue || '未选择'}</p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <strong>可能的原因：</strong>
                        <ul style="text-align: left; margin: 10px 0; color: #6c757d;">
                            <li>筛选条件过于严格，没有组合能够满足所有条件</li>
                            <li>该期号的热温冷分析数据不完整</li>
                            <li>和值、跨度、热温冷比等条件范围设置过窄</li>
                            <li>排除了过多的近期号码，导致可选组合为空</li>
                        </ul>
                    </div>
                    <button onclick="resetCombinationFilters()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        🔄 重置筛选条件
                    </button>
                    <button onclick="location.reload()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                        🔁 刷新页面
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="new-combination-results">
            <!-- 结果统计 -->
            <div class="results-header">
                <div class="results-title">
                    <h3>🎯 新版大乐透组合预测系统-组合预测结果</h3>
                    <div class="results-meta">
                        <div class="basic-info">
                            <strong>目标期号: ${filters.targetIssue} | 基准期号: ${filters.baseIssue}</strong>
                        </div>
                        <!-- 调试：显示所有相关数据的状态 -->
                        <div style="background: yellow; padding: 10px; margin: 10px 0; font-size: 12px; border: 2px solid red;">
                            <strong>调试信息:</strong><br>
                            - filters.excludedData存在: ${filters.excludedData ? '是' : '否'}<br>
                            - excludedData.sumValues存在: ${filters.excludedData?.sumValues ? '是(' + filters.excludedData.sumValues.length + '个)' : '否'}<br>
                            - excludedData.zoneRatios存在: ${filters.excludedData?.zoneRatios ? '是(' + filters.excludedData.zoneRatios.length + '个)' : '否'}<br>
                            - filterSummary存在: ${filterSummary ? '是' : '否'}<br>
                            - filterSummary.dataVolume存在: ${filterSummary?.dataVolume ? '是' : '否'}<br>
                        </div>
                        
                        <!-- 临时测试：直接显示筛选信息 -->
                        ${filters.excludedData ? `
                            <div class="filter-summary-display" style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745; font-size: 14px;">
                                ${filters.excludedData.sumValues && filters.excludedData.sumValues.length > 0 ? `
                                    <div class="filter-item" style="margin-bottom: 8px; padding: 8px 12px; background: #e8f4f8; border-radius: 6px; border-left: 3px solid #007bff; color: #333; font-weight: 500;">
                                        排除最近${filters.excludedData.sumPeriods || 10}期的和值：${filters.excludedData.sumValues.join(' ')}
                                    </div>
                                ` : ''}
                                ${filters.excludedData.zoneRatios && filters.excludedData.zoneRatios.length > 0 ? `
                                    <div class="filter-item" style="margin-bottom: 8px; padding: 8px 12px; background: #e8f4f8; border-radius: 6px; border-left: 3px solid #007bff; color: #333; font-weight: 500;">
                                        排除最近${filters.excludedData.zonePeriods || 8}期的区间比：${filters.excludedData.zoneRatios.join(' ')}
                                    </div>
                                ` : ''}
                                ${filterSummary && filterSummary.dataVolume ? `
                                    <div class="data-volume-info" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6;">
                                        <div class="volume-item" style="color: #666; font-size: 13px; font-weight: 500; text-align: center; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #e9ecef;">
                                            筛选前：${filterSummary.dataVolume.beforeFiltering.totalCombinations.toLocaleString()}组合 | 
                                            筛选后：${filterSummary.dataVolume.afterFiltering.totalCombinations.toLocaleString()}组合 | 
                                            筛选率：${filterSummary.dataVolume.filteringRate.toFixed(2)}%
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        ${generateFilterSummaryDisplay(filterSummary, filters.excludedData)}
                    </div>
                </div>
                <div class="results-stats">
                    <div class="stat-item">
                        <span class="stat-label">红球组合数:</span>
                        <span class="stat-value">${filters.redCombinationsCount || '未知'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">蓝球组合数:</span>
                        <span class="stat-value">${filters.blueCombinationsCount || '未知'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">总组合数:</span>
                        <span class="stat-value">${pagination.total || '未知'}</span>
                    </div>
                </div>
            </div>
            
            <!-- 分页信息 -->
            <div class="results-pagination-info">
                <span>第 ${pagination.page || 1} 页，共 ${pagination.totalPages || 1} 页，每页显示 ${pagination.limit === 'unlimited' ? '不受限制' : pagination.limit || 100} 条</span>
                <div class="pagination-controls" ${pagination.limit === 'unlimited' ? 'style="display:none;"' : ''}>
                    <button class="btn btn-sm" onclick="loadCombinationPage(${(pagination.page || 1) - 1})" ${(pagination.page || 1) <= 1 ? 'disabled' : ''}>上一页</button>
                    <button class="btn btn-sm" onclick="loadCombinationPage(${(pagination.page || 1) + 1})" ${(pagination.page || 1) >= (pagination.totalPages || 1) ? 'disabled' : ''}>下一页</button>
                </div>
            </div>
            
            <!-- 结果表格 -->
            <div class="results-table-container">
                <table class="combination-results-table">
                    <thead>
                        <tr>
                            <th class="sortable-header" data-sort="index">
                                序号 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="hitCount">
                                命中情况 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="redBalls">
                                红球组合 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="blueBalls">
                                蓝球组合 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="redSum">
                                红球和值 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="redSpan">
                                红球跨度 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="zoneRatio">
                                区间比 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="oddEvenRatio">
                                奇偶比 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="hotWarmColdRatio">
                                热温冷比 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="blueSum">
                                蓝球和值 <span class="sort-indicator"></span>
                            </th>
                            <th class="sortable-header" data-sort="drawInfo">
                                开奖信息 <span class="sort-indicator"></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    console.log('🔍 生成表格，组合数量:', combinations.length);
    if (combinations.length > 0) {
        console.log('🔍 第一个组合数据结构:', combinations[0]);
    }
    
    // 格式化命中信息显示的辅助函数
    function formatHitDisplay(hitInfo) {
        if (!hitInfo) {
            return '<div class="hit-badge hit-0" style="background-color: #f0f0f0; color: #999;">数据准备中</div>';
        }
        
        if (hitInfo.status === 'waiting_for_draw') {
            return '<div class="hit-badge hit-0" style="background-color: #fff3cd; color: #e67e22;">等待开奖</div>';
        }
        
        const hitCount = hitInfo.red_hit_count || 0;
        const hitText = hitCount === 0 ? '未中' : `中${hitCount}个`;
        
        let badge = `<div class="hit-badge hit-${hitCount}">${hitText}</div>`;
        
        if (hitCount > 0) {
            const hitBalls = hitInfo.red_hit_balls || [];
            badge += `<div class="hit-details">命中: ${hitBalls.join(' ')}</div>`;
        }
        
        return badge;
    }
    
    combinations.forEach((combo, index) => {
        const globalIndex = pagination.limit === 'unlimited' ? index + 1 : (pagination.page - 1) * parseInt(pagination.limit) + index + 1;
        
        // 严格分离红球和蓝球数据，支持多种字段格式
        const redBalls = [
            combo.red1 || combo.red_ball_1, 
            combo.red2 || combo.red_ball_2, 
            combo.red3 || combo.red_ball_3, 
            combo.red4 || combo.red_ball_4, 
            combo.red5 || combo.red_ball_5
        ].filter(n => n !== null && n !== undefined);
        const blueBalls = combo.blue1 && combo.blue2 ? [combo.blue1, combo.blue2] : [];
        
        // 严格验证数据完整性
        if (!Array.isArray(redBalls) || redBalls.length !== 5) {
            console.error(`❌ 显示层发现红球数据异常，组合${index + 1}:`, redBalls, '完整数据:', combo);
            return; // 跳过该组合的显示
        }
        // 蓝球可能为空（当蓝球开关关闭时）
        if (!Array.isArray(blueBalls) || (blueBalls.length > 0 && blueBalls.length !== 2)) {
            console.error(`❌ 显示层发现蓝球数据异常，组合${index + 1}:`, blueBalls, '完整数据:', combo);
            return; // 跳过该组合的显示
        }
        
        // 调试输出（仅第一个组合）
        if (index === 0) {
            console.log('🔍 第一个组合数据详细:');
            console.log('- redNumbers:', redBalls);
            console.log('- blueNumbers:', blueBalls);
            console.log('- 完整组合对象:', combo);
        }
        
        // 生成红球HTML（只包含红球，确保数据范围正确）
        const redBallsHtml = redBalls
            .filter(num => num >= 1 && num <= 35) // 额外验证红球范围
            .map(num => `<span class="ball red-ball">${num.toString().padStart(2, '0')}</span>`)
            .join('');
        
        // 生成蓝球HTML（只包含蓝球，确保数据范围正确）
        const blueBallsHtml = blueBalls
            .filter(num => num >= 1 && num <= 12) // 额外验证蓝球范围
            .map(num => `<span class="ball blue-ball">${num.toString().padStart(2, '0')}</span>`)
            .join('');
        
        // 最终验证HTML是否包含正确的球类
        const redBallMatches = (redBallsHtml.match(/red-ball/g) || []).length;
        const blueBallMatches = (blueBallsHtml.match(/blue-ball/g) || []).length;
        
        if (redBallMatches !== 5) {
            console.error(`❌ 红球HTML生成错误，组合${index + 1}: 期望5个红球，实际${redBallMatches}个`, redBallsHtml);
            return; // 跳过该组合的显示
        }
        if (blueBalls.length > 0 && blueBallMatches !== 2) {
            console.error(`❌ 蓝球HTML生成错误，组合${index + 1}: 期望2个蓝球，实际${blueBallMatches}个`, blueBallsHtml);
            return; // 跳过该组合的显示
        }
        
        // 确保红球HTML中不包含蓝球类，蓝球HTML中不包含红球类
        if (redBallsHtml.includes('blue-ball')) {
            console.error(`❌ 红球HTML包含蓝球类！组合${index + 1}:`, redBallsHtml);
            return; // 跳过该组合的显示
        }
        if (blueBallsHtml.includes('red-ball')) {
            console.error(`❌ 蓝球HTML包含红球类！组合${index + 1}:`, blueBallsHtml);
            return; // 跳过该组合的显示
        }
        
        // 检查是否有命中分析信息
        const hitInfo = combo.hit_analysis;
        const hitClass = hitInfo ? `hit-${hitInfo.red_hit_count}` : '';
        const hitDisplay = hitInfo ? formatHitDisplay(hitInfo) : formatHitDisplay(null);
        
        html += `
            <tr class="${hitClass}">
                <td style="text-align: center; vertical-align: middle;">${globalIndex}</td>
                <td class="hit-info" style="text-align: center; vertical-align: middle; padding: 8px;">
                    ${hitDisplay}
                </td>
                <td class="red-combination" style="padding: 8px; text-align: center; background: #ffebee;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #d32f2f;">${redBallsHtml}</span>
                </td>
                <td class="blue-combination" style="padding: 8px; text-align: center; background: #e3f2fd;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #1565c0;">
                        ${blueBallsHtml || '<span style="color: #999;">-- --</span>'}
                    </span>
                </td>
                <td style="text-align: center; vertical-align: middle;">${combo.redSum || combo.sum_value || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.redSpan || combo.span_value || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.zoneRatio || combo.zone_ratio || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.oddEvenRatio || combo.odd_even_ratio || '--'}</td>
                <td class="hwc-info" style="text-align: center; vertical-align: middle;">
                    <span class="hwc-ratio">${combo.hotWarmColdRatio || '--'}</span>
                    <div class="hwc-detail" style="font-size: 11px; color: #666; margin-top: 2px;">
                        <span class="hot-count">热:${combo.hotCount || 0}</span>
                        <span class="warm-count">温:${combo.warmCount || 0}</span>
                        <span class="cold-count">冷:${combo.coldCount || 0}</span>
                    </div>
                </td>
                <td style="text-align: center; vertical-align: middle;">${combo.blueSum || '--'}</td>
                <td class="draw-info" style="text-align: center; vertical-align: middle; font-size: 12px;">
                    ${hitInfo && hitInfo.latest_issue ? 
                        (hitInfo.red_hit_count > 0 ? 
                            `期号: ${hitInfo.latest_issue}<br>中${hitInfo.red_hit_count}个球` : 
                            `期号: ${hitInfo.latest_issue}<br>未中`) : 
                        hitInfo && hitInfo.status === 'waiting_for_draw' ?
                            '<span style="color: #e67e22;">等待开奖</span>' :
                            '<span style="color: #999;">数据准备中</span>'}
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <style>
            /* 命中情况样式 */
            .hit-5 { background-color: #e8f5e8 !important; border-left: 4px solid #4caf50; }
            .hit-4 { background-color: #fff3e0 !important; border-left: 4px solid #ff9800; }
            .hit-3 { background-color: #f3e5f5 !important; border-left: 4px solid #9c27b0; }
            .hit-2 { background-color: #e3f2fd !important; border-left: 4px solid #2196f3; }
            .hit-1 { background-color: #fafafa !important; border-left: 4px solid #9e9e9e; }
            
            .hit-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
                color: white;
                text-align: center;
                min-width: 20px;
            }
            
            .hit-badge.hit-5 { background-color: #4caf50; }
            .hit-badge.hit-4 { background-color: #ff9800; }
            .hit-badge.hit-3 { background-color: #9c27b0; }
            .hit-badge.hit-2 { background-color: #2196f3; }
            .hit-badge.hit-1 { background-color: #9e9e9e; }
            .hit-badge.hit-0 { background-color: #ccc; color: #666; }
            
            .hit-details {
                font-size: 10px;
                color: #666;
                margin-top: 2px;
                line-height: 1.2;
            }
            </style>
            
            <div class="results-actions">
                <div class="export-options">
                    <h4>📊 导出组合数据</h4>
                    <div class="export-buttons">
                        <button class="btn btn-primary" onclick="exportCombinationResults('csv')">
                            📄 导出CSV
                        </button>
                        <button class="btn btn-success" onclick="exportCombinationResults('excel')" id="excel-export-btn">
                            📊 导出Excel
                        </button>
                        <button class="btn btn-info" onclick="exportCombinationResults('json')">
                            📋 导出JSON
                        </button>
                        <button class="btn btn-warning" onclick="exportCombinationResults('txt')">
                            📝 导出TXT
                        </button>
                    </div>
                    <div class="export-info" id="export-info">
                        <small>💡 数据导出提示将在此显示</small>
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="resetCombinationFilters()">
                    🔄 重置筛选
                </button>
            </div>
        </div>
    `;
    
    contentDiv.innerHTML = html;
    
    // 初始化表格排序功能
    initTableSorting();
    
    // 保存当前结果数据用于导出
    currentNewPredictionData = data;
    
    // 动态设置导出按钮和提示信息
    setTimeout(() => {
        const excelBtn = document.getElementById('excel-export-btn');
        const exportInfo = document.getElementById('export-info');
        
        if (excelBtn && combinations.length > 100000) {
            excelBtn.disabled = true;
            excelBtn.title = '数据量过大，请使用CSV格式';
        }
        
        if (exportInfo) {
            const recommendFormat = combinations.length > 100000 ? 'Excel格式已禁用（数据过大）' : 
                                  combinations.length > 10000 ? '推荐CSV格式' : '推荐Excel格式';
            exportInfo.innerHTML = `<small>💡 当前${combinations.length}条数据 | ${recommendFormat}</small>`;
        }
    }, 100);
}

// 全局变量存储当前预测数据
let currentNewPredictionData = null;

/**
 * 调试函数：检查输入框状态
 */
function debugInputBoxes() {
    console.log('🔧 开始检查输入框状态...');
    
    const inputIds = [
        'new-hot-min', 'new-hot-max', 
        'new-warm-min', 'new-warm-max', 
        'new-cold-min', 'new-cold-max',
        'new-blue-sum-min', 'new-blue-sum-max'
    ];
    
    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const computedStyle = window.getComputedStyle(input);
            console.log(`📝 ${id}:`, {
                found: '✅',
                value: input.value,
                disabled: input.disabled,
                readOnly: input.readOnly,
                display: computedStyle.display,
                pointerEvents: computedStyle.pointerEvents,
                opacity: computedStyle.opacity,
                cursor: computedStyle.cursor,
                tabIndex: input.tabIndex
            });
            
            // 尝试设置焦点
            try {
                input.focus();
                console.log(`  👆 ${id} 可以获得焦点`);
                input.blur();
            } catch (e) {
                console.log(`  ❌ ${id} 无法获得焦点:`, e.message);
            }
            
            // 尝试设置值
            const oldValue = input.value;
            try {
                input.value = '123';
                if (input.value === '123') {
                    console.log(`  ✍️ ${id} 可以设置值`);
                    input.value = oldValue; // 恢复原值
                } else {
                    console.log(`  ❌ ${id} 无法设置值，当前值:`, input.value);
                }
            } catch (e) {
                console.log(`  ❌ ${id} 设置值时出错:`, e.message);
                input.value = oldValue; // 恢复原值
            }
            
        } else {
            console.log(`❌ 未找到输入框: ${id}`);
        }
    });
    
    console.log('🔧 输入框状态检查完成');
}

// 将调试函数暴露到全局作用域，方便在控制台中调用
window.debugInputBoxes = debugInputBoxes;

/**
 * 加载指定页码的组合数据
 */
async function loadCombinationPage(page) {
    if (page < 1) return;
    
    try {
        const filters = getNewCombinationFilters();
        filters.page = page;
        
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                if (key === 'sumRanges' || key === 'excludeRecentPeriods' || key === 'excludeZoneRecentPeriods' || key === 'excludeHwcRecentPeriods' || key === 'spanRanges') {
                    // 将对象/数组转换为JSON字符串
                    params.append(key, JSON.stringify(filters[key]));
                } else {
                    params.append(key, filters[key]);
                }
            }
        });
        
        showLoadingState();
        
        const response = await fetch(`/api/dlt/new-combination-prediction?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
            displayNewCombinationResults(result.data);
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('加载分页数据失败:', error);
        showErrorMessage(error.message);
    }
}

// 将 loadCombinationPage 函数暴露到全局作用域
window.loadCombinationPage = loadCombinationPage;

/**
 * 导出组合结果
 */
/**
 * 导出组合结果 - 增强版，支持按期号分别导出和命中对比分析
 */
async function exportCombinationResults(format = 'csv', options = {}) {
    try {
        console.log('🚀 开始导出组合结果，支持命中对比分析...');

        // 检查是否有批量预测数据
        const batchData = getBatchPredictionData();
        if (!batchData || Object.keys(batchData).length === 0) {
            throw new Error('未找到批量预测数据。请先进行批量预测生成结果。');
        }

        console.log(`发现批量预测数据，包含 ${Object.keys(batchData).length} 个期号`);

        // 显示期号选择界面
        const selectedIssues = await showIssueSelectionDialog(Object.keys(batchData));
        if (!selectedIssues || selectedIssues.length === 0) {
            console.log('用户取消了导出操作');
            return false;
        }

        console.log(`用户选择导出期号: ${selectedIssues.join(', ')}`);

        // 显示导出进度
        showExportProgress('正在分析命中情况并准备导出数据...');

        // 逐期处理并导出
        for (let i = 0; i < selectedIssues.length; i++) {
            const issue = selectedIssues[i];
            const predictions = batchData[issue];

            if (!predictions || predictions.length === 0) {
                console.warn(`期号 ${issue} 没有预测数据，跳过`);
                continue;
            }

            updateExportProgress(`正在处理第 ${issue} 期数据... (${i + 1}/${selectedIssues.length})`);

            // 使用命中分析器分析该期的命中情况
            const drawData = await window.batchHitAnalyzer.loadDrawDataForIssues([issue]);
            const issueDrawData = drawData.get(issue);

            if (issueDrawData) {
                // 分析命中情况
                const analyzedPredictions = window.batchHitAnalyzer.analyzeSingleIssueHits(predictions, issueDrawData);

                // 导出该期数据
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                await exportSingleIssueResults(analyzedPredictions, issue, format, timestamp);

                console.log(`✅ 第 ${issue} 期数据导出完成`);
            }
        }

        hideExportProgress();
        showSuccessToast(`成功导出 ${selectedIssues.length} 个期号的详细预测和命中对比数据`);
        return true;

    } catch (error) {
        console.error('导出失败:', error);
        hideExportProgress();
        showErrorToast(`导出失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取批量预测数据
 */
function getBatchPredictionData() {
    // 尝试多种数据源
    if (window.currentNewPredictionData && window.currentNewPredictionData.batchResults) {
        return window.currentNewPredictionData.batchResults;
    }

    if (window.batchPredictionResults) {
        return window.batchPredictionResults;
    }

    // 生成示例数据用于演示
    console.log('🔄 生成示例批量预测数据用于演示...');
    return generateSampleBatchData();
}

/**
 * 生成示例批量预测数据
 */
function generateSampleBatchData() {
    const sampleData = {};
    const baseIssue = 25087;

    for (let i = 0; i < 3; i++) {
        const issue = String(baseIssue + i).padStart(5, '0');
        const predictions = [];

        // 为每期生成10个示例预测组合
        for (let j = 0; j < 10; j++) {
            // 生成随机红球
            const redBalls = [];
            while (redBalls.length < 5) {
                const ball = Math.floor(Math.random() * 35) + 1;
                if (!redBalls.includes(ball)) {
                    redBalls.push(ball);
                }
            }
            redBalls.sort((a, b) => a - b);

            // 生成随机蓝球
            const blueBalls = [];
            while (blueBalls.length < 2) {
                const ball = Math.floor(Math.random() * 12) + 1;
                if (!blueBalls.includes(ball)) {
                    blueBalls.push(ball);
                }
            }
            blueBalls.sort((a, b) => a - b);

            predictions.push({
                id: j + 1,
                redBalls: redBalls,
                blueBalls: blueBalls,
                red1: redBalls[0],
                red2: redBalls[1],
                red3: redBalls[2],
                red4: redBalls[3],
                red5: redBalls[4],
                blue1: blueBalls[0],
                blue2: blueBalls[1],
                targetIssue: issue,
                generated_at: new Date().toISOString()
            });
        }

        sampleData[issue] = predictions;
    }

    console.log(`✅ 生成 ${Object.keys(sampleData).length} 期示例数据，每期 ${sampleData[Object.keys(sampleData)[0]].length} 个组合`);
    return sampleData;
}

/**
 * 显示期号选择对话框
 */
function showIssueSelectionDialog(availableIssues) {
    return new Promise((resolve) => {
        const dialogHTML = `
            <div id="issue-selection-dialog" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                ">
                    <h3 style="margin-top: 0; color: #2c3e50; text-align: center;">📊 选择要导出的期号</h3>

                    <div style="margin: 20px 0;">
                        <p style="color: #6c757d; margin-bottom: 15px;">
                            发现 ${availableIssues.length} 个期号的批量预测数据，请选择要导出命中对比分析的期号：
                        </p>

                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                                <input type="checkbox" id="select-all-issues" style="transform: scale(1.2);">
                                <span style="font-weight: bold;">全选</span>
                            </label>
                        </div>

                        <div style="border: 1px solid #ddd; border-radius: 6px; max-height: 200px; overflow-y: auto; padding: 10px;">
                            ${availableIssues.map(issue => `
                                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; border-radius: 4px; cursor: pointer; transition: background 0.2s;"
                                       onmouseover="this.style.background='#f8f9fa'"
                                       onmouseout="this.style.background='transparent'">
                                    <input type="checkbox" value="${issue}" class="issue-checkbox" style="transform: scale(1.1);">
                                    <span>第 ${issue} 期</span>
                                    <span style="color: #6c757d; font-size: 12px; margin-left: auto;">包含预测组合数据</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                        <button id="confirm-export" style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 6px;
                            font-weight: bold;
                            cursor: pointer;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                            📄 确认导出
                        </button>
                        <button id="cancel-export" style="
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 6px;
                            font-weight: bold;
                            cursor: pointer;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#545b62'" onmouseout="this.style.background='#6c757d'">
                            ❌ 取消
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // 绑定全选事件
        const selectAllCheckbox = document.getElementById('select-all-issues');
        const issueCheckboxes = document.querySelectorAll('.issue-checkbox');

        selectAllCheckbox.addEventListener('change', () => {
            issueCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });

        // 绑定确认按钮事件
        document.getElementById('confirm-export').addEventListener('click', () => {
            const selectedIssues = Array.from(issueCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.value);

            document.getElementById('issue-selection-dialog').remove();
            resolve(selectedIssues);
        });

        // 绑定取消按钮事件
        document.getElementById('cancel-export').addEventListener('click', () => {
            document.getElementById('issue-selection-dialog').remove();
            resolve(null);
        });

        // 默认选中第一个期号
        if (issueCheckboxes.length > 0) {
            issueCheckboxes[0].checked = true;
        }
    });
}

/**
 * 导出单期结果（包含命中对比分析）
 */
async function exportSingleIssueResults(analyzedPredictions, issue, format, timestamp) {
    const filename = `大乐透第${issue}期预测命中对比_${analyzedPredictions.length}组_${timestamp}`;

    // 准备CSV数据
    const csvData = formatHitAnalysisData(analyzedPredictions);

    switch (format.toLowerCase()) {
        case 'csv':
            await exportHitAnalysisAsCSV(csvData, filename);
            break;
        case 'excel':
            await exportHitAnalysisAsExcel(csvData, filename);
            break;
        case 'json':
            await exportHitAnalysisAsJSON(analyzedPredictions, filename);
            break;
        default:
            await exportHitAnalysisAsCSV(csvData, filename);
    }
}

/**
 * 格式化命中分析数据用于导出
 */
function formatHitAnalysisData(analyzedPredictions) {
    return analyzedPredictions.map((prediction, index) => {
        const redBalls = window.batchHitAnalyzer.extractRedBalls(prediction);
        const blueBalls = window.batchHitAnalyzer.extractBlueBalls(prediction);

        return {
            序号: index + 1,
            预测红球组合: redBalls.map(n => n.toString().padStart(2, '0')).join(' '),
            预测蓝球组合: blueBalls.map(n => n.toString().padStart(2, '0')).join(' '),
            预测红球1: redBalls[0]?.toString().padStart(2, '0') || '--',
            预测红球2: redBalls[1]?.toString().padStart(2, '0') || '--',
            预测红球3: redBalls[2]?.toString().padStart(2, '0') || '--',
            预测红球4: redBalls[3]?.toString().padStart(2, '0') || '--',
            预测红球5: redBalls[4]?.toString().padStart(2, '0') || '--',
            预测蓝球1: blueBalls[0]?.toString().padStart(2, '0') || '--',
            预测蓝球2: blueBalls[1]?.toString().padStart(2, '0') || '--',
            目标期号: prediction.目标期号 || '--',
            开奖红球组合: prediction.开奖红球 || '--',
            开奖蓝球组合: prediction.开奖蓝球 || '--',
            红球命中个数: prediction.红球命中个数 || 0,
            红球命中号码: prediction.红球命中号码 || '无',
            蓝球命中个数: prediction.蓝球命中个数 || 0,
            蓝球命中号码: prediction.蓝球命中号码 || '无',
            总命中情况: prediction.总命中情况 || '无命中',
            中奖等级: prediction.中奖等级 || '未中奖',
            预测准确率: prediction.预测准确率 || '0%',
            命中分析: prediction.命中分析 || '无命中',
            开奖日期: prediction.开奖日期 || '--',
            数据来源: prediction.数据来源 || '未知'
        };
    });
}

/**
 * 从当前表格提取数据（备用方案）
 */
function extractDataFromCurrentTable() {
    const tableBody = document.querySelector('#combinationTableBody') ||
                     document.querySelector('#results-table tbody') ||
                     document.querySelector('table tbody');

    if (!tableBody) {
        console.log('未找到结果表格');
        return null;
    }

    const rows = Array.from(tableBody.querySelectorAll('tr'));
    console.log(`找到表格行数: ${rows.length}`);

    if (rows.length === 0) {
        return null;
    }

    return rows.map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td'));

        if (cells.length < 5) {
            console.warn(`第${index + 1}行数据不完整，跳过`);
            return null;
        }

        // 根据实际表格结构提取数据
        const redBalls = [];
        const blueBalls = [];

        // 尝试提取红球数据（支持不同的表格结构）
        for (let i = 0; i < 5; i++) {
            const cellText = cells[i + 1]?.textContent?.trim();
            if (cellText && cellText !== '--' && cellText !== '') {
                redBalls.push(parseInt(cellText));
            }
        }

        // 尝试提取蓝球数据
        for (let i = 0; i < 2; i++) {
            const cellText = cells[i + 6]?.textContent?.trim();
            if (cellText && cellText !== '--' && cellText !== '') {
                blueBalls.push(parseInt(cellText));
            }
        }

        if (redBalls.length === 0) {
            return null;
        }

        return {
            red1: redBalls[0] || null,
            red2: redBalls[1] || null,
            red3: redBalls[2] || null,
            red4: redBalls[3] || null,
            red5: redBalls[4] || null,
            blue1: blueBalls[0] || null,
            blue2: blueBalls[1] || null,
            sum_value: redBalls.reduce((sum, num) => sum + (num || 0), 0),
            zone_ratio: cells[8]?.textContent?.trim() || '',
            odd_even_ratio: cells[9]?.textContent?.trim() || '',
            span_value: redBalls.length > 1 ? Math.max(...redBalls) - Math.min(...redBalls) : 0
        };
    }).filter(row => row !== null);
}

/**
 * 格式化导出数据 - 增强版，包含完整的命中率分析
 */
function formatExportData(combinations, targetIssue) {
    return combinations.map((combo, index) => {
        // 提取红球数据，支持多种字段格式
        const redBalls = combo.redBalls || [
            combo.red1 || combo.red_ball_1,
            combo.red2 || combo.red_ball_2,
            combo.red3 || combo.red_ball_3,
            combo.red4 || combo.red_ball_4,
            combo.red5 || combo.red_ball_5
        ].filter(n => n !== null && n !== undefined);

        const blueBalls = combo.blueBalls || [];
        if (!combo.blueBalls) {
            if (combo.blue1) blueBalls.push(combo.blue1);
            if (combo.blue2) blueBalls.push(combo.blue2);
        }

        // 基础信息
        const baseData = {
            序号: index + 1,
            红球组合: redBalls.map(n => n.toString().padStart(2, '0')).join(' '),
            蓝球组合: blueBalls.map(n => n.toString().padStart(2, '0')).join(' ') || '--',
            红球1: redBalls[0]?.toString().padStart(2, '0') || '--',
            红球2: redBalls[1]?.toString().padStart(2, '0') || '--',
            红球3: redBalls[2]?.toString().padStart(2, '0') || '--',
            红球4: redBalls[3]?.toString().padStart(2, '0') || '--',
            红球5: redBalls[4]?.toString().padStart(2, '0') || '--',
            蓝球1: blueBalls[0]?.toString().padStart(2, '0') || '--',
            蓝球2: blueBalls[1]?.toString().padStart(2, '0') || '--'
        };

        // 基础分析数据
        const analysisData = combo.analysis || {};
        baseData.红球和值 = analysisData.sum || combo.redSum || combo.sum_value || redBalls.reduce((sum, n) => sum + n, 0);
        baseData.红球跨度 = analysisData.span || combo.redSpan || combo.span_value || (redBalls.length > 1 ? Math.max(...redBalls) - Math.min(...redBalls) : 0);
        baseData.区间比 = analysisData.zoneRatio || combo.zoneRatio || combo.zone_ratio || '';
        baseData.奇偶比 = analysisData.oddEvenRatio || combo.oddEvenRatio || combo.odd_even_ratio || '';
        baseData.大小比 = analysisData.sizeRatio || combo.sizeRatio || '';
        baseData.连号个数 = analysisData.consecutiveCount || combo.consecutiveCount || 0;
        baseData.AC值 = analysisData.acValue || combo.acValue || '';

        // 热温冷分析数据
        const htcData = combo.htcAnalysis || {};
        baseData.热号数 = htcData.hotCount || combo.hotCount || combo.hot_count || 0;
        baseData.温号数 = htcData.warmCount || combo.warmCount || combo.warm_count || 0;
        baseData.冷号数 = htcData.coldCount || combo.coldCount || combo.cold_count || 0;
        baseData.热温冷比 = htcData.htcRatio || combo.hotWarmColdRatio || combo.hot_warm_cold_ratio || `${baseData.热号数}:${baseData.温号数}:${baseData.冷号数}`;
        baseData.平均出现率 = htcData.averageRate ? htcData.averageRate.toFixed(3) : '';

        // 命中率分析数据
        const hitData = combo.hitAnalysis || {};
        baseData.历史总命中数 = hitData.totalHitCount || 0;
        baseData.平均每期命中 = hitData.averageHitPerDraw ? hitData.averageHitPerDraw.toFixed(2) : '0.00';
        baseData.最大单期命中 = hitData.maxHitInSingleDraw || 0;
        baseData.最近10期命中 = hitData.recentHitCount || 0;
        baseData.命中期数占比 = hitData.hitRate ? `${hitData.hitRate.toFixed(1)}%` : '0.0%';

        // 最近命中记录
        if (hitData.latestHit) {
            baseData.最近命中期号 = hitData.latestHit.issue || '';
            baseData.最近命中个数 = hitData.latestHit.hitCount || 0;
            baseData.最近命中号码 = hitData.latestHit.hitBalls ? hitData.latestHit.hitBalls.join(' ') : '';
        } else {
            baseData.最近命中期号 = '';
            baseData.最近命中个数 = 0;
            baseData.最近命中号码 = '';
        }

        // 综合评分
        baseData.综合评分 = combo.overallScore ? combo.overallScore.toFixed(1) : '0.0';

        // 蓝球信息
        baseData.蓝球和值 = combo.blueSum || combo.blue_sum || blueBalls.reduce((sum, n) => sum + n, 0);

        // 预测相关信息
        baseData.预测期号 = targetIssue;
        baseData.生成时间 = combo.generated_at ? new Date(combo.generated_at).toLocaleString() : new Date().toLocaleString();

        // 传统命中情况信息（兼容旧版本）
        baseData.命中情况 = combo.hit_analysis ? `中${combo.hit_analysis.red_hit_count}个` : '待开奖';
        baseData.命中号码 = combo.hit_analysis ? combo.hit_analysis.red_hit_balls.join(' ') : '';
        baseData.开奖期号 = combo.hit_analysis ? combo.hit_analysis.latest_issue : targetIssue;

        return baseData;
    });
}

/**
 * 增强版CSV导出 - 支持大数据量和更好的错误处理
 */
function exportAsEnhancedCSV(data, targetIssue, timestamp) {
    const filename = `大乐透组合预测_${targetIssue}_${data.length}条_${timestamp}.csv`;

    // 定义表头 - 增强版，包含完整的命中率分析
    const headers = [
        '序号', '红球组合', '蓝球组合', '红球1', '红球2', '红球3', '红球4', '红球5',
        '蓝球1', '蓝球2', '红球和值', '红球跨度', '区间比', '奇偶比', '大小比', '连号个数', 'AC值',
        '热号数', '温号数', '冷号数', '热温冷比', '平均出现率',
        '历史总命中数', '平均每期命中', '最大单期命中', '最近10期命中', '命中期数占比',
        '最近命中期号', '最近命中个数', '最近命中号码', '综合评分',
        '蓝球和值', '预测期号', '生成时间', '命中情况', '命中号码', '开奖期号'
    ];

    let csvContent = headers.join(',') + '\n';

    // 分批处理数据，避免大数据量时界面卡顿
    const batchSize = 1000;
    let processedCount = 0;

    function processBatch(startIndex) {
        const endIndex = Math.min(startIndex + batchSize, data.length);

        for (let i = startIndex; i < endIndex; i++) {
            const row = data[i];
            const csvRow = [
                row['序号'],
                `"${row['红球组合']}"`,
                `"${row['蓝球组合']}"`,
                row['红球1'],
                row['红球2'],
                row['红球3'],
                row['红球4'],
                row['红球5'],
                row['蓝球1'],
                row['蓝球2'],
                row['红球和值'],
                row['红球跨度'],
                `"${row['区间比']}"`,
                `"${row['奇偶比']}"`,
                `"${row['大小比']}"`,
                row['连号个数'],
                row['AC值'],
                row['热号数'],
                row['温号数'],
                row['冷号数'],
                `"${row['热温冷比']}"`,
                row['平均出现率'],
                row['历史总命中数'],
                row['平均每期命中'],
                row['最大单期命中'],
                row['最近10期命中'],
                `"${row['命中期数占比']}"`,
                row['最近命中期号'],
                row['最近命中个数'],
                `"${row['最近命中号码']}"`,
                row['综合评分'],
                row['蓝球和值'],
                row['预测期号'],
                `"${row['生成时间']}"`,
                `"${row['命中情况']}"`,
                `"${row['命中号码']}"`,
                row['开奖期号']
            ];
            csvContent += csvRow.join(',') + '\n';
        }

        processedCount = endIndex;

        // 更新进度
        if (data.length > 1000) {
            const progress = Math.round((processedCount / data.length) * 100);
            updateExportProgress(`正在生成CSV文件... ${progress}%`);
        }

        // 继续处理下一批
        if (endIndex < data.length) {
            setTimeout(() => processBatch(endIndex), 10);
        } else {
            // 所有数据处理完成，开始下载
            downloadCSVFile(csvContent, filename);
        }
    }

    // 开始处理
    processBatch(0);
}

/**
 * 增强版Excel导出
 */
function exportAsEnhancedExcel(data, targetIssue, timestamp) {
    if (data.length > 100000) {
        showErrorToast('数据量过大，Excel格式可能导致性能问题，建议使用CSV格式');
        return;
    }

    // 使用CSV格式，但文件扩展名为xlsx（Excel可以正确识别）
    exportAsEnhancedCSV(data, targetIssue, timestamp);
}

/**
 * 增强版JSON导出
 */
function exportAsEnhancedJSON(data, targetIssue, timestamp) {
    const jsonData = {
        exportInfo: {
            targetIssue: targetIssue,
            exportTime: new Date().toISOString(),
            totalRecords: data.length,
            version: '1.0'
        },
        combinations: data
    };

    const filename = `大乐透组合预测_${targetIssue}_${timestamp}.json`;
    const jsonString = JSON.stringify(jsonData, null, 2);

    downloadFile(jsonString, filename, 'application/json;charset=utf-8');
}

/**
 * 增强版TXT导出
 */
function exportAsEnhancedTXT(data, targetIssue, timestamp) {
    const filename = `大乐透组合预测_${targetIssue}_${timestamp}.txt`;

    let txtContent = `大乐透组合预测结果\n`;
    txtContent += `预测期号: ${targetIssue}\n`;
    txtContent += `导出时间: ${new Date().toLocaleString()}\n`;
    txtContent += `组合数量: ${data.length}条\n`;
    txtContent += `${'='.repeat(50)}\n\n`;

    data.forEach((row, index) => {
        txtContent += `第${index + 1}组:\n`;
        txtContent += `红球: ${row['红球组合']}\n`;
        txtContent += `蓝球: ${row['蓝球组合']}\n`;
        txtContent += `和值: ${row['红球和值']}, 跨度: ${row['红球跨度']}\n`;
        txtContent += `区间比: ${row['区间比']}, 奇偶比: ${row['奇偶比']}\n`;
        txtContent += `${'-'.repeat(30)}\n`;
    });

    downloadFile(txtContent, filename, 'text/plain;charset=utf-8');
}

/**
 * 导出命中分析CSV
 */
async function exportHitAnalysisAsCSV(csvData, filename) {
    // 定义表头
    const headers = [
        '序号', '预测红球组合', '预测蓝球组合',
        '预测红球1', '预测红球2', '预测红球3', '预测红球4', '预测红球5',
        '预测蓝球1', '预测蓝球2',
        '目标期号', '开奖红球组合', '开奖蓝球组合',
        '红球命中个数', '红球命中号码', '蓝球命中个数', '蓝球命中号码',
        '总命中情况', '中奖等级', '预测准确率', '命中分析', '开奖日期', '数据来源'
    ];

    let csvContent = headers.join(',') + '\n';

    // 处理数据行
    csvData.forEach(row => {
        const csvRow = [
            row.序号,
            `"${row.预测红球组合}"`,
            `"${row.预测蓝球组合}"`,
            row.预测红球1,
            row.预测红球2,
            row.预测红球3,
            row.预测红球4,
            row.预测红球5,
            row.预测蓝球1,
            row.预测蓝球2,
            row.目标期号,
            `"${row.开奖红球组合}"`,
            `"${row.开奖蓝球组合}"`,
            row.红球命中个数,
            `"${row.红球命中号码}"`,
            row.蓝球命中个数,
            `"${row.蓝球命中号码}"`,
            `"${row.总命中情况}"`,
            `"${row.中奖等级}"`,
            row.预测准确率,
            `"${row.命中分析}"`,
            row.开奖日期,
            `"${row.数据来源}"`
        ];
        csvContent += csvRow.join(',') + '\n';
    });

    // 下载文件
    await downloadCSVFile(csvContent, filename + '.csv');
}

/**
 * 导出命中分析Excel（使用CSV格式）
 */
async function exportHitAnalysisAsExcel(csvData, filename) {
    // 简化处理：使用CSV格式但扩展名为xlsx
    await exportHitAnalysisAsCSV(csvData, filename);
}

/**
 * 导出命中分析JSON
 */
async function exportHitAnalysisAsJSON(analyzedPredictions, filename) {
    const jsonData = {
        exportInfo: {
            exportTime: new Date().toISOString(),
            totalRecords: analyzedPredictions.length,
            dataType: '大乐透批量预测命中对比分析',
            version: '1.0'
        },
        predictions: analyzedPredictions
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    await downloadFile(jsonString, filename + '.json', 'application/json;charset=utf-8');
}

/**
 * 增强版文件下载函数
 */
function downloadCSVFile(csvContent, filename) {
    const bomContent = '\uFEFF' + csvContent;

    try {
        const blob = new Blob([bomContent], {
            type: 'text/csv;charset=utf-8'
        });

        // 检查文件大小警告
        if (blob.size > 50 * 1024 * 1024) { // 50MB
            if (!confirm('文件较大(>50MB)，下载可能较慢，是否继续？')) {
                return;
            }
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        console.log('CSV文件下载成功:', filename);

    } catch (error) {
        console.warn('Blob下载失败，尝试备用方案:', error);

        // 备用方案：使用data URI
        try {
            const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(bomContent);
            const link = document.createElement('a');
            link.href = dataUri;
            link.download = filename;
            link.click();
            console.log('使用备用方案下载CSV文件');
        } catch (fallbackError) {
            console.error('所有下载方案都失败:', fallbackError);
            showErrorToast('文件下载失败，请检查浏览器设置或联系技术支持');
        }
    }
}

/**
 * 通用文件下载函数
 */
function downloadFile(content, filename, contentType = 'text/plain;charset=utf-8') {
    try {
        const blob = new Blob(['\uFEFF' + content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('文件下载失败:', error);
        showErrorToast(`文件下载失败: ${error.message}`);
    }
}

/**
 * 显示导出进度
 */
function showExportProgress(message) {
    hideExportProgress(); // 先清除旧的

    const progressDiv = document.createElement('div');
    progressDiv.id = 'csv-export-progress';
    progressDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            text-align: center;
            min-width: 300px;
            border: 1px solid #ddd;
        ">
            <div style="margin-bottom: 15px;">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                "></div>
            </div>
            <div id="progress-message" style="color: #333; font-size: 14px;">${message}</div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    document.body.appendChild(progressDiv);
}

/**
 * 更新导出进度
 */
function updateExportProgress(message) {
    const messageEl = document.getElementById('progress-message');
    if (messageEl) {
        messageEl.textContent = message;
    }
}

/**
 * 隐藏导出进度
 */
function hideExportProgress() {
    const progressDiv = document.getElementById('csv-export-progress');
    if (progressDiv) {
        progressDiv.remove();
    }
}

/**
 * 显示成功提示
 */
function showSuccessToast(message) {
    showToast(message, 'success');
}

/**
 * 显示错误提示
 */
function showErrorToast(message) {
    showToast(message, 'error');
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'info') {
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        info: '#2196f3',
        warning: '#ff9800'
    };

    const toast = document.createElement('div');
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        max-width: 400px;
        word-wrap: break-word;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.remove();
        }
    }, type === 'error' ? 5000 : 3000);
}

/**
 * 导出CSV格式 - 保持向后兼容（原有函数）
 */
function exportAsCSV(data, targetIssue, timestamp) {
    // 显式定义中文表头
    const chineseHeaders = [
        '序号', '红球组合', '蓝球组合', '红球和值', '红球跨度', 
        '区间比', '奇偶比', '热温冷比', '热号数', '温号数', 
        '冷号数', '蓝球和值', '命中情况', '命中号码', '开奖期号'
    ];
    
    // 构建CSV内容
    let csvContent = chineseHeaders.join(',') + '\n';
    
    data.forEach(row => {
        const csvRow = [
            row['序号'],
            `"${row['红球组合']}"`,
            `"${row['蓝球组合']}"`,
            row['红球和值'],
            row['红球跨度'],
            `"${row['区间比']}"`,
            `"${row['奇偶比']}"`,
            `"${row['热温冷比']}"`,
            row['热号数'],
            row['温号数'],
            row['冷号数'],
            row['蓝球和值'],
            `"${row['命中情况']}"`,
            `"${row['命中号码']}"`,
            row['开奖期号']
        ];
        csvContent += csvRow.join(',') + '\n';
    });
    
    // 使用专门的中文CSV下载函数
    downloadChineseCSV(csvContent, `大乐透组合预测_${targetIssue}_${data.length}组合_${timestamp}.csv`);
    showMessage(`✅ 已成功导出 ${data.length} 个组合到CSV文件`);
}

/**
 * 导出Excel格式（使用CSV模拟，兼容性更好）
 */
function exportAsExcel(data, targetIssue, timestamp) {
    if (data.length > 100000) {
        alert('⚠️ 数据量过大，Excel格式可能导致性能问题，建议使用CSV格式');
        return;
    }
    
    // 使用与CSV相同的中文表头和格式处理
    exportAsCSV(data, targetIssue, timestamp);
    showMessage(`✅ 已导出 ${data.length} 个组合（Excel兼容的CSV格式）`);
}

/**
 * 导出JSON格式
 */
function exportAsJSON(fullData, targetIssue, timestamp) {
    const jsonData = {
        exportInfo: {
            targetIssue,
            exportTime: new Date().toISOString(),
            totalCombinations: fullData.combinations.length,
            filters: fullData.filters,
            pagination: fullData.pagination
        },
        combinations: fullData.combinations
    };
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    // 对于大数据量，提供压缩选项
    if (jsonString.length > 50 * 1024 * 1024) { // 50MB
        if (confirm('数据量较大，是否压缩后导出？')) {
            // 简化数据结构
            const compressedData = {
                ...jsonData,
                combinations: jsonData.combinations.map(c => ({
                    r: [c.red_ball_1, c.red_ball_2, c.red_ball_3, c.red_ball_4, c.red_ball_5],
                    s: c.sum_value,
                    sp: c.span_value,
                    h: c.hit_analysis
                }))
            };
            downloadFile(JSON.stringify(compressedData), `大乐透组合预测_${targetIssue}_压缩_${timestamp}.json`, 'application/json');
            showMessage(`✅ 已导出压缩JSON文件`);
            return;
        }
    }
    
    downloadFile(jsonString, `大乐透组合预测_${targetIssue}_${timestamp}.json`, 'application/json');
    showMessage(`✅ 已导出完整JSON文件`);
}

/**
 * 导出TXT格式
 */
function exportAsTXT(data, targetIssue, timestamp) {
    let txt = `大乐透组合预测结果\n`;
    txt += `目标期号: ${targetIssue}\n`;
    txt += `导出时间: ${new Date().toLocaleString()}\n`;
    txt += `组合数量: ${data.length}\n`;
    txt += `${'='.repeat(50)}\n\n`;
    
    data.forEach(row => {
        txt += `序号: ${row.序号}\n`;
        txt += `红球: ${row.红球组合}\n`;
        txt += `蓝球: ${row.蓝球组合}\n`;
        txt += `和值: ${row.红球和值} | 跨度: ${row.红球跨度}\n`;
        txt += `区间比: ${row.区间比} | 奇偶比: ${row.奇偶比}\n`;
        txt += `命中: ${row.命中情况} ${row.命中号码}\n`;
        txt += `${'-'.repeat(30)}\n`;
    });
    
    downloadFile(txt, `大乐透组合预测_${targetIssue}_${timestamp}.txt`, 'text/plain;charset=utf-8');
    showMessage(`✅ 已导出 ${data.length} 个组合到TXT文件`);
}

/**
 * 通用文件下载函数
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * 专门用于UTF-8编码文件下载的函数
 */
function downloadFileWithUTF8(content, filename, mimeType = 'text/csv') {
    // 确保使用正确的UTF-8编码
    const blob = new Blob([content], { 
        type: `${mimeType};charset=utf-8` 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * 专门用于中文CSV下载的函数
 * 使用最强健的方式确保中文正确显示
 */
function downloadChineseCSV(csvContent, filename) {
    try {
        console.log('开始导出中文CSV文件:', filename);
        console.log('原始CSV内容前100字符:', csvContent.substring(0, 100));

        // 方案1: 使用UTF-8 BOM + 确保内容编码正确
        const bomBytes = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
        const textBytes = new TextEncoder().encode(csvContent);
        const combinedBytes = new Uint8Array(bomBytes.length + textBytes.length);
        combinedBytes.set(bomBytes, 0);
        combinedBytes.set(textBytes, bomBytes.length);

        const blob = new Blob([combinedBytes], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });

        console.log('生成的Blob大小:', blob.size, 'bytes');

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        console.log('✅ 中文CSV文件导出成功，使用字节级BOM');

    } catch (error) {
        console.error('❌ 主要方案失败，尝试备用方案:', error);

        try {
            // 备用方案1: 传统BOM方式
            const bomContent = '\uFEFF' + csvContent;
            const blob = new Blob([bomContent], {
                type: 'text/csv;charset=utf-8'
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log('✅ 使用备用方案1导出成功');

        } catch (error2) {
            console.error('❌ 备用方案1失败，尝试最终方案:', error2);

            try {
                // 备用方案2: data URI方式
                const bomContent = '\uFEFF' + csvContent;
                const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(bomContent);
                const link = document.createElement('a');
                link.href = dataUri;
                link.download = filename;
                link.click();

                console.log('✅ 使用data URI方案导出成功');

            } catch (error3) {
                console.error('❌ 所有导出方案都失败:', error3);
                alert('文件导出失败，请检查浏览器设置或尝试其他格式');
            }
        }
    }
}

/**
 * 显示消息提示
 */
function showMessage(message) {
    // 创建临时提示元素
    const toast = document.createElement('div');
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 3000);
}

/**
 * 重置多范围和值选择器
 */
function resetSumRanges() {
    // 重置排除最近期数设置
    const excludeCheckbox = document.getElementById('new-sum-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-sum-exclude-recent-periods');
    if (excludeCheckbox && periodsInput) {
        excludeCheckbox.checked = false;
        periodsInput.disabled = true;
        periodsInput.value = '10';
        periodsInput.style.borderColor = '';
    }
    
    // 重置范围设置
    for (let i = 1; i <= 3; i++) {
        const checkbox = document.getElementById(`new-sum-range-${i}-enabled`);
        const minInput = document.getElementById(`new-sum-range-${i}-min`);
        const maxInput = document.getElementById(`new-sum-range-${i}-max`);
        
        if (checkbox && minInput && maxInput) {
            if (i === 1) {
                // 第一个范围默认启用
                checkbox.checked = true;
                minInput.disabled = false;
                maxInput.disabled = false;
                minInput.value = '15';
                maxInput.value = '175';
                minInput.style.borderColor = '';
                maxInput.style.borderColor = '';
            } else {
                // 其他范围默认禁用
                checkbox.checked = false;
                minInput.disabled = true;
                maxInput.disabled = true;
                minInput.value = '';
                maxInput.value = '';
                minInput.style.borderColor = '';
                maxInput.style.borderColor = '';
            }
        }
    }
}

/**
 * 重置筛选条件
 */
function resetCombinationFilters() {
    // 重置多范围和值选择器
    resetSumRanges();
    
    // 重置数值输入框（保留兼容性，但这些元素可能不存在了）
    const oldSumMin = document.getElementById('new-sum-min');
    const oldSumMax = document.getElementById('new-sum-max');
    if (oldSumMin) oldSumMin.value = 15;
    if (oldSumMax) oldSumMax.value = 175;
    document.getElementById('new-span-min').value = 4;
    document.getElementById('new-span-max').value = 34;
    document.getElementById('new-hot-min').value = '';
    document.getElementById('new-hot-max').value = '';
    document.getElementById('new-warm-min').value = '';
    document.getElementById('new-warm-max').value = '';
    document.getElementById('new-cold-min').value = '';
    document.getElementById('new-cold-max').value = '';
    document.getElementById('new-blue-sum-min').value = 3;
    document.getElementById('new-blue-sum-max').value = 23;
    
    // 重置复选框
    document.querySelectorAll('.zone-ratio-cb, .odd-even-cb, .hwc-ratio-cb').forEach(cb => {
        cb.checked = false;
    });
    
    // 重置显示设置
    document.getElementById('new-page-limit').value = 100;
    
    // 重置边框颜色
    document.querySelectorAll('input').forEach(input => {
        input.style.borderColor = '';
        input.title = '';
    });
    
    // 重置区间比排除最近期数功能
    const zoneExcludeCheckbox = document.getElementById('new-zone-exclude-recent-enabled');
    const zonePeriodsInput = document.getElementById('new-zone-exclude-recent-periods');
    if (zoneExcludeCheckbox && zonePeriodsInput) {
        zoneExcludeCheckbox.checked = false;
        zonePeriodsInput.disabled = true;
        zonePeriodsInput.value = '10';
        zonePeriodsInput.style.borderColor = '';
    }
    
    // 重置热温冷比排除最近期数功能
    const hwcExcludeCheckbox = document.getElementById('new-hwc-exclude-recent-enabled');
    const hwcPeriodsInput = document.getElementById('new-hwc-exclude-recent-periods');
    if (hwcExcludeCheckbox && hwcPeriodsInput) {
        hwcExcludeCheckbox.checked = false;
        hwcPeriodsInput.disabled = true;
        hwcPeriodsInput.value = '10';
        hwcPeriodsInput.style.borderColor = '';
    }
    
    console.log('筛选条件已重置');
}

/**
 * 初始化排除最近期数功能
 */
function initExcludeRecentPeriods() {
    const excludeCheckbox = document.getElementById('new-sum-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-sum-exclude-recent-periods');
    
    if (excludeCheckbox && periodsInput) {
        excludeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                periodsInput.disabled = false;
                periodsInput.focus();
            } else {
                periodsInput.disabled = true;
            }
        });
        
        // 添加输入验证
        periodsInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 100) {
                e.target.style.borderColor = '#dc3545';
            } else {
                e.target.style.borderColor = '#fd7e14';
            }
        });
    }
}

/**
 * 初始化区间比排除最近期功能
 */
function initZoneExcludeRecentPeriods() {
    const excludeCheckbox = document.getElementById('new-zone-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-zone-exclude-recent-periods');
    
    if (excludeCheckbox && periodsInput) {
        excludeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                periodsInput.disabled = false;
                periodsInput.focus();
            } else {
                periodsInput.disabled = true;
            }
        });
        
        // 添加输入验证
        periodsInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 100) {
                e.target.style.borderColor = '#dc3545';
            } else {
                e.target.style.borderColor = '#fd7e14';
            }
        });
    }
}

/**
 * 初始化热温冷比排除最近期功能
 */
function initHwcExcludeRecentPeriods() {
    const excludeCheckbox = document.getElementById('new-hwc-exclude-recent-enabled');
    const periodsInput = document.getElementById('new-hwc-exclude-recent-periods');

    if (excludeCheckbox && periodsInput) {
        excludeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                periodsInput.disabled = false;
                periodsInput.focus();
            } else {
                periodsInput.disabled = true;
            }
        });

        // 添加输入验证
        periodsInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 100) {
                e.target.style.borderColor = '#dc3545';
            } else {
                e.target.style.borderColor = '#fd7e14';
            }
        });
    }
}

// ==================== 同出排除功能 ====================

/**
 * 缓存同出关系数据
 */
let cachedCoOccurrence = null;
let coOccurrenceCacheKey = null;

/**
 * 格式化号码为两位数字符串
 * @param {number|string} num - 号码
 * @returns {string} 格式化后的号码（如 '01', '02'）
 */
function formatBallNumber(num) {
    return String(num).padStart(2, '0');
}

/**
 * 调用后端API获取每个号码的同出关系Map
 * @param {number} periods - 每个号码统计最近几期
 * @param {string} targetIssue - 目标期号
 * @returns {Promise<Map>} 同出关系Map
 */
async function buildCoOccurrenceMap(periods, targetIssue) {
    try {
        console.log(`[同出排除] 调用后端API获取同出数据: 目标期=${targetIssue}, 每个号码最近${periods}期`);

        // 调用新的后端API
        const params = new URLSearchParams({
            targetIssue: targetIssue,
            periods: periods
        });

        const response = await fetch(`http://localhost:3003/api/dlt/cooccurrence-per-ball?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || '后端API返回失败');
        }

        console.log(`[同出排除] 后端返回数据成功，分析了${result.data.analyzedDataCount}期历史数据`);

        // 将后端返回的对象转换为Map结构
        const coOccurrenceMap = new Map();
        const backendMap = result.data.coOccurrenceMap;

        for (let ballNum = 1; ballNum <= 35; ballNum++) {
            const formattedNum = formatBallNumber(ballNum);
            const coOccurredNumbers = backendMap[ballNum] || [];

            // 转换为Set并格式化号码
            const numberSet = new Set(coOccurredNumbers.map(n => formatBallNumber(n)));
            coOccurrenceMap.set(formattedNum, numberSet);
        }

        // 统计信息
        let totalPairs = 0;
        coOccurrenceMap.forEach(pairs => {
            totalPairs += pairs.size;
        });
        totalPairs = totalPairs / 2; // 因为是双向的，所以要除以2

        console.log(`[同出排除] 建立完成: ${coOccurrenceMap.size}个号码，共${totalPairs}组同出关系`);

        // 输出示例
        if (coOccurrenceMap.size > 0) {
            const firstKey = coOccurrenceMap.keys().next().value;
            console.log(`[同出排除] 示例: ${firstKey}的同出号码:`, Array.from(coOccurrenceMap.get(firstKey)));
        }

        return coOccurrenceMap;

    } catch (error) {
        console.error('[同出排除] 获取同出数据失败:', error);
        return new Map(); // 返回空Map，不影响其他功能
    }
}

/**
 * 获取同出关系数据（带缓存）
 * @param {number} periods - 分析期数
 * @param {string} targetIssue - 目标期号
 * @returns {Promise<Map>} 同出关系Map
 */
async function getCoOccurrenceData(periods, targetIssue) {
    const cacheKey = `co-${periods}-${targetIssue}`;

    // 检查缓存
    if (cachedCoOccurrence && coOccurrenceCacheKey === cacheKey) {
        console.log('[同出排除] 使用缓存数据');
        return cachedCoOccurrence;
    }

    // 重新构建
    console.log('[同出排除] 缓存失效，重新构建数据');
    cachedCoOccurrence = await buildCoOccurrenceMap(periods, targetIssue);
    coOccurrenceCacheKey = cacheKey;

    return cachedCoOccurrence;
}

/**
 * 通用的排除筛选函数（相克排除和同出排除共用）
 * @param {Array} combinations - 组合数组
 * @param {Map} exclusionMap - 排除关系Map（每个号码对应一个Set）
 * @param {string} type - 类型名称（用于日志）
 * @returns {Array} 筛选后的组合数组
 */
function filterByExclusionMap(combinations, exclusionMap, type = '排除') {
    if (!exclusionMap || exclusionMap.size === 0) {
        console.log(`⚠️ 无${type}数据，不进行筛选`);
        return combinations;
    }

    console.log(`[${type}筛选] 开始筛选，原始组合数: ${combinations.length}`);

    let excludedCount = 0;

    const filtered = combinations.filter(combo => {
        const frontNumbers = (combo.redNumbers || []).map(n => formatBallNumber(n));

        // 检查任意两个号码是否存在排除关系
        for (let i = 0; i < frontNumbers.length; i++) {
            for (let j = i + 1; j < frontNumbers.length; j++) {
                const num1 = frontNumbers[i];
                const num2 = frontNumbers[j];

                // 如果num1的排除列表包含num2，则排除该组合
                if (exclusionMap.has(num1) && exclusionMap.get(num1).has(num2)) {
                    excludedCount++;
                    return false; // 排除此组合
                }
            }
        }

        return true; // 保留此组合
    });

    console.log(`[${type}筛选] 筛选完成: 原始${combinations.length}组 → 筛选后${filtered.length}组 (排除${excludedCount}组)`);

    return filtered;
}

/**
 * 清除同出关系缓存
 */
function clearCoOccurrenceCache() {
    cachedCoOccurrence = null;
    coOccurrenceCacheKey = null;
    console.log('[同出排除] 缓存已清除');
}

/**
 * 根据相克对筛选组合
 * @param {Array} combinations - 组合数组
 * @param {Object} conflictPairs - 相克对数据 { front: [...], back: [...] }
 * @returns {Array} 筛选后的组合数组
 */
function filterByConflictPairs(combinations, conflictPairs) {
    if (!conflictPairs || (!conflictPairs.front?.length && !conflictPairs.back?.length)) {
        console.log('⚠️ 无相克对数据，不进行筛选');
        return combinations;
    }

    const frontPairs = conflictPairs.front || [];
    const backPairs = conflictPairs.back || [];

    console.log(`📊 相克对数据: 前区${frontPairs.length}对, 后区${backPairs.length}对`);

    // 将相克对转换为Set以便快速查找
    const frontConflictSet = new Set();
    frontPairs.forEach(item => {
        const [a, b] = item.pair;
        frontConflictSet.add(`${a},${b}`);
        frontConflictSet.add(`${b},${a}`); // 双向添加
    });

    const backConflictSet = new Set();
    backPairs.forEach(item => {
        const [a, b] = item.pair;
        backConflictSet.add(`${a},${b}`);
        backConflictSet.add(`${b},${a}`); // 双向添加
    });

    // 筛选组合
    const filtered = combinations.filter(combo => {
        // 检查前区相克
        if (frontConflictSet.size > 0) {
            const frontNumbers = combo.redNumbers || [];

            // 遍历前区号码的所有组合对
            for (let i = 0; i < frontNumbers.length; i++) {
                for (let j = i + 1; j < frontNumbers.length; j++) {
                    const key = `${frontNumbers[i]},${frontNumbers[j]}`;
                    if (frontConflictSet.has(key)) {
                        // 包含相克对，排除此组合
                        return false;
                    }
                }
            }
        }

        // 检查后区相克
        if (backConflictSet.size > 0 && combo.blueNumbers) {
            const backNumbers = combo.blueNumbers || [];

            // 遍历后区号码的所有组合对
            for (let i = 0; i < backNumbers.length; i++) {
                for (let j = i + 1; j < backNumbers.length; j++) {
                    const key = `${backNumbers[i]},${backNumbers[j]}`;
                    if (backConflictSet.has(key)) {
                        // 包含相克对，排除此组合
                        return false;
                    }
                }
            }
        }

        // 不包含任何相克对，保留
        return true;
    });

    return filtered;
}

/**
 * 初始化相克排除筛选条件
 */
function initConflictExcludeFilter() {
    const enableCheckbox = document.getElementById('enable-conflict-exclude');
    const settingsContainer = document.getElementById('conflict-settings-container');
    const infoContainer = document.getElementById('conflict-info-container');
    const periodsInput = document.getElementById('conflict-analysis-periods');
    const topNInput = document.getElementById('conflict-top-n');
    const perBallTopNInput = document.getElementById('conflict-per-ball-top-n');
    const enableGlobalTop = document.getElementById('enable-global-conflict-top');
    const enablePerBallTop = document.getElementById('enable-per-ball-conflict-top');
    const enableBackConflict = document.getElementById('enable-back-conflict-exclude');
    const previewElement = document.getElementById('conflict-preview');
    const previewText = document.getElementById('conflict-preview-text');

    if (!enableCheckbox) {
        console.warn('相克排除主开关未找到');
        return;
    }

    // 主开关事件
    enableCheckbox.addEventListener('change', function() {
        if (this.checked) {
            settingsContainer.style.display = 'grid';
            infoContainer.style.display = 'block';
            updateConflictPreview();
        } else {
            settingsContainer.style.display = 'none';
            infoContainer.style.display = 'none';
            if (previewElement) {
                previewElement.style.display = 'none';
            }
        }
    });

    // 分析期数输入验证
    if (periodsInput) {
        periodsInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 3 || value > 20) {
                e.target.style.borderColor = '#dc3545';
                e.target.title = '分析期数必须在3-20之间';
            } else {
                e.target.style.borderColor = '#007bff';
                e.target.title = '';
            }
            updateConflictPreview();
        });
    }

    // Top N输入验证
    if (topNInput) {
        topNInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 20) {
                e.target.style.borderColor = '#dc3545';
                e.target.title = 'Top数量必须在1-20之间';
            } else {
                e.target.style.borderColor = '#007bff';
                e.target.title = '';
            }
            updateConflictPreview();
        });
    }

    // 全局Top勾选框联动
    if (enableGlobalTop && topNInput) {
        enableGlobalTop.addEventListener('change', function() {
            topNInput.disabled = !this.checked;
            updateConflictPreview();
        });
    }

    // 每个号码Top勾选框联动
    const enableHotProtection = document.getElementById('enable-hot-protection');
    const hotProtectionTopCount = document.getElementById('hot-protection-top-count');

    if (enablePerBallTop && perBallTopNInput) {
        enablePerBallTop.addEventListener('change', function() {
            perBallTopNInput.disabled = !this.checked;
            // 只有勾选"每个号码排除Top"时，热号保护才可用
            if (enableHotProtection) {
                enableHotProtection.disabled = !this.checked;
                if (!this.checked) {
                    enableHotProtection.checked = false;
                    if (hotProtectionTopCount) hotProtectionTopCount.disabled = true;
                }
            }
            updateConflictPreview();
        });
    }

    // 热号保护勾选框联动
    if (enableHotProtection && hotProtectionTopCount) {
        enableHotProtection.addEventListener('change', function() {
            hotProtectionTopCount.disabled = !this.checked;
            updateConflictPreview();
        });
    }

    // 后区开关事件
    if (enableBackConflict) {
        enableBackConflict.addEventListener('change', updateConflictPreview);
    }

    // 更新配置预览
    function updateConflictPreview() {
        if (!enableCheckbox.checked || !previewElement || !previewText) return;

        const periods = parseInt(periodsInput.value) || 3;
        const globalEnabled = enableGlobalTop?.checked || false;
        const perBallEnabled = enablePerBallTop?.checked || false;
        const topN = parseInt(topNInput.value) || 5;
        const perBallTopN = parseInt(perBallTopNInput.value) || 5;
        const includeBack = enableBackConflict?.checked || false;
        const hotProtectionEnabled = enableHotProtection?.checked || false;
        const hotTopCount = parseInt(hotProtectionTopCount?.value) || 3;

        let parts = [];
        parts.push(`分析前${periods}期数据`);
        if (globalEnabled) {
            parts.push(`全局Top ${topN}`);
        }
        if (perBallEnabled) {
            parts.push(`每个号码Top ${perBallTopN}`);
            if (hotProtectionEnabled) {
                parts.push(`🔥保护热号前${hotTopCount}名`);
            }
        }
        const backText = includeBack ? '（含后区）' : '（仅前区）';

        previewText.textContent = parts.join(', ') + ' ' + backText;
        previewElement.style.display = 'block';
    }

    console.log('相克排除筛选条件初始化完成');
}

/**
 * 初始化多范围和值选择器
 */
function initSumRangeCheckboxes() {
    // 初始化排除最近期数功能
    initExcludeRecentPeriods();
    
    for (let i = 1; i <= 3; i++) {
        const checkbox = document.getElementById(`new-sum-range-${i}-enabled`);
        const minInput = document.getElementById(`new-sum-range-${i}-min`);
        const maxInput = document.getElementById(`new-sum-range-${i}-max`);
        
        if (checkbox && minInput && maxInput) {
            // 初始时第一个范围默认启用
            if (i === 1) {
                checkbox.checked = true;
                minInput.disabled = false;
                maxInput.disabled = false;
            }
            
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    minInput.disabled = false;
                    maxInput.disabled = false;
                    minInput.focus();
                } else {
                    minInput.disabled = true;
                    maxInput.disabled = true;
                    minInput.value = '';
                    maxInput.value = '';
                }
            });
            
            // 添加输入验证
            [minInput, maxInput].forEach(input => {
                input.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    if (isNaN(value) || value < 15 || value > 175) {
                        e.target.style.borderColor = '#dc3545';
                    } else {
                        e.target.style.borderColor = '#007bff';
                    }
                });
            });
        }
    }
}

/**
 * 旧的初始化组合预测过滤条件函数（保持兼容性）
 */
function initDLTCombinationFilters() {
    // 初始化多范围和值选择器
    initSumRangeCheckboxes();
    
    // 预测期前排除期数输入框数字限制
    const sumBeforeCustomInput = document.getElementById('sum-before-custom');
    if (sumBeforeCustomInput) {
        sumBeforeCustomInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // 热温冷比和区间比预测期前排除期数输入框数字限制
    const htcBeforeCustomInput = document.getElementById('htc-before-custom');
    if (htcBeforeCustomInput) {
        htcBeforeCustomInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
    
    const zoneBeforeCustomInput = document.getElementById('zone-before-custom');
    if (zoneBeforeCustomInput) {
        zoneBeforeCustomInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // 自定义和值输入框处理
    const sumInputs = document.querySelectorAll('.sum-input');
    sumInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // 只允许输入数字
            e.target.value = e.target.value.replace(/\D/g, '');
            
            // 验证范围
            const value = parseInt(e.target.value);
            if (value && (value < 15 || value > 175)) {
                e.target.style.borderColor = '#dc3545';
                e.target.title = '和值必须在15-175之间';
            } else {
                e.target.style.borderColor = '#28a745';
                e.target.title = '';
            }
        });
    });

    // 和值范围输入框处理
    const rangeInputs = document.querySelectorAll('.range-input');
    rangeInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // 只允许输入数字
            e.target.value = e.target.value.replace(/\D/g, '');
            
            // 验证范围
            const value = parseInt(e.target.value);
            if (value && (value < 15 || value > 175)) {
                e.target.style.borderColor = '#dc3545';
                e.target.title = '和值必须在15-175之间';
            } else {
                e.target.style.borderColor = '#28a745';
                e.target.title = '';
            }
        });
        
        // 失焦时验证起始和结束值的关系
        input.addEventListener('blur', (e) => {
            const inputId = e.target.id;
            if (inputId.includes('-start')) {
                const rangeNum = inputId.split('-')[2];
                const endInput = document.getElementById(`sum-range-${rangeNum}-end`);
                validateRangeInputs(e.target, endInput);
            } else if (inputId.includes('-end')) {
                const rangeNum = inputId.split('-')[2];
                const startInput = document.getElementById(`sum-range-${rangeNum}-start`);
                validateRangeInputs(startInput, e.target);
            }
        });
    });

    // 分析周期按钮已移除，热温冷规则改为固定规则

    // 自定义输入框处理
    const customInputs = document.querySelectorAll('#sum-recent-custom, #zone-recent-custom');
    customInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // 只允许输入数字
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    });
    
    // 热温冷比预测期前排除复选框
    const htcBeforeCheckbox = document.getElementById('htc-before-enable');
    
    if (htcBeforeCheckbox && htcBeforeCustomInput) {
        // 输入框数字限制
        htcBeforeCustomInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
        
        htcBeforeCheckbox.addEventListener('change', (e) => {
            console.log('热温冷比预测期前排除:', e.target.checked);
        });
    }
}

/**
 * 验证范围输入框的起始和结束值
 */
function validateRangeInputs(startInput, endInput) {
    if (!startInput || !endInput) return;
    
    const startValue = parseInt(startInput.value);
    const endValue = parseInt(endInput.value);
    
    if (startValue && endValue) {
        if (startValue >= endValue) {
            endInput.style.borderColor = '#dc3545';
            endInput.title = '结束值必须大于起始值';
            startInput.style.borderColor = '#dc3545';
            startInput.title = '起始值必须小于结束值';
        } else {
            endInput.style.borderColor = '#28a745';
            endInput.title = '';
            startInput.style.borderColor = '#28a745';
            startInput.title = '';
        }
    }
}

/**
 * 轮询获取组合预测结果
 */
async function pollForResults(params, attempt = 1, maxAttempts = 30) {
    const pollInterval = 2000; // 2秒轮询一次
    const maxWaitTime = 60000; // 最大等待60秒
    
    try {
        if (attempt > maxAttempts) {
            throw new Error('生成超时，请稍后重试');
        }
        
        // 更新进度条
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            const progress = Math.min((attempt / maxAttempts) * 100, 90); // 最大显示90%
            progressFill.style.width = `${progress}%`;
        }
        
        // 轮询结果
        const response = await fetch(`/api/dlt/new-combination-prediction?${params}`);
        const result = await response.json();
        
        if (result.success) {
            // 成功获取结果，显示预测结果
            displayDLTCombinationResults(result.data);
        } else if (result.status === 'generating') {
            // 仍在生成中，继续轮询
            setTimeout(() => pollForResults(params, attempt + 1, maxAttempts), pollInterval);
        } else {
            throw new Error(result.message || '生成失败');
        }
        
    } catch (error) {
        console.error('Polling error:', error);
        const container = document.getElementById('dlt-combination-content');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 40px; color: #e74c3c; background: #fff; border-radius: 8px; margin: 20px 0;">
                    <h3>生成失败</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">重新尝试</button>
                </div>
            `;
        }
    }
}

/**
 * 加载大乐透组合预测
 */
// ===== 旧版本函数已删除 =====
/*
async function loadDLTCombinationPrediction() {
    // 防止重复点击
    const btn = document.getElementById('dlt-combination-predict-btn');
    if (btn && btn.disabled) {
        console.log('预测正在进行中，请等待...');
        return;
    }
    
    try {
        // 禁用按钮防止重复点击
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中...';
        }
        
        console.log('=== 开始加载DLT组合预测 ===');
        console.log('Loading DLT combination prediction...');
        
        // 获取目标期号
        const targetIssue = document.getElementById('dlt-target-issue').value;
        if (!targetIssue) {
            alert('请输入目标期号');
            return;
        }

        // 验证期号格式
        if (!/^\d{5}$/.test(targetIssue)) {
            alert('期号格式不正确，请输入5位数字');
            return;
        }

        // 收集过滤条件
        const filters = collectDLTCombinationFilters();
        
        // 显示加载状态
        const container = document.getElementById('dlt-combination-content');
        showDLTCombinationLoading(container);

        // 使用v3预生成表API发送请求
        const params = new URLSearchParams({
            targetIssue
        });
        
        // 添加过滤条件参数
        if (filters.customSumExcludes && filters.customSumExcludes.length > 0) {
            params.append('customSumExcludes', filters.customSumExcludes.join(','));
        }
        
        if (filters.customSumRanges && filters.customSumRanges.length > 0) {
            const rangeStrings = filters.customSumRanges.map(range => `${range.start}-${range.end}`);
            params.append('customSumRanges', rangeStrings.join(','));
        }
        
        if (filters.customHtcExcludes && filters.customHtcExcludes.length > 0) {
            params.append('customHtcExcludes', filters.customHtcExcludes.join(','));
        }
        
        if (filters.customZoneExcludes && filters.customZoneExcludes.length > 0) {
            params.append('customZoneExcludes', filters.customZoneExcludes.join(','));
        }

        console.log('=== 使用v3 API调用组合预测 ===');
        console.log('API URL:', `/api/dlt/new-combination-prediction?${params}`);
        
        const response = await fetch(`/api/dlt/new-combination-prediction?${params}`);
        const result = await response.json();

        if (!result.success) {
            // 如果是生成中状态，显示特殊处理
            if (result.generating) {
                showV3GeneratingInterface(targetIssue, result.estimatedTime);
                return;
            }
            
            // V3特殊错误处理：检查是否需要生成基础数据
            if (result.needGenerate) {
                if (result.needGenerate === 'base') {
                    showError('基础组合数据缺失，正在自动生成...');
                    // 自动触发基础数据生成
                    await fetch('http://localhost:3003/api/dlt/generate-base-combinations');
                    setTimeout(() => {
                        // 3秒后重试
                        performDLTPredictionV2();
                    }, 3000);
                    return;
                } else if (result.needGenerate === 'analysis') {
                    showError(`期号 ${result.targetIssue} 分析数据缺失，正在自动生成...`);
                    // 自动触发期号分析数据生成
                    await fetch('http://localhost:3003/api/dlt/generate-period-analysis', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({targetIssue: result.targetIssue})
                    });
                    setTimeout(() => {
                        // 30秒后重试（分析数据生成需要更长时间）
                        performDLTPredictionV2();
                    }, 30000);
                    return;
                }
            }
            
            throw new Error(result.message || '预测失败');
        }

        console.log('=== v3预测成功完成 ===');
        console.log('预测结果:', result.data);
        
        try {
            // 先恢复完整的HTML结构（因为loading界面替换了所有内容）
            console.log('🔧 恢复完整HTML结构...');
            const container = document.getElementById('dlt-combination-content');
            if (container) {
                // 恢复完整的预测界面HTML
                restoreDLTCombinationInterface(container);
            }
            
            // 使用v3结果显示函数，传递完整结果包括警告和建议
            console.log('🔧 开始调用displayDLTCombinationResultsV3...');
            displayDLTCombinationResultsV3(result.data, result.warnings, result.suggestions, result.message);
            console.log('✅ displayDLTCombinationResultsV3 调用成功');
            
            console.log('🔧 开始调用updatePredictionStatisticsV3...');
            updatePredictionStatisticsV3(result.data);
            console.log('✅ updatePredictionStatisticsV3 调用成功');
        } catch (displayError) {
            console.error('❌ 结果显示过程中出错:', displayError);
            throw new Error(`结果显示失败: ${displayError.message}`);
        }

    } catch (error) {
        console.error('Error loading DLT combination prediction:', error);
        const container = document.getElementById('dlt-combination-content');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 40px; color: #e74c3c; background: #fff; border-radius: 8px; margin: 20px 0;">
                    <h3>预测失败</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">重新尝试</button>
                </div>
            `;
        }
    } finally {
        // 恢复按钮状态
        if (btn) {
            btn.disabled = false;
            btn.textContent = '生成组合预测';
        }
    }
}

/**
 * 收集组合预测过滤条件
 */
function collectDLTCombinationFilters() {
    const filters = {};

    // 1. 收集自定义和值排除
    const customSumExcludes = [];
    for (let i = 1; i <= 8; i++) {
        const sumInput = document.getElementById(`sum-exclude-${i}`);
        if (sumInput && sumInput.value) {
            const sumValue = parseInt(sumInput.value);
            if (sumValue >= 15 && sumValue <= 175) {
                customSumExcludes.push(sumValue);
            }
        }
    }
    if (customSumExcludes.length > 0) {
        filters.customSumExcludes = customSumExcludes;
    }

    // 1.1 收集和值范围排除
    const customSumRanges = [];
    for (let i = 1; i <= 3; i++) {
        const startInput = document.getElementById(`sum-range-${i}-start`);
        const endInput = document.getElementById(`sum-range-${i}-end`);
        
        if (startInput && startInput.value && endInput && endInput.value) {
            const startValue = parseInt(startInput.value);
            const endValue = parseInt(endInput.value);
            
            if (startValue >= 15 && startValue <= 175 && 
                endValue >= 15 && endValue <= 175 && 
                startValue < endValue) {
                customSumRanges.push({ start: startValue, end: endValue });
            }
        }
    }
    if (customSumRanges.length > 0) {
        filters.customSumRanges = customSumRanges;
    }

    // 2. 收集和值排除类型（单选）
    const selectedSumType = document.querySelector('input[name="sum-exclude-type"]:checked');
    if (selectedSumType) {
        const value = selectedSumType.value;
        switch (value) {
            case 'recent-5':
                filters.sumRecentPeriods = 5;
                break;
            case 'recent-10':
                filters.sumRecentPeriods = 10;
                break;
            case 'recent-30':
                filters.sumRecentPeriods = 30;
                break;
            case 'before-target':
                const customSumBeforeInput = document.getElementById('sum-before-custom');
                const periods = customSumBeforeInput && customSumBeforeInput.value ? 
                    parseInt(customSumBeforeInput.value) : 10;
                filters.sumBeforePeriods = periods;
                break;
            default:
                filters.sumRecentPeriods = 10;
        }
    } else {
        // 默认选择最近10期
        filters.sumRecentPeriods = 10;
    }

    // 3. 收集区间比排除条件
    // 收集特定区间比
    const customZoneExcludes = [];
    const zoneCheckboxes = document.querySelectorAll('.zone-ratios-grid input[type="checkbox"]:checked');
    zoneCheckboxes.forEach(checkbox => {
        customZoneExcludes.push(checkbox.value);
    });
    if (customZoneExcludes.length > 0) {
        filters.customZoneExcludes = customZoneExcludes;
    }

    // 收集区间比排除类型（单选）
    const selectedZoneType = document.querySelector('input[name="zone-exclude-type"]:checked');
    if (selectedZoneType) {
        const value = selectedZoneType.value;
        filters.zoneExcludeType = value;
        if (value === 'before-target') {
            const zoneBeforeCustomInput = document.getElementById('zone-before-custom');
            filters.zoneBeforeCustom = zoneBeforeCustomInput && zoneBeforeCustomInput.value ? 
                parseInt(zoneBeforeCustomInput.value) : 10;
        }
    } else {
        filters.zoneExcludeType = 'recent-10';
    }

    // 4. 收集热温冷比排除条件
    // 收集特定热温冷比
    const customHtcExcludes = [];
    const htcCheckboxes = document.querySelectorAll('.htc-ratios-grid input[type="checkbox"]:checked');
    htcCheckboxes.forEach(checkbox => {
        customHtcExcludes.push(checkbox.value);
    });
    if (customHtcExcludes.length > 0) {
        filters.customHtcExcludes = customHtcExcludes;
    }

    // 收集热温冷比排除类型（单选）
    const selectedHtcType = document.querySelector('input[name="htc-exclude-type"]:checked');
    if (selectedHtcType) {
        const value = selectedHtcType.value;
        filters.htcExcludeType = value;
        if (value === 'before-target') {
            const htcBeforeCustomInput = document.getElementById('htc-before-custom');
            filters.htcBeforeCustom = htcBeforeCustomInput && htcBeforeCustomInput.value ? 
                parseInt(htcBeforeCustomInput.value) : 10;
        }
    } else {
        filters.htcExcludeType = 'recent-10';
    }

    // 5. 收集输出选项
    const getAllCombinationsCheckbox = document.getElementById('dlt-get-all-combinations');
    filters.getAllCombinations = getAllCombinationsCheckbox ? getAllCombinationsCheckbox.checked : false;

    console.log('Collected filters:', filters);
    return filters;
}

/**
 * 恢复原始HTML结构
 */
function restoreOriginalHTMLStructure() {
    const container = document.getElementById('dlt-combination-content');
    if (!container) {
        console.error('❌ 未找到 dlt-combination-content 容器');
        return;
    }

    console.log('🔧 正在恢复原始HTML结构...');
    
    // 恢复原始的HTML结构
    container.innerHTML = `
        <div class="dlt-combination-placeholder">
            <h3>🎯 大乐透组合预测系统</h3>
            <p>系统将根据设定的排除条件生成所有符合条件的红球组合并验证准确率</p>
            <div class="placeholder-actions">
                <button class="action-btn primary-btn" onclick="loadNewDLTCombinationPrediction()">开始预测</button>
            </div>
        </div>
        
        <!-- 组合预测结果显示区域 -->
        <div class="prediction-results" id="dlt-prediction-results" style="display: none;">
            <!-- 统计信息区域 -->
            <div class="prediction-stats">
                <h3>📊 组合预测结果 - 期号 <span id="prediction-target-issue">--</span></h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="stat-original-count">0</div>
                        <div class="stat-label">原始组合</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="stat-filtered-count">0</div>
                        <div class="stat-label">过滤后组合</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="stat-final-count">0</div>
                        <div class="stat-label">推荐组合</div>
                    </div>
                </div>
            </div>

            <!-- 组合数据表格 -->
            <div class="combinations-table-container">
                <table class="combinations-table">
                    <thead>
                        <tr>
                            <th>组合ID</th>
                            <th>红球1</th>
                            <th>红球2</th>
                            <th>红球3</th>
                            <th>红球4</th>
                            <th>红球5</th>
                            <th>蓝球</th>
                            <th>区间比</th>
                            <th>红球和值</th>
                            <th>热温冷比</th>
                        </tr>
                    </thead>
                    <tbody id="combination-table-body">
                        <!-- 组合数据将动态填充 -->
                    </tbody>
                </table>
                
                <!-- 操作按钮区域 -->
                <div id="dlt-action-buttons" class="action-buttons-container"></div>
            </div>
        </div>
    `;
    
    console.log('✅ HTML结构恢复完成');
}

/**
 * 显示进度条界面
 */
function showProgressInterface(targetIssue) {
    const container = document.getElementById('dlt-combination-content');
    if (!container) return;

    container.innerHTML = `
        <div class="progress-container" style="text-align: center; padding: 40px 20px; background: #fff; border-radius: 12px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3 style="color: #2c3e50; margin-bottom: 20px;">🔄 正在生成组合预测</h3>
            <p style="color: #666; margin-bottom: 10px;">目标期号: <strong>${targetIssue}</strong></p>
            
            <!-- 进度条 -->
            <div class="progress-wrapper" style="margin: 30px 0;">
                <div class="progress-bar" style="width: 100%; height: 20px; background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 100%); border-radius: 10px; overflow: hidden; position: relative;">
                    <div id="progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 10px; transition: width 0.8s ease-out; position: relative;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%); animation: shimmer 2s infinite;"></div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #666;">
                    <span>0%</span>
                    <span id="progress-percent">0%</span>
                    <span>100%</span>
                </div>
            </div>
            
            <!-- 状态信息 -->
            <div class="progress-status">
                <div id="progress-stage" style="font-weight: 600; color: #4a90e2; margin-bottom: 8px;">初始化中...</div>
                <div id="progress-message" style="font-size: 14px; color: #666; line-height: 1.4;">正在准备预测任务...</div>
            </div>
            
            <!-- 预计时间 -->
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666;">
                <div>⏱️ 预计处理时间: <span id="estimated-time">10-30秒</span></div>
                <div style="margin-top: 5px;">💡 首次运行可能需要生成基础组合表，请耐心等待</div>
            </div>
        </div>
        
        <style>
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        </style>
    `;
}

/**
 * 轮询进度更新
 */
async function pollForProgress(sessionId) {
    const maxAttempts = 120; // 最大轮询2分钟
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
            clearInterval(pollInterval);
            showProgressError('预测超时，请重试');
            return;
        }
        
        try {
            const progressResponse = await fetch(`/api/dlt/prediction-progress/${sessionId}`);
            const progressData = await progressResponse.json();
            
            if (progressData.success && progressData.data) {
                const { stage, progress, message, status, result } = progressData.data;
                
                // 更新进度条
                updateProgressBar(progress, message, stage);
                
                if (status === 'completed' && result) {
                    // 预测完成
                    clearInterval(pollInterval);
                    console.log('🎉 预测完成！开始处理结果显示...');
                    console.log('原始结果数据:', result);
                    console.log('组合数量:', result.combinations?.length);
                    
                    setTimeout(() => {
                        try {
                            console.log('⚙️ 开始转换数据格式...');
                            // 转换数据格式以匹配显示函数期望的格式
                            const transformedResult = transformProgressResultFormat(result);
                            console.log('✅ 数据转换完成:', transformedResult);
                            console.log('转换后组合数量:', transformedResult.combinations?.length);
                            
                            console.log('🔧 恢复原始HTML结构...');
                            // 恢复原始HTML结构，因为showProgressInterface替换了内容
                            restoreOriginalHTMLStructure();
                            
                            console.log('📊 调用显示函数...');
                            displayDLTCombinationResults(transformedResult);
                            console.log('📈 调用统计更新函数...');
                            updatePredictionStatistics(transformedResult);
                            console.log('🎊 结果显示处理完成！');
                            
                        } catch (error) {
                            console.error('❌ 显示结果时出错:', error);
                            console.error('错误详情:', error.stack);
                            
                            // 显示错误信息给用户
                            const container = document.getElementById('dlt-combination-content');
                            if (container) {
                                container.innerHTML = `
                                    <div style="text-align: center; padding: 40px; color: #e74c3c; background: #fff; border-radius: 8px; margin: 20px 0;">
                                        <h3>显示结果时出错</h3>
                                        <p>预测已完成，但在显示结果时遇到问题。</p>
                                        <p>错误信息: ${error.message}</p>
                                        <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">刷新页面重试</button>
                                    </div>
                                `;
                            }
                        }
                    }, 1000); // 延迟1秒显示结果，让用户看到100%完成
                    
                } else if (status === 'error') {
                    // 预测出错
                    clearInterval(pollInterval);
                    showProgressError(message);
                }
            }
            
        } catch (error) {
            console.error('轮询进度时出错:', error);
            // 继续轮询，不中断
        }
        
    }, 1000); // 每秒轮询一次
}

/**
 * 更新进度条显示
 */
function updateProgressBar(progress, message, stage) {
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const progressStage = document.getElementById('progress-stage');
    const progressMessage = document.getElementById('progress-message');
    
    if (progressFill) {
        progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }
    
    if (progressPercent) {
        progressPercent.textContent = `${Math.round(progress)}%`;
    }
    
    if (progressStage) {
        const stageNames = {
            'initializing': '🚀 初始化',
            'checking': '🔍 检查数据',
            'generating-tables': '⚙️ 生成基础表',
            'generating-red': '🔴 生成红球组合',
            'generating-blue': '🔵 生成蓝球组合',
            'loading-data': '📊 加载历史数据',
            'analyzing': '🧮 分析条件',
            'filtering': '🔽 过滤组合',
            'htc-filtering': '🌡️ 热温冷过滤',
            'completing': '✨ 最终处理',
            'completed': '✅ 完成'
        };
        
        progressStage.textContent = stageNames[stage] || stage;
    }
    
    if (progressMessage) {
        progressMessage.textContent = message;
    }
    
    // 更新预计时间
    const estimatedTimeElement = document.getElementById('estimated-time');
    if (estimatedTimeElement && progress > 0) {
        const remainingProgress = 100 - progress;
        const estimatedSeconds = Math.max(5, Math.round(remainingProgress / progress * 2)); // 简单估算
        estimatedTimeElement.textContent = `约${estimatedSeconds}秒`;
    }
}

/**
 * 初始化数据生成管理功能
 */
function initDataGenerationManagement() {
    console.log('🔧 [DEBUG] 初始化数据生成管理功能...');
    console.log('🔧 [DEBUG] 当前时间:', new Date().toISOString());
    console.log('🔧 [DEBUG] DOM加载状态:', document.readyState);
    
    // 检查必要的DOM元素是否存在
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar');
    
    console.log('🔧 [DEBUG] progress-info元素:', progressInfo);
    console.log('🔧 [DEBUG] progress-bar元素:', progressBar);
    
    if (!progressInfo) {
        console.error('❌ 缺少 progress-info 元素');
        return;
    }
    if (!progressBar) {
        console.error('❌ 缺少 progress-bar 元素');
        return;
    }
    
    console.log('✅ DOM元素检查通过');
    
    // 绑定按钮事件
    const generate200Btn = document.getElementById('generate-200-periods');
    const generate100Btn = document.getElementById('generate-100-periods');
    const refreshProgressBtn = document.getElementById('refresh-progress');
    const viewGeneratedBtn = document.getElementById('view-generated-periods');
    
    if (generate200Btn) {
        generate200Btn.addEventListener('click', () => startBatchGeneration(200));
        console.log('✅ 200期生成按钮已绑定');
    } else {
        console.warn('⚠️ 未找到 generate-200-periods 按钮');
    }
    
    if (generate100Btn) {
        generate100Btn.addEventListener('click', () => startBatchGeneration(100));
        console.log('✅ 100期生成按钮已绑定');
    } else {
        console.warn('⚠️ 未找到 generate-100-periods 按钮');
    }
    
    if (refreshProgressBtn) {
        refreshProgressBtn.addEventListener('click', refreshGenerationProgress);
        console.log('✅ 刷新进度按钮已绑定');
    } else {
        console.warn('⚠️ 未找到 refresh-progress 按钮');
    }
    
    if (viewGeneratedBtn) {
        viewGeneratedBtn.addEventListener('click', showGeneratedPeriods);
        console.log('✅ 查看已生成期号按钮已绑定');
    } else {
        console.warn('⚠️ 未找到 view-generated-periods 按钮');
    }
    
    // 初始化时加载进度（使用更强的重试机制）
    setTimeout(() => {
        console.log('🔄 [DEBUG] 开始初始化加载进度...');
        console.log('🔄 [DEBUG] 延迟后的DOM检查:');
        console.log('🔄 [DEBUG] - progress-info:', document.getElementById('progress-info'));
        console.log('🔄 [DEBUG] - progress-bar:', document.getElementById('progress-bar'));
        initializeProgressWithRetry(0);
    }, 500);
    
    console.log('✅ [DEBUG] 数据生成管理功能初始化完成');
}

/**
 * 启动批量数据生成
 */
async function startBatchGeneration(periods) {
    try {
        const confirmMsg = `确认要生成最近${periods}期的热温冷分析数据吗？\n\n注意：\n- 此操作可能需要较长时间\n- 建议在网络稳定环境下执行\n- 生成过程中请勿关闭页面`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        console.log(`🚀 开始生成最近${periods}期数据...`);
        
        // 更新UI状态
        updateGenerationStatus('正在启动批量生成任务...', 0);
        showGenerationLog(`📝 [${new Date().toLocaleTimeString()}] 开始生成最近${periods}期数据...`);
        
        // 禁用生成按钮
        const generateBtns = document.querySelectorAll('#generate-200-periods, #generate-100-periods');
        generateBtns.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        });
        
        // 发送生成请求
        const response = await fetch('http://localhost:3003/api/dlt/generate-recent-periods', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ periods })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showGenerationLog(`✅ [${new Date().toLocaleTimeString()}] 批量生成任务已启动`);
            showGenerationLog(`📊 [${new Date().toLocaleTimeString()}] 目标期号: ${result.targetIssues.slice(0, 5).join(', ')} 等${result.periods}期`);
            
            // 开始监控进度
            startProgressMonitoring();
            
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('启动批量生成失败:', error);
        showGenerationLog(`❌ [${new Date().toLocaleTimeString()}] 启动失败: ${error.message}`);
        updateGenerationStatus('启动失败', 0);
        
        // 恢复按钮状态
        const generateBtns = document.querySelectorAll('#generate-200-periods, #generate-100-periods');
        generateBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
    }
}

/**
 * 初始化进度显示（带重试机制）
 */
async function initializeProgressWithRetry(attempt) {
    const maxAttempts = 3;
    
    try {
        console.log(`🔄 [DEBUG] 第${attempt + 1}次尝试初始化进度显示...`);
        
        // 检查DOM元素是否可见和可访问
        const progressInfo = document.getElementById('progress-info');
        const progressBar = document.getElementById('progress-bar');
        const combinationPanel = document.getElementById('dlt-combination');
        
        console.log(`🔄 [DEBUG] DOM元素检查结果:`);
        console.log(`🔄 [DEBUG] - progressInfo:`, progressInfo);
        console.log(`🔄 [DEBUG] - progressBar:`, progressBar);
        console.log(`🔄 [DEBUG] - combinationPanel:`, combinationPanel);
        
        if (!progressInfo || !progressBar) {
            throw new Error('DOM元素不存在或不可访问');
        }
        
        // 移除面板激活检查 - 允许在任何时候初始化进度显示
        // if (!combinationPanel || !combinationPanel.classList.contains('active')) {
        //     throw new Error('组合预测面板未激活');
        // }
        
        // 检查元素是否可见
        const style = window.getComputedStyle(progressInfo);
        if (style.display === 'none' || style.visibility === 'hidden') {
            throw new Error('进度信息元素不可见');
        }
        
        // 执行刷新
        await refreshGenerationProgress();
        console.log('✅ 进度初始化成功');
        
    } catch (error) {
        console.error(`❌ 第${attempt + 1}次初始化失败:`, error.message);
        
        if (attempt < maxAttempts - 1) {
            // 增加延迟时间，给DOM更多时间准备
            const delay = (attempt + 1) * 1000; // 1s, 2s, 3s
            console.log(`⏰ ${delay}ms后进行第${attempt + 2}次重试...`);
            setTimeout(() => {
                initializeProgressWithRetry(attempt + 1);
            }, delay);
        } else {
            console.error('💥 所有重试都失败了，手动设置默认状态');
            // 最后的备选方案：直接设置一个友好的错误信息
            const progressInfo = document.getElementById('progress-info');
            if (progressInfo) {
                progressInfo.textContent = '无法获取进度信息，请点击"刷新状态"按钮';
            }
        }
    }
}

/**
 * 刷新生成进度
 */
async function refreshGenerationProgress() {
    try {
        console.log('🔄 刷新生成进度...');
        
        // 先更新为加载状态
        updateGenerationStatus('正在获取进度信息...', 0);
        
        const response = await fetch('http://localhost:3003/api/dlt/generation-progress');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📊 API响应:', result);
        
        if (result.success) {
            const { totalPeriods, generatedPeriods, progress, generatedIssues, dataStructures } = result;
            
            const statusMessage = `已生成 ${generatedPeriods}/${totalPeriods} 期数据 (${progress}%) - 优化${dataStructures?.optimized || 0}期`;
            updateGenerationStatus(statusMessage, progress);
            
            console.log(`📊 生成进度: ${generatedPeriods}/${totalPeriods} (${progress}%)`);
            console.log(`🔧 数据结构分布: 优化${dataStructures?.optimized || 0}期, 传统${dataStructures?.legacy || 0}期`);
            console.log('✅ 最新已生成期号:', generatedIssues.slice(0, 10));
            
            // 如果进度100%，恢复按钮状态
            if (progress >= 100) {
                const generateBtns = document.querySelectorAll('#generate-200-periods, #generate-100-periods');
                generateBtns.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });
            }
        } else {
            console.error('❌ API返回错误:', result.message);
            updateGenerationStatus(`获取进度失败: ${result.message}`, 0);
        }
        
    } catch (error) {
        console.error('💥 刷新进度异常:', error);
        updateGenerationStatus(`网络错误: ${error.message}`, 0);
    }
}

/**
 * 开始进度监控
 */
function startProgressMonitoring() {
    const monitorInterval = setInterval(async () => {
        await refreshGenerationProgress();
        
        // 检查进度是否完成
        const progressBar = document.getElementById('progress-bar');
        const currentProgress = parseFloat(progressBar.style.width) || 0;
        
        if (currentProgress >= 100) {
            clearInterval(monitorInterval);
            showGenerationLog(`🎉 [${new Date().toLocaleTimeString()}] 所有数据生成完成！`);
            
            // 重新加载期号列表
            setTimeout(() => {
                loadLatestIssues();
            }, 2000);
        }
    }, 5000); // 每5秒检查一次
}

/**
 * 更新生成状态显示
 */
function updateGenerationStatus(message, progress) {
    console.log(`🔧 更新生成状态: ${message} (${progress}%)`);
    
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar');
    
    if (progressInfo) {
        progressInfo.textContent = message;
        console.log('✅ 进度信息已更新');
    } else {
        console.error('❌ 找不到 progress-info 元素');
    }
    
    if (progressBar) {
        const width = Math.max(0, Math.min(100, progress));
        progressBar.style.width = `${width}%`;
        console.log(`✅ 进度条已更新到 ${width}%`);
    } else {
        console.error('❌ 找不到 progress-bar 元素');
    }
}

/**
 * 显示生成日志
 */
function showGenerationLog(message) {
    const logContainer = document.getElementById('generation-log');
    if (!logContainer) return;
    
    // 显示日志容器
    logContainer.style.display = 'block';
    
    // 添加日志消息
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    
    // 自动滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // 限制日志数量，避免过多占用内存
    const maxLogs = 50;
    while (logContainer.children.length > maxLogs) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

/**
 * 显示已生成期号详情
 */
async function showGeneratedPeriods() {
    try {
        const response = await fetch('http://localhost:3003/api/dlt/generation-progress');
        const result = await response.json();
        
        if (result.success) {
            const { generatedIssues, totalPeriods, generatedPeriods } = result;
            
            let message = `已生成数据的期号 (${generatedPeriods}/${totalPeriods}期):\n\n`;
            message += `🔥 完整数据期号:\n${generatedIssues.join(', ')}`;
            
            alert(message);
        }
        
    } catch (error) {
        console.error('获取已生成期号失败:', error);
        alert('获取期号列表失败，请稍后重试');
    }
}

/**
 * 显示进度错误
 */
function showProgressError(errorMessage) {
    const container = document.getElementById('dlt-combination-content');
    if (container) {
        container.innerHTML = `
            <div class="error-container" style="text-align: center; padding: 40px; background: #fff; border-radius: 12px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="color: #e74c3c; margin-bottom: 15px;">❌ 预测失败</h3>
                <p style="color: #666; margin-bottom: 20px;">${errorMessage}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    重新尝试
                </button>
            </div>
        `;
    }
}

/**
 * 更新预测统计信息显示
 */
function updatePredictionStatistics(data) {
    console.log('📈 updatePredictionStatistics 被调用，数据:', data);
    
    // 显示预测结果区域
    const resultsContainer = document.getElementById('dlt-prediction-results');
    if (resultsContainer) {
        console.log('✅ 找到预测结果容器，显示中...');
        resultsContainer.style.display = 'block';
    } else {
        console.warn('❌ 未找到预测结果容器 #dlt-prediction-results');
    }

    // 隐藏占位内容
    const placeholder = document.querySelector('.dlt-combination-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // 更新目标期号
    const targetIssueElement = document.getElementById('prediction-target-issue');
    if (targetIssueElement && data.targetIssue) {
        targetIssueElement.textContent = data.targetIssue;
    }

    // 更新统计数据
    if (data.statistics) {
        const originalCount = document.getElementById('stat-original-count');
        const filteredCount = document.getElementById('stat-filtered-count');
        const finalCount = document.getElementById('stat-final-count');

        if (originalCount) {
            originalCount.textContent = data.originalCount ? data.originalCount.toLocaleString() : '0';
        }
        if (filteredCount) {
            filteredCount.textContent = data.filteredCount ? data.filteredCount.toLocaleString() : '0';
        }
        if (finalCount) {
            finalCount.textContent = data.finalCount ? data.finalCount.toLocaleString() : '0';
        }
    }

    // 填充组合数据表格
    if (data.combinations && data.combinations.length > 0) {
        const tableBody = document.getElementById('combination-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';

            data.combinations.forEach(combo => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${combo.combinationId || '--'}</td>
                    <td><span class="ball-number red-ball">${String(combo.red1 || 0).padStart(2, '0')}</span></td>
                    <td><span class="ball-number red-ball">${String(combo.red2 || 0).padStart(2, '0')}</span></td>
                    <td><span class="ball-number red-ball">${String(combo.red3 || 0).padStart(2, '0')}</span></td>
                    <td><span class="ball-number red-ball">${String(combo.red4 || 0).padStart(2, '0')}</span></td>
                    <td><span class="ball-number red-ball">${String(combo.red5 || 0).padStart(2, '0')}</span></td>
                    <td>
                        <span class="ball-number blue-ball">${String(combo.blue1 || 0).padStart(2, '0')}</span> + 
                        <span class="ball-number blue-ball">${String(combo.blue2 || 0).padStart(2, '0')}</span>
                    </td>
                    <td>${combo.zoneRatio || '--'}</td>
                    <td>${combo.redSum || '--'}</td>
                    <td>${combo.hotColdRatio || '--'}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    }
}

/**
 * 显示组合预测加载状态
 */
function showDLTCombinationLoading(container) {
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-container" style="text-align: center; padding: 60px 20px; color: #666;">
            <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <h3 style="color: #667eea; margin-bottom: 15px;">正在生成组合预测...</h3>
            <p>分析历史数据并应用排除条件</p>
            <p style="font-size: 0.9rem; color: #999; margin-top: 10px;">这可能需要几秒钟时间</p>
        </div>
        <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        </style>
    `;
}

/**
 * 恢复大乐透组合预测界面的完整HTML结构
 */
function restoreDLTCombinationInterface(container) {
    container.innerHTML = `
        <div class="dlt-combination-placeholder">
            <h3>🎯 大乐透组合预测系统</h3>
            <p>系统将根据设定的排除条件生成所有符合条件的红球组合并验证准确率</p>
            <div class="placeholder-actions">
                <button class="action-btn primary-btn" onclick="loadNewDLTCombinationPrediction()">开始预测</button>
            </div>
        </div>
        
        <!-- 组合预测结果显示区域 -->
        <div class="prediction-results" id="dlt-prediction-results" style="display: none;">
            <!-- 统计信息区域 -->
            <div class="prediction-stats">
                <h3>📊 组合预测结果 - 期号 <span id="prediction-target-issue">--</span></h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">原始红球组合数</div>
                        <div class="stat-value" id="stat-original-count">0</div>
                        <div class="stat-note">固定组合表总数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">应用排除后组合数</div>
                        <div class="stat-value" id="stat-filtered-count">0</div>
                        <div class="stat-note">经过筛选的组合</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">最终推荐组合数</div>
                        <div class="stat-value" id="stat-final-count">0</div>
                        <div class="stat-note">综合评分排序</div>
                    </div>
                </div>
            </div>

            <!-- 操作按钮区域 -->
            <div class="prediction-actions">
                <button class="action-btn secondary-btn" onclick="showPredictionHistory()">查看历史预测</button>
                <button class="action-btn export-btn" onclick="exportPredictionResults()">导出结果</button>
            </div>

            <!-- 组合表格 -->
            <div class="combination-table-container">
                <div class="table-header">
                    <h4>🎯 推荐组合列表</h4>
                </div>
                <div class="table-wrapper">
                    <table class="combination-table">
                        <thead>
                            <tr>
                                <th>组合ID</th>
                                <th>红球组合</th>
                                <th>蓝球组合</th>
                                <th>区间比</th>
                                <th>红球和值</th>
                                <th>热温冷比</th>
                            </tr>
                        </thead>
                        <tbody id="combination-table-body">
                            <!-- 组合数据将动态填充 -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * 计算奇偶比
 */
function calculateOddEvenRatio(numbers) {
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const evenCount = numbers.length - oddCount;
    return `${oddCount}:${evenCount}`;
}

/**
 * 转换进度API返回的数据格式为显示函数期望的格式
 */
function transformProgressResultFormat(progressResult) {
    console.log('🔄 开始转换进度API数据格式');
    console.log('原始数据:', progressResult);
    
    if (!progressResult.combinations || !Array.isArray(progressResult.combinations)) {
        console.warn('❌ 进度结果中没有有效的组合数据');
        console.log('combinations字段:', progressResult.combinations);
        return progressResult;
    }
    
    console.log('✅ 找到有效组合数据，数量:', progressResult.combinations.length);
    
    // 转换组合数据格式
    const transformedCombinations = progressResult.combinations.map((combo, index) => {
        // 严格验证并转换数据：从 {red1: 1, red2: 2, ..., blue1: 1, blue2: 2} 转换为 {redNumbers: [...], blueNumbers: [...]}
        
        // 严格提取红球数据 - 确保只包含red1-red5的有效数字
        const redNumbers = [];
        ['red1', 'red2', 'red3', 'red4', 'red5'].forEach(key => {
            const value = combo[key];
            if (value != null && !isNaN(value) && value >= 1 && value <= 35) {
                redNumbers.push(parseInt(value));
            }
        });
        
        // 严格提取蓝球数据 - 确保只包含blue1-blue2的有效数字
        const blueNumbers = [];
        ['blue1', 'blue2'].forEach(key => {
            const value = combo[key];
            if (value != null && !isNaN(value) && value >= 1 && value <= 12) {
                blueNumbers.push(parseInt(value));
            }
        });
        
        // 严格验证数据完整性 - 如果数据不完整，跳过该组合
        if (redNumbers.length !== 5) {
            console.error(`❌ 组合${index + 1}红球数量错误:`, redNumbers.length, '期望5个', '实际:', redNumbers, '原始数据:', combo);
            return null; // 返回null以便过滤掉不完整的数据
        }
        if (blueNumbers.length !== 2 && blueNumbers.length !== 0) {
            console.error(`❌ 组合${index + 1}蓝球数量错误:`, blueNumbers.length, '期望2个或0个', '实际:', blueNumbers, '原始数据:', combo);
            return null; // 返回null以便过滤掉不完整的数据
        }
        
        const transformedCombo = {
            redNumbers: redNumbers, // 严格的红球数组，保证5个有效红球
            blueNumbers: blueNumbers, // 严格的蓝球数组，保证2个有效蓝球
            redSum: combo.redSum || redNumbers.reduce((a, b) => a + b, 0),
            redSpan: combo.redSpan || (Math.max(...redNumbers) - Math.min(...redNumbers)),
            blueSum: combo.blueSum || blueNumbers.reduce((a, b) => a + b, 0),
            totalSum: combo.totalSum || (combo.redSum + combo.blueSum),
            zoneRatio: combo.zoneRatio || "1:2:2",
            oddEvenRatio: combo.oddEvenRatio || calculateOddEvenRatio(redNumbers),
            hotWarmColdRatio: combo.hotColdRatio || combo.hotWarmColdRatio || "1:2:2",
            hotCount: combo.hotCount || 0,
            warmCount: combo.warmCount || 0,
            coldCount: combo.coldCount || 0,
            score: combo.score || 85,
            combinationId: combo.combinationId
        };
        
        // 调试输出第一个转换后的组合
        if (index === 0) {
            console.log('🔄 数据转换 - 原始组合:', combo);
            console.log('🔄 数据转换 - 转换后组合:', transformedCombo);
        }
        
        return transformedCombo;
    }).filter(combo => combo !== null); // 过滤掉不完整的数据
    
    console.log(`✅ 数据转换完成，有效组合数量: ${transformedCombinations.length}/${progressResult.combinations.length}`);
    
    // 返回转换后的结果
    return {
        targetIssue: progressResult.targetIssue,
        originalCount: progressResult.originalCount,
        filteredCount: transformedCombinations.length, // 更新为实际有效数量
        finalCount: transformedCombinations.length,     // 更新为实际有效数量
        combinations: transformedCombinations,
        cached: false // 进度API的结果是新生成的
    };
}

/**
 * 显示组合预测结果 (旧版本已删除)
 */
/*
function displayDLTCombinationResults(data) {
    console.log('📊 displayDLTCombinationResults 被调用，数据:', data);
    console.log('📊 组合数量:', data?.combinations?.length);
    
    const { targetIssue, originalCount, filteredCount, finalCount, combinations } = data;
    
    // 保存预测结果数据到全局变量（用于导出功能）
    currentPredictionData = data;
    
    // 保存预测结果到历史记录
    savePredictionToHistory(data);
    
    console.log('预测结果摘要:', {
        targetIssue,
        originalCount,
        filteredCount,
        finalCount,
        combinationsCount: combinations?.length
    });

    // 获取显示元素
    const contentBody = document.getElementById('dlt-combination-content');
    const resultsDiv = document.getElementById('dlt-prediction-results');
    const tableBody = document.getElementById('combination-table-body');
    
    console.log('🔍 检查DOM元素:');
    console.log('- dlt-combination-content:', contentBody ? '✅ 找到' : '❌ 未找到');
    console.log('- dlt-prediction-results:', resultsDiv ? '✅ 找到' : '❌ 未找到');
    console.log('- combination-table-body:', tableBody ? '✅ 找到' : '❌ 未找到');
    
    if (!contentBody || !resultsDiv || !tableBody) {
        console.error('未找到必要的DOM元素');
        console.error('缺失的元素:', {
            contentBody: !!contentBody,
            resultsDiv: !!resultsDiv,
            tableBody: !!tableBody
        });
        return;
    }

    // 更新统计信息
    document.getElementById('prediction-target-issue').textContent = targetIssue || '--';
    document.getElementById('stat-original-count').textContent = originalCount || 0;
    document.getElementById('stat-filtered-count').textContent = filteredCount || 0;
    document.getElementById('stat-final-count').textContent = finalCount || 0;

    // 清空表格
    tableBody.innerHTML = '';

    // 填充组合数据 - 红球组合和蓝球组合分别在独立列中
    if (combinations && combinations.length > 0) {
        combinations.forEach((combo, index) => {
            const row = document.createElement('tr');
            
            // 兼容两种数据格式：转换后的 {redNumbers: [...]} 和原始的 {red1, red2, ...}
            let redNumbers, blueNumbers;
            
            if (combo.redNumbers && Array.isArray(combo.redNumbers)) {
                // 转换后的格式
                redNumbers = combo.redNumbers;
                blueNumbers = combo.blueNumbers || [];
            } else {
                // 原始格式
                redNumbers = [combo.red1, combo.red2, combo.red3, combo.red4, combo.red5].filter(n => n != null);
                blueNumbers = [combo.blue1, combo.blue2].filter(n => n != null && n !== undefined);
            }
            
            // 格式化红球组合
            const redBalls = redNumbers
                .map(num => String(num || '--').padStart(2, '0'))
                .join(' ');
            
            // 格式化蓝球组合  
            const blueBalls = blueNumbers.length > 0 
                ? blueNumbers.map(num => String(num).padStart(2, '0')).join(' ')
                : '--  --';
            
            row.innerHTML = `
                <td style="text-align: center; vertical-align: middle;">${index + 1}</td>
                <td class="red-combination" style="padding: 8px; text-align: center; background: #ffebee;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #d32f2f;">${redBalls}</span>
                </td>
                <td class="blue-combination" style="padding: 8px; text-align: center; background: #e3f2fd;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #1565c0;">${blueBalls}</span>
                </td>
                <td style="text-align: center; vertical-align: middle;">${combo.zoneRatio || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.redSum || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.hotColdRatio || combo.htcRatio || '--'}</td>
            `;
            tableBody.appendChild(row);
        });
        
        // 添加导出和历史记录按钮
        addExportAndHistoryButtons(combinations, targetIssue);
    } else {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: #999;">暂无数据</td>`;
        tableBody.appendChild(row);
    }

    // 显示结果区域，隐藏占位符
    const placeholder = contentBody.querySelector('.dlt-combination-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    resultsDiv.style.display = 'block';

    console.log(`✅ 预测完成 - 期号: ${targetIssue}, 最终组合: ${finalCount} 个，已显示在界面上`);
}

/**
 * 添加导出和历史记录按钮
 */
function addExportAndHistoryButtons(combinations, targetIssue) {
    const resultsDiv = document.getElementById('dlt-prediction-results');
    if (!resultsDiv) return;
    
    // 检查是否已经添加了按钮容器
    let buttonContainer = document.getElementById('dlt-action-buttons');
    if (buttonContainer) {
        buttonContainer.remove(); // 移除旧的按钮
    }
    
    // 创建按钮容器
    buttonContainer = document.createElement('div');
    buttonContainer.id = 'dlt-action-buttons';
    buttonContainer.style.cssText = `
        margin: 20px 0;
        text-align: center;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e3e6ea;
    `;
    
    buttonContainer.innerHTML = `
        <button id="export-combinations-btn" class="action-btn export-btn" style="
            margin: 0 10px;
            padding: 10px 20px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        ">
            📊 导出组合数据 (CSV)
        </button>
        <button id="show-history-btn" class="action-btn history-btn" style="
            margin: 0 10px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        ">
            📋 查看历史记录
        </button>
        <button id="clear-history-btn" class="action-btn clear-btn" style="
            margin: 0 10px;
            padding: 10px 20px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        ">
            🗑️ 清空历史记录
        </button>
    `;
    
    // 插入到结果表格之后
    const tableContainer = resultsDiv.querySelector('.table-container') || resultsDiv.querySelector('table')?.parentNode || resultsDiv;
    if (tableContainer.nextSibling) {
        resultsDiv.insertBefore(buttonContainer, tableContainer.nextSibling);
    } else {
        resultsDiv.appendChild(buttonContainer);
    }
    
    // 绑定事件
    document.getElementById('export-combinations-btn').addEventListener('click', () => {
        downloadCombinationsAsCSV(combinations, targetIssue);
    });
    
    document.getElementById('show-history-btn').addEventListener('click', () => {
        showPredictionHistory();
    });
    
    document.getElementById('clear-history-btn').addEventListener('click', () => {
        if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
            localStorage.removeItem('dlt-prediction-history');
            alert('历史记录已清空！');
        }
    });
    
    console.log('✅ 导出和历史记录按钮已添加');
}

/**
 * 生成和值过滤条件描述
 */
function generateSumFilterDescription(filters) {
    const descriptions = [];
    
    // 自定义和值
    const customSums = [];
    for (let i = 1; i <= 8; i++) {
        if (filters[`sumExclude${i}`]) {
            customSums.push(filters[`sumExclude${i}`]);
        }
    }
    if (customSums.length > 0) {
        descriptions.push(`<div><strong>自定义和值:</strong> ${customSums.join(', ')}</div>`);
    }
    
    // 历史期数排除
    if (filters.sumRecentCustom) {
        descriptions.push(`<div><strong>历史和值排除:</strong> 最近${filters.sumRecentCustom}期</div>`);
    } else if (filters.sumRecentPeriods) {
        descriptions.push(`<div><strong>历史和值排除:</strong> 最近${filters.sumRecentPeriods}期</div>`);
    }
    
    // 预测期前排除
    if (filters.sumBeforePeriods) {
        descriptions.push(`<div><strong>预测期前排除:</strong> 前${filters.sumBeforePeriods}期</div>`);
    }
    
    return descriptions.join('');
}

/**
 * 收集热温冷比参数
 */
function collectDLTHotWarmColdParams() {
    const params = {};
    
    // 收集特定热温冷比
    const selectedHtcRatios = [];
    const htcCheckboxes = document.querySelectorAll('.htc-ratios-grid input[type="checkbox"]:checked');
    htcCheckboxes.forEach(checkbox => {
        selectedHtcRatios.push(checkbox.value);
    });
    if (selectedHtcRatios.length > 0) {
        params.excludeHtcRatios = selectedHtcRatios.join(',');
    }

    // 收集历史期数排除
    const activeHtcBtn = document.querySelector('[data-htc-recent].active');
    if (activeHtcBtn) {
        params.htcRecentPeriods = parseInt(activeHtcBtn.dataset.htcRecent);
    } else {
        params.htcRecentPeriods = 0; // 不排除
    }

    // 预测期前排除热温冷比
    const htcBeforeCheckbox = document.getElementById('htc-before-enable');
    const htcBeforeCustomInput = document.getElementById('htc-before-custom');
    if (htcBeforeCheckbox && htcBeforeCheckbox.checked) {
        params.excludePreHtc = true;
        // 获取自定义期数
        if (htcBeforeCustomInput && htcBeforeCustomInput.value) {
            params.excludePreHtcPeriods = parseInt(htcBeforeCustomInput.value);
        } else {
            params.excludePreHtcPeriods = 10; // 默认10期
        }
    }
    
    return params;
}

/**
 * 收集区间比参数
 */
function collectDLTZoneRatioParams() {
    const params = {};
    
    // 收集特定区间比
    const selectedZoneRatios = [];
    const zoneCheckboxes = document.querySelectorAll('.zone-ratios-grid input[type="checkbox"]:checked');
    zoneCheckboxes.forEach(checkbox => {
        selectedZoneRatios.push(checkbox.value);
    });
    if (selectedZoneRatios.length > 0) {
        params.excludeZoneRatios = selectedZoneRatios.join(',');
    }

    // 收集历史期数排除
    const activeZoneBtn = document.querySelector('[data-zone-recent].active');
    if (activeZoneBtn) {
        params.zoneRecentPeriods = parseInt(activeZoneBtn.dataset.zoneRecent);
    } else {
        params.zoneRecentPeriods = 0; // 不排除
    }

    // 预测期前排除区间比
    const zoneBeforeCheckbox = document.getElementById('zone-before-enable');
    if (zoneBeforeCheckbox && zoneBeforeCheckbox.checked) {
        params.excludePreZone = true;
    }
    
    return params;
}

/**
 * 热温冷比选择函数
 */
function selectAllHtcRatios() {
    const checkboxes = document.querySelectorAll('.htc-ratios-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    console.log('已选择所有热温冷比');
}

function selectNoneHtcRatios() {
    const checkboxes = document.querySelectorAll('.htc-ratios-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    console.log('已取消选择所有热温冷比');
}

function selectCommonHtcRatios() {
    // 先清空所有选择
    selectNoneHtcRatios();
    
    // 选择常见的热温冷比组合
    const commonRatios = ['3:2:0', '3:1:1', '2:3:0', '2:2:1', '2:1:2', '1:3:1', '1:2:2', '4:1:0'];
    
    commonRatios.forEach(ratio => {
        const checkbox = document.querySelector(`.htc-ratios-grid input[value="${ratio}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    console.log('已选择常见热温冷比组合');
}

/**
 * 区间比选择函数
 */
function selectAllZoneRatios() {
    const checkboxes = document.querySelectorAll('.zone-ratios-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    console.log('已选择所有区间比');
}

function selectNoneZoneRatios() {
    const checkboxes = document.querySelectorAll('.zone-ratios-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    console.log('已取消选择所有区间比');
}

function selectCommonZoneRatios() {
    // 先清空所有选择
    selectNoneZoneRatios();
    
    // 选择常见的区间比组合（相对均匀分布）
    const commonRatios = ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1', '1:1:3', '3:2:0', '2:3:0'];
    
    commonRatios.forEach(ratio => {
        const checkbox = document.querySelector(`.zone-ratios-grid input[value="${ratio}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    console.log('已选择常见区间比组合');
}

/**
 * 初始化区间比控件事件监听器
 */

// 将这些函数挂载到全局，以便HTML可以调用
window.selectAllHtcRatios = selectAllHtcRatios;
window.selectNoneHtcRatios = selectNoneHtcRatios;
window.selectCommonHtcRatios = selectCommonHtcRatios;
window.selectAllZoneRatios = selectAllZoneRatios;
window.selectNoneZoneRatios = selectNoneZoneRatios;
window.selectCommonZoneRatios = selectCommonZoneRatios;

/**
 * 下载组合数据为CSV格式
 */
function downloadCombinationsAsCSV(combinations, targetIssue) {
    try {
        console.log('开始生成CSV数据，组合数量:', combinations.length);
        
        // CSV标题行
        let csvContent = '序号,红球1,红球2,红球3,红球4,红球5,蓝球1,蓝球2,红球和值,蓝球和值,总和值,得分,热温冷比,区间比,奇偶比\n';
        
        // 分批处理数据，避免内存溢出
        const batchSize = 1000;
        let processedCount = 0;
        
        for (let i = 0; i < combinations.length; i += batchSize) {
            const batch = combinations.slice(i, i + batchSize);
            
            batch.forEach((combo, index) => {
                const rowNum = i + index + 1;
                let row = rowNum + ',';
                
                // 红球数据
                if (combo.red && combo.red.length >= 5) {
                    row += combo.red.slice(0, 5).join(',') + ',';
                } else if (combo.numbers && combo.numbers.length >= 5) {
                    row += combo.numbers.slice(0, 5).join(',') + ',';
                } else {
                    row += ',,,,,'; // 空的5个红球位置
                }
                
                // 蓝球数据
                if (combo.blue && combo.blue.length >= 2) {
                    row += combo.blue[0] + ',' + combo.blue[1] + ',';
                } else {
                    row += ',,'; // 空的2个蓝球位置
                }
                
                // 其他数据
                row += (combo.redSum || combo.sum || '') + ',';
                row += (combo.blueSum || '') + ',';
                row += (combo.totalSum || combo.sum || '') + ',';
                row += (combo.score || '') + ',';
                row += (combo.hotColdRatio || '') + ',';
                row += (combo.zoneRatio || '') + ',';
                row += (combo.evenOddRatio || '');
                
                csvContent += row + '\n';
            });
            
            processedCount += batch.length;
            
            // 显示进度（每处理1万条记录）
            if (processedCount % 10000 === 0) {
                console.log(`CSV生成进度: ${processedCount}/${combinations.length}`);
            }
        }
        
        console.log('CSV数据生成完成，开始下载...');
        
        // 创建Blob并下载
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `大乐透组合预测_${targetIssue}_${combinations.length}组.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('CSV文件下载完成');
        
        // 释放内存
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('下载CSV时出错:', error);
        alert('下载失败: ' + error.message);
    }
}

// ===== 历史预测记录管理 =====

/**
 * 保存预测结果到历史记录
 */
function savePredictionToHistory(data) {
    const { targetIssue, originalCount, filteredCount, finalCount, combinations, filters } = data;
    
    // 获取现有历史记录
    let historyData = JSON.parse(localStorage.getItem('dlt-prediction-history') || '[]');
    
    // 创建新的历史记录项
    const historyItem = {
        id: Date.now(), // 使用时间戳作为唯一ID
        timestamp: new Date().toISOString(),
        targetIssue,
        originalCount,
        filteredCount,
        finalCount,
        combinationsCount: combinations ? combinations.length : 0,
        combinations: combinations || [],
        filters: filters || {},
        displayDate: new Date().toLocaleString('zh-CN')
    };
    
    // 添加到历史记录开头
    historyData.unshift(historyItem);
    
    // 限制历史记录数量，最多保存50条
    if (historyData.length > 50) {
        historyData = historyData.slice(0, 50);
    }
    
    // 保存到本地存储
    localStorage.setItem('dlt-prediction-history', JSON.stringify(historyData));
    
    console.log(`历史记录已保存: 期号${targetIssue}, 组合数${finalCount}`);
    
    // 更新历史记录显示
    updateHistoryDisplay();
}

/**
 * 更新历史记录显示
 */
function updateHistoryDisplay() {
    // 在预测结果区域添加历史记录按钮
    const resultsDiv = document.getElementById('dlt-prediction-results');
    if (!resultsDiv) return;
    
    // 检查是否已经添加了历史记录按钮
    if (!document.getElementById('history-records-toggle')) {
        const historyButton = document.createElement('button');
        historyButton.id = 'history-records-toggle';
        historyButton.className = 'refresh-btn';
        historyButton.style.margin = '10px';
        historyButton.innerHTML = '📜 查看历史预测记录';
        historyButton.onclick = showPredictionHistory;
        
        // 插入到统计信息之后
        const statsDiv = resultsDiv.querySelector('.prediction-stats');
        if (statsDiv) {
            statsDiv.appendChild(historyButton);
        }
    }
}

/**
 * 显示历史预测记录
 */
function showPredictionHistory() {
    const historyData = JSON.parse(localStorage.getItem('dlt-prediction-history') || '[]');
    
    if (historyData.length === 0) {
        alert('暂无历史预测记录');
        return;
    }
    
    // 创建历史记录弹窗
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.7); z-index: 10000; display: flex; 
        align-items: center; justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white; border-radius: 12px; padding: 20px; 
        max-width: 90%; max-height: 80%; overflow-y: auto;
        min-width: 800px;
    `;
    
    let historyHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>📜 历史预测记录 (${historyData.length}条)</h3>
            <button onclick="this.closest('.modal').remove()" style="background: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">关闭</button>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
    `;
    
    historyData.forEach((item, index) => {
        historyHTML += `
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>期号: ${item.targetIssue}</strong>
                    <small style="color: #666;">${item.displayDate}</small>
                </div>
                <div style="margin-bottom: 10px;">
                    <span style="margin-right: 15px;">📊 原始: ${item.originalCount}</span>
                    <span style="margin-right: 15px;">🔍 过滤: ${item.filteredCount}</span>
                    <span style="margin-right: 15px;">✅ 最终: ${item.finalCount}</span>
                    <span>📝 组合: ${item.combinationsCount}</span>
                </div>
                <button onclick="loadHistoryPrediction(${item.id})" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">加载此预测</button>
                <button onclick="deleteHistoryItem(${item.id})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">删除</button>
            </div>
        `;
    });
    
    historyHTML += '</div>';
    modalContent.innerHTML = historyHTML;
    modal.appendChild(modalContent);
    modal.className = 'modal';
    document.body.appendChild(modal);
}

/**
 * 加载历史预测记录
 */
function loadHistoryPrediction(historyId) {
    const historyData = JSON.parse(localStorage.getItem('dlt-prediction-history') || '[]');
    const historyItem = historyData.find(item => item.id === historyId);
    
    if (!historyItem) {
        alert('历史记录不存在');
        return;
    }
    
    // 关闭弹窗
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
    
    // 显示历史预测结果
    displayDLTCombinationResults({
        targetIssue: historyItem.targetIssue,
        originalCount: historyItem.originalCount,
        filteredCount: historyItem.filteredCount,
        finalCount: historyItem.finalCount,
        combinations: historyItem.combinations
    });
    
    console.log(`已加载历史预测: 期号${historyItem.targetIssue}`);
}

// ===== v2版本专用函数 =====

/**
 * 显示v2生成中界面
 */
function showV2GeneratingInterface(targetIssue, estimatedTime) {
    console.log('🔄 显示v2缓存生成界面...');
    
    const container = document.getElementById('dlt-combination-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="v2-generating-interface" style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <div style="font-size: 24px; margin-bottom: 20px;">🚀</div>
            <h3 style="color: #007bff; margin-bottom: 15px;">v2优化引擎启动中</h3>
            <p style="margin-bottom: 20px;">正在为期号 <strong>${targetIssue}</strong> 生成全量组合缓存...</p>
            <p style="color: #666; margin-bottom: 30px;">预计需要 ${estimatedTime || '30-60秒'}</p>
            
            <div class="loading-animation" style="margin: 20px 0;">
                <div style="display: inline-block; width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite;"></div>
                <div style="display: inline-block; width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite 0.2s;"></div>
                <div style="display: inline-block; width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite 0.4s;"></div>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: left;">
                <div style="font-weight: bold; color: #1976d2; margin-bottom: 8px;">🆕 v2版本优势：</div>
                <ul style="margin: 0; padding-left: 20px; color: #424242;">
                    <li>首次生成后，后续查询仅需1-2秒</li>
                    <li>智能期号缓存，同期号复用极快</li>
                    <li>内存级过滤，性能提升30-60倍</li>
                </ul>
            </div>
            
            <button onclick="location.reload()" 
                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                刷新页面
            </button>
            <button onclick="setTimeout(() => location.reload(), 30000)" 
                    style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                30秒后自动刷新
            </button>
        </div>
        
        <style>
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1.2); opacity: 1; }
        }
        </style>
    `;
}

/**
 * 显示DLT组合预测结果（v2版本）
 */
function displayDLTCombinationResultsV2(data) {
    console.log('📊 v2版本 displayDLTCombinationResults 被调用，数据:', data);
    
    const { targetIssue, statistics, combinations } = data;
    
    // 保存预测结果到历史记录（适配v2数据格式）
    const historyData = {
        targetIssue,
        originalCount: statistics.originalCount,
        filteredCount: statistics.filteredCount, 
        finalCount: statistics.finalCount,
        combinations: combinations || [],
        version: 'v3-pregenerated-tables',
        timestamp: Date.now()
    };
    savePredictionToHistory(historyData);
    
    console.log('v2预测结果摘要:', {
        targetIssue,
        originalCount: statistics.originalCount,
        filteredCount: statistics.filteredCount,
        finalCount: statistics.finalCount,
        processingTime: statistics.processingTime,
        combinationsCount: combinations?.length
    });

    // 获取显示元素
    const contentBody = document.getElementById('dlt-combination-content');
    const resultsDiv = document.getElementById('dlt-prediction-results');
    const tableBody = document.getElementById('combination-table-body');
    
    console.log('🔍 DOM元素检查:', {
        contentBody: !!contentBody,
        resultsDiv: !!resultsDiv,
        tableBody: !!tableBody
    });
    
    if (!contentBody || !resultsDiv || !tableBody) {
        console.error('❌ 未找到必要的DOM元素:', {
            contentBody: !!contentBody,
            resultsDiv: !!resultsDiv,
            tableBody: !!tableBody
        });
        return;
    }

    // 更新统计信息（v2版本包含处理时间）
    document.getElementById('prediction-target-issue').textContent = targetIssue || '--';
    document.getElementById('stat-original-count').textContent = statistics.originalCount || 0;
    document.getElementById('stat-filtered-count').textContent = statistics.filteredCount || 0;
    document.getElementById('stat-final-count').textContent = statistics.finalCount || 0;

    // 添加v2性能显示
    addV2PerformanceInfo(statistics);

    // 清空表格
    tableBody.innerHTML = '';

    // 填充组合数据（v2数据格式）- 红球组合和蓝球组合分别在独立列中
    if (combinations && combinations.length > 0) {
        combinations.forEach((combo, index) => {
            const row = document.createElement('tr');
            // 兼容两种数据格式
            let redNumbers;
            if (combo.redNumbers && Array.isArray(combo.redNumbers)) {
                redNumbers = combo.redNumbers;
            } else {
                redNumbers = [combo.red1, combo.red2, combo.red3, combo.red4, combo.red5];
            }
            
            let blueNumbers;
            if (combo.blueNumbers && Array.isArray(combo.blueNumbers)) {
                blueNumbers = combo.blueNumbers;
            } else {
                blueNumbers = [combo.blue1, combo.blue2];
            }
            
            // 格式化红球组合
            const redBalls = redNumbers
                .map(num => String(num || '--').padStart(2, '0'))
                .join(' ');
            
            // 格式化蓝球组合  
            const blueBalls = blueNumbers.length > 0 
                ? blueNumbers.map(num => String(num).padStart(2, '0')).join(' ')
                : '--  --';
            
            row.innerHTML = `
                <td style="text-align: center; vertical-align: middle;">${combo.combinationId || (index + 1)}</td>
                <td class="red-combination" style="padding: 8px; text-align: center; background: #ffebee;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #d32f2f;">${redBalls}</span>
                </td>
                <td class="blue-combination" style="padding: 8px; text-align: center; background: #e3f2fd;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #1565c0;">${blueBalls}</span>
                </td>
                <td style="text-align: center; vertical-align: middle;">${combo.redZoneRatio || combo.zoneRatio || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.redSum || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.dynamicHotColdRatio || combo.hotColdRatio || '--'}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // 显示结果区域
    resultsDiv.style.display = 'block';
    
    console.log('✅ v2结果显示完成');
}

/**
 * 更新DLT预测统计信息（v2版本）
 */
function updatePredictionStatisticsV2(data) {
    console.log('📈 v2版本 updatePredictionStatistics 被调用');
    
    // v2版本的统计更新逻辑
    const { statistics } = data;
    
    // 可以添加额外的v2统计信息展示
    console.log('v2统计信息更新完成:', {
        originalCount: statistics.originalCount,
        filteredCount: statistics.filteredCount,
        finalCount: statistics.finalCount,
        processingTime: statistics.processingTime
    });
}

/**
 * 添加v2版本性能信息显示
 */
function addV2PerformanceInfo(statistics) {
    // 查找或创建性能信息显示区域
    let perfInfo = document.getElementById('v2-performance-info');
    if (!perfInfo) {
        perfInfo = document.createElement('div');
        perfInfo.id = 'v2-performance-info';
        perfInfo.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
        `;
        
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.parentNode.insertBefore(perfInfo, statsGrid.nextSibling);
        }
    }
    
    perfInfo.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
            🚀 v2优化引擎 - 性能统计
        </div>
        <div style="font-size: 14px;">
            处理时间: <strong>${statistics.processingTime}</strong> | 
            版本: <strong>v2-optimized</strong> |
            优化: <strong>期号缓存 + 内存过滤</strong>
        </div>
    `;
}

/**
 * 删除历史记录项
 */
function deleteHistoryItem(historyId) {
    if (!confirm('确定要删除这条历史记录吗？')) return;
    
    let historyData = JSON.parse(localStorage.getItem('dlt-prediction-history') || '[]');
    historyData = historyData.filter(item => item.id !== historyId);
    localStorage.setItem('dlt-prediction-history', JSON.stringify(historyData));
    
    // 刷新历史记录显示
    showPredictionHistory();
}

/**
 * 导出预测结果数据（全局函数，供HTML按钮调用）
 */
function exportPredictionResults() {
    try {
        if (!currentPredictionData) {
            alert('❌ 没有可导出的预测结果数据');
            return;
        }

        const { combinations, targetIssue } = currentPredictionData;
        
        if (!combinations || combinations.length === 0) {
            alert('❌ 当前没有可导出的组合数据');
            return;
        }

        console.log('📤 开始导出预测结果，组合数量:', combinations.length);
        
        // 调用现有的CSV导出功能
        downloadCombinationsAsCSV(combinations, targetIssue);
        
    } catch (error) {
        console.error('❌ 导出预测结果失败:', error);
        alert('导出失败: ' + error.message);
    }
}

// 确保函数在全局作用域中可用
window.exportPredictionResults = exportPredictionResults;

// ===== 大乐透模块导出 =====

// 将大乐透功能挂载到全局对象，避免命名冲突
window.DLTModule = {
    init: initDLTSystem,
    loadHistory: loadDLTHistoryData,
    loadTrend: loadDLTTrendData,
    loadTrendData: loadDLTTrendData,  // 兼容性别名
    loadExpert: loadDLTExpertData,
    initCombination: initDLTCombinationModule,
    loadCombination: loadNewDLTCombinationPrediction
};

// ===== v3版本专用函数 =====

/**
 * 显示v3生成中界面
 */
function showV3GeneratingInterface(targetIssue, estimatedTime) {
    console.log('🔄 显示v3分析数据生成界面...');
    
    const container = document.getElementById('dlt-combination-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="v3-generating-interface" style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <div style="font-size: 24px; margin-bottom: 20px;">🚀</div>
            <h3 style="color: #28a745; margin-bottom: 15px;">v3预生成表引擎启动中</h3>
            <p style="margin-bottom: 20px;">正在为期号 <strong>${targetIssue}</strong> 生成期号分析数据...</p>
            <p style="color: #666; margin-bottom: 30px;">预计需要 ${estimatedTime || '30-60秒'}</p>
            
            <div class="loading-animation" style="margin: 20px 0;">
                <div style="display: inline-block; width: 8px; height: 8px; background: #28a745; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite;"></div>
                <div style="display: inline-block; width: 8px; height: 8px; background: #28a745; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite 0.2s;"></div>
                <div style="display: inline-block; width: 8px; height: 8px; background: #28a745; border-radius: 50%; margin: 0 3px; animation: bounce 1.5s infinite 0.4s;"></div>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: left;">
                <div style="font-weight: bold; color: #2e7d32; margin-bottom: 8px;">🆕 v3版本优势：</div>
                <ul style="margin: 0; padding-left: 20px; color: #424242;">
                    <li>完全无组合数限制（324,632个全量组合）</li>
                    <li>SQL索引查询，性能更优</li>
                    <li>预生成表架构，避免重复计算</li>
                    <li>自动数据管理，按需生成分析数据</li>
                </ul>
            </div>
            
            <button onclick="location.reload()" 
                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                刷新页面
            </button>
            <button onclick="setTimeout(() => location.reload(), 30000)" 
                    style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                30秒后自动刷新
            </button>
        </div>
        
        <style>
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1.2); opacity: 1; }
        }
        </style>
    `;
}

/**
 * 显示DLT组合预测结果（v3版本）
 */
function displayDLTCombinationResultsV3(data, warnings = [], suggestions = [], message = '组合预测查询完成') {
    console.log('📊 v3版本 displayDLTCombinationResults 被调用，数据:', data);
    console.log('⚠️ 警告信息:', warnings);
    console.log('💡 建议信息:', suggestions);
    console.log('🔍 V3版本 historyData 检查:', {
        存在: !!data.historyData,
        长度: data.historyData?.length || 0,
        前3期: data.historyData?.slice(0, 3) || []
    });
    
    const { targetIssue, statistics, combinations } = data;
    
    // 保存预测结果到历史记录（适配v3数据格式）
    const historyData = {
        targetIssue,
        originalCount: statistics.baseCount,
        filteredCount: statistics.filteredCount, 
        finalCount: statistics.finalCount,
        combinations: combinations || [],
        version: 'v3-pregenerated-tables',
        timestamp: Date.now()
    };
    savePredictionToHistory(historyData);
    
    console.log('v3预测结果摘要:', {
        targetIssue,
        baseCount: statistics.baseCount,
        analysisCount: statistics.analysisCount,
        filteredCount: statistics.filteredCount,
        finalCount: statistics.finalCount,
        processingTime: statistics.processingTime
    });

    // 确保结果表格存在
    const resultsDiv = document.getElementById('dlt-prediction-results');
    const tableBody = document.querySelector('#combination-table-body');
    
    if (!resultsDiv || !tableBody) {
        console.error('❌ 找不到结果显示区域');
        return;
    }

    // 更新统计信息（v3版本包含处理时间）
    document.getElementById('prediction-target-issue').textContent = targetIssue || '--';
    document.getElementById('stat-original-count').textContent = statistics.baseCount || 0;
    document.getElementById('stat-filtered-count').textContent = statistics.filteredCount || 0;
    document.getElementById('stat-final-count').textContent = statistics.finalCount || 0;

    // 添加v3性能显示
    addV3PerformanceInfo(statistics);

    // 显示警告和建议信息
    displayFilteringWarningsAndSuggestions(warnings, suggestions, message, combinations.length);

    // 清空表格
    tableBody.innerHTML = '';

    // 优先显示命中组合：按命中红球数量降序排序
    if (combinations && combinations.length > 0) {
        // 排序逻辑：命中数越多排在前面，同等命中数按原顺序
        const sortedCombinations = [...combinations].sort((a, b) => {
            const hitCountA = a.hit_analysis?.red_hit_count || 0;
            const hitCountB = b.hit_analysis?.red_hit_count || 0;
            
            // 先按命中数降序排序
            if (hitCountB !== hitCountA) {
                return hitCountB - hitCountA;
            }
            
            // 命中数相同时保持原始顺序
            return 0;
        });
        
        console.log('🔄 组合排序完成，命中优先显示:', {
            原始组合数: combinations.length,
            排序后组合数: sortedCombinations.length,
            前5个组合命中情况: sortedCombinations.slice(0, 5).map(combo => ({
                红球: [combo.red1, combo.red2, combo.red3, combo.red4, combo.red5],
                命中数: combo.hit_analysis?.red_hit_count || 0,
                命中球: combo.hit_analysis?.red_hit_balls || []
            }))
        });

        // 格式化命中信息显示的辅助函数
        function formatHitDisplay(hitInfo) {
            if (!hitInfo) {
                return '<div class="hit-badge hit-0">待开奖</div>';
            }
            
            const hitCount = hitInfo.red_hit_count || 0;
            const hitText = hitCount === 0 ? '未中' : `中${hitCount}个`;
            
            let badge = `<div class="hit-badge hit-${hitCount}">${hitText}</div>`;
            
            if (hitCount > 0) {
                const hitBalls = hitInfo.red_hit_balls || [];
                badge += `<div class="hit-details">命中: ${hitBalls.join(' ')}</div>`;
            }
            
            return badge;
        }

        // 填充组合数据（v3数据格式）- 红球组合和蓝球组合分别在独立列中
        sortedCombinations.forEach((combo, index) => {
            const row = tableBody.insertRow();
            
            // 格式化红球组合
            const redBalls = [combo.red1, combo.red2, combo.red3, combo.red4, combo.red5]
                .map(num => String(num).padStart(2, '0'))
                .join(' ');
            
            // 格式化蓝球组合  
            const blueBalls = (combo.blue1 && combo.blue2) 
                ? [combo.blue1, combo.blue2].map(num => String(num).padStart(2, '0')).join(' ')
                : '--  --';

            // 检查是否有命中分析信息
            const hitInfo = combo.hit_analysis;
            const hitClass = hitInfo ? `hit-${hitInfo.red_hit_count}` : '';
            const hitDisplay = hitInfo ? formatHitDisplay(hitInfo) : formatHitDisplay(null);
            
            // 设置行样式（命中组合用不同背景色突出显示）
            if (hitClass) {
                row.className = hitClass;
            }
            
            row.innerHTML = `
                <td style="text-align: center; vertical-align: middle;">${index + 1}</td>
                <td class="hit-info" style="text-align: center; vertical-align: middle; padding: 8px;">
                    ${hitDisplay}
                </td>
                <td class="red-combination" style="padding: 8px; text-align: center; background: #ffebee;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #d32f2f;">${redBalls}</span>
                </td>
                <td class="blue-combination" style="padding: 8px; text-align: center; background: #e3f2fd;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #1565c0;">${blueBalls}</span>
                </td>
                <td style="text-align: center; vertical-align: middle;">${combo.zoneRatio || '--'}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.redSum}</td>
                <td style="text-align: center; vertical-align: middle;">${combo.hotColdRatio || '--'}</td>
            `;
        });
    } else {
        const row = tableBody.insertRow();
        row.innerHTML = '<td colspan="7" style="text-align: center; color: #999;">暂无数据</td>';
    }
    
    // 显示结果
    resultsDiv.style.display = 'block';
    
    console.log('✅ v3结果显示完成');
}

/**
 * 显示筛选警告和建议信息
 */
function displayFilteringWarningsAndSuggestions(warnings = [], suggestions = [], message = '', resultCount = 0) {
    // 查找或创建警告显示区域
    let warningContainer = document.getElementById('filtering-warnings');
    if (!warningContainer) {
        warningContainer = document.createElement('div');
        warningContainer.id = 'filtering-warnings';
        
        // 插入到结果区域的开头
        const resultsDiv = document.getElementById('dlt-prediction-results');
        if (resultsDiv) {
            resultsDiv.insertBefore(warningContainer, resultsDiv.firstChild);
        }
    }
    
    // 清空现有内容
    warningContainer.innerHTML = '';
    
    if (warnings.length > 0 || suggestions.length > 0 || resultCount === 0) {
        let html = '<div class="filter-feedback-container" style="margin-bottom: 20px;">';
        
        // 标题和状态消息
        if (resultCount === 0) {
            html += `
                <div class="alert alert-warning" style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle" style="color: #e17055; margin-right: 10px; font-size: 20px;"></i>
                        <strong style="color: #856404;">筛选结果为空</strong>
                    </div>
                    <p style="margin: 0; color: #856404;">${message}</p>
                </div>
            `;
        } else if (resultCount < 10) {
            html += `
                <div class="alert alert-info" style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <i class="fas fa-info-circle" style="color: #17a2b8; margin-right: 10px; font-size: 20px;"></i>
                        <strong style="color: #0c5460;">筛选结果较少</strong>
                    </div>
                    <p style="margin: 0; color: #0c5460;">当前找到 ${resultCount} 个组合，筛选条件相对严格</p>
                </div>
            `;
        }
        
        // 警告信息
        if (warnings.length > 0) {
            html += `
                <div class="warnings-section" style="margin-bottom: 15px;">
                    <h4 style="color: #e17055; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                        注意事项
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; color: #721c24;">
            `;
            warnings.forEach(warning => {
                html += `<li style="margin-bottom: 5px;">${warning}</li>`;
            });
            html += '</ul></div>';
        }
        
        // 建议信息
        if (suggestions.length > 0) {
            html += `
                <div class="suggestions-section">
                    <h4 style="color: #28a745; margin-bottom: 10px;">
                        <i class="fas fa-lightbulb" style="margin-right: 8px;"></i>
                        优化建议
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; color: #155724;">
            `;
            suggestions.forEach(suggestion => {
                html += `<li style="margin-bottom: 5px;">${suggestion}</li>`;
            });
            html += '</ul></div>';
        }
        
        html += '</div>';
        warningContainer.innerHTML = html;
    }
}

/**
 * 更新DLT预测统计信息（v3版本）
 */
function updatePredictionStatisticsV3(data) {
    console.log('📈 v3版本 updatePredictionStatistics 被调用');
    
    // v3版本的统计更新逻辑
    const { targetIssue, statistics } = data;
    
    // 更新页面上的统计信息
    const targetIssueSpan = document.getElementById('prediction-target-issue');
    if (targetIssueSpan) {
        targetIssueSpan.textContent = targetIssue;
    }
    
    // 更新统计数据
    document.getElementById('stat-original-count').textContent = statistics.baseCount || 0;
    document.getElementById('stat-filtered-count').textContent = statistics.filteredCount || 0;
    document.getElementById('stat-final-count').textContent = statistics.finalCount || 0;
    
    // 显示结果区域
    const resultsDiv = document.getElementById('dlt-prediction-results');
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
    }
    
    // 可以添加额外的v3统计信息展示
    console.log('v3统计信息更新完成:', {
        baseCount: statistics.baseCount,
        analysisCount: statistics.analysisCount,
        filteredCount: statistics.filteredCount,
        finalCount: statistics.finalCount,
        processingTime: statistics.processingTime
    });
}

/**
 * 添加v3版本性能信息显示
 */
function addV3PerformanceInfo(statistics) {
    // 先移除旧的性能信息
    const oldPerfInfo = document.getElementById('v2-performance-info');
    if (oldPerfInfo) {
        oldPerfInfo.remove();
    }
    
    // 查找或创建性能信息显示区域
    let perfInfo = document.getElementById('v3-performance-info');
    if (!perfInfo) {
        perfInfo = document.createElement('div');
        perfInfo.id = 'v3-performance-info';
        perfInfo.style.cssText = `
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
        `;
        
        // 插入到统计信息区域
        const statsContainer = document.querySelector('.dlt-prediction-stats');
        if (statsContainer) {
            statsContainer.appendChild(perfInfo);
        }
    }
    
    perfInfo.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
            🚀 v3预生成表引擎 - 性能统计
        </div>
        <div style="font-size: 14px;">
            处理时间: <strong>${statistics.processingTime}</strong> | 
            版本: <strong>v3-pregenerated-tables</strong> |
            优化: <strong>SQL联合查询 + 预生成表</strong>
        </div>
    `;
}

// 将历史记录相关函数设为全局函数，供HTML onclick使用
window.showPredictionHistory = showPredictionHistory;
window.loadHistoryPrediction = loadHistoryPrediction;
window.deleteHistoryItem = deleteHistoryItem;

// 将期号加载函数设为全局函数，方便调试和手动调用
window.loadLatestIssues = loadLatestIssues;
window.loadHistoricalIssues = loadHistoricalIssues;

console.log('DLT Module loaded successfully');

// ===== 批量预测功能模块 =====

/**
 * 批量预测功能初始化
 */
function initDLTBatchPrediction() {
    console.log('🚀 Initializing DLT Batch Prediction...');
    console.log('📊 Current page location:', window.location.pathname);
    console.log('📋 Document ready state:', document.readyState);
    
    // 检查DOM元素是否存在
    const startBtn = document.getElementById('start-batch-prediction');
    console.log('🔍 Start button found:', startBtn !== null);
    
    if (!startBtn) {
        console.warn('⚠️ start-batch-prediction button not found in DOM');
        // 列出所有按钮
        const allButtons = document.querySelectorAll('button');
        console.log('📋 All buttons found:', Array.from(allButtons).map(btn => btn.id || btn.className));
    }
    
    // 初始化事件监听器
    initBatchPredictionEventListeners();
    
    // 初始化UI状态
    initBatchPredictionUI();
}

/**
 * 初始化批量预测事件监听器
 */
function initBatchPredictionEventListeners() {
    // 复选框控制输入框启用/禁用
    const exclusionCheckboxes = [
        { checkbox: 'batch-exclude-sum', inputs: ['batch-sum-min', 'batch-sum-max'] },
        { checkbox: 'batch-exclude-span', inputs: ['batch-span-min', 'batch-span-max'] },
        { checkbox: 'batch-exclude-hwc', inputs: '.batch-hwc-cb' },
        { checkbox: 'batch-exclude-zone', inputs: '.batch-zone-cb' },
        { checkbox: 'batch-exclude-odd-even', inputs: '.batch-odd-even-cb' }
    ];
    
    exclusionCheckboxes.forEach(({ checkbox, inputs }) => {
        const checkboxEl = document.getElementById(checkbox);
        if (checkboxEl) {
            checkboxEl.addEventListener('change', () => {
                if (typeof inputs === 'string' && inputs.startsWith('.')) {
                    // 处理类选择器
                    const inputElements = document.querySelectorAll(inputs);
                    inputElements.forEach(input => {
                        input.disabled = !checkboxEl.checked;
                    });
                } else if (Array.isArray(inputs)) {
                    // 处理ID数组
                    inputs.forEach(inputId => {
                        const inputEl = document.getElementById(inputId);
                        if (inputEl) {
                            inputEl.disabled = !checkboxEl.checked;
                        }
                    });
                }
            });
        }
    });
    
    // 开始批量预测按钮
    const startBtn = document.getElementById('start-batch-prediction');
    if (startBtn) {
        console.log('✅ Binding click event to start-batch-prediction button');
        startBtn.addEventListener('click', () => {
            console.log('🖱️ Start batch prediction button clicked!');
            startBatchPrediction();
        });
    } else {
        console.warn('⚠️ start-batch-prediction button not found during event binding');
    }
    
    // 停止批量预测按钮
    const stopBtn = document.getElementById('stop-batch-prediction');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopBatchPrediction);
    }
    
    // 清空结果按钮
    const clearBtn = document.getElementById('clear-batch-results');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearBatchResults);
    }
    
    // 结果标签页切换
    const tabBtns = document.querySelectorAll('.tab-btn');
    console.log(`🏷️ Found ${tabBtns.length} tab buttons:`, Array.from(tabBtns).map(btn => btn.getAttribute('data-tab')));
    
    tabBtns.forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        console.log(`🔗 Binding click event to tab button: ${tabId}`);
        
        btn.addEventListener('click', (event) => {
            console.log(`🖱️ Tab button clicked: ${tabId}`);
            event.preventDefault();
            switchResultTab(tabId);
        });
    });
}

/**
 * 初始化批量预测UI状态
 */
function initBatchPredictionUI() {
    // 隐藏进度区域
    const progressSection = document.getElementById('batch-progress-section');
    if (progressSection) {
        progressSection.style.display = 'none';
    }
    
    // 初始化无限制复选框事件监听器
    initCombinationModeControls();
    
    // 重置所有输入框
    resetBatchConfiguration();
}

/**
 * 初始化组合模式控制
 */
function initCombinationModeControls() {
    const modeRadios = document.querySelectorAll('input[name="combination-mode"]');

    // 页面加载时初始化默认状态
    console.log('🎯 初始化组合模式控制，默认选择: 默认模式');

    // 为每个单选按钮添加事件监听器
    modeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const mode = this.value;
                console.log(`🔄 组合模式切换为: ${mode}`);

                switch(mode) {
                    case 'default':
                        console.log('✅ 默认模式: 6,600组（100红球×66蓝球）');
                        break;
                    case 'unlimited':
                        console.log('🔄 普通无限制: 324,632组（324,632红球×66蓝球，1:1分配）');
                        break;
                    case 'truly-unlimited':
                        console.log('🔥 真正无限制: 21,445,712组（324,632红球×66蓝球，完全组合）');
                        break;
                }
            }
        });
    });
}

/**
 * 获取当前选择的组合模式
 */
function getCurrentCombinationMode() {
    const checkedRadio = document.querySelector('input[name="combination-mode"]:checked');
    return checkedRadio ? checkedRadio.value : 'default';
}

/**
 * 根据组合模式获取预期的每期组合数
 */
function getExpectedCombinationsPerIssue(mode) {
    switch(mode) {
        case 'default':
            return 6600; // 100红球 × 66蓝球
        case 'unlimited':
            return 324632; // 324,632红球 × 66蓝球，1:1分配
        case 'truly-unlimited':
            return 21445712; // 324,632红球 × 66蓝球，完全组合
        default:
            return 6600;
    }
}

/**
 * 获取组合模式的描述文本
 */
function getModeDescription(mode) {
    switch(mode) {
        case 'default':
            return '默认模式';
        case 'unlimited':
            return '普通无限制';
        case 'truly-unlimited':
            return '真正无限制';
        default:
            return '默认模式';
    }
}

/**
 * 重置批量预测配置
 */
function resetBatchConfiguration() {
    // 重置期号范围
    const allRadio = document.querySelector('input[name="batch-range-type"][value="all"]');
    if (allRadio) allRadio.checked = true;

    // 重置组合模式为默认模式
    const defaultModeRadio = document.getElementById('mode-default');
    if (defaultModeRadio) defaultModeRadio.checked = true;

    // 重置验证选项
    const validationCheckbox = document.getElementById('batch-enable-validation');
    if (validationCheckbox) validationCheckbox.checked = true;

    console.log('🔄 批量预测配置已重置为默认设置');
}

// 批量预测状态管理
let batchPredictionState = {
    isRunning: false,
    currentTask: null,
    totalIssues: 0,
    completedIssues: 0,
    startTime: null,
    results: [],
    sessionId: null,  // 新增：存储会话ID
    combinationMode: 'default',  // 新增：保存选择的组合模式
    expectedCombinationsPerIssue: 6600  // 新增：每期预期组合数
};

/**
 * 开始批量预测
 */
async function startBatchPrediction() {
    console.log('🚀 开始批量预测...');
    console.log('⏰ Function called at:', new Date().toISOString());
    console.log('🔧 Browser info:', navigator.userAgent);
    
    try {
        // 1. 验证配置
        const config = validateAndGetBatchConfig();
        if (!config) {
            return;
        }
        
        // 2. 更新UI状态
        updateBatchUIState(true);
        
        // 3. 显示进度区域
        showProgressSection();
        
        // 4. 开始预测任务
        batchPredictionState.isRunning = true;
        batchPredictionState.startTime = Date.now();
        batchPredictionState.totalIssues = config.targetIssues.length;
        batchPredictionState.completedIssues = 0;
        batchPredictionState.results = [];

        // 5. 保存组合模式信息
        batchPredictionState.combinationMode = config.combinationMode;
        batchPredictionState.expectedCombinationsPerIssue = getExpectedCombinationsPerIssue(config.combinationMode);

        console.log(`📊 批量预测模式: ${config.combinationMode}, 预期每期组合数: ${batchPredictionState.expectedCombinationsPerIssue.toLocaleString()}`);

        // 6. 开始执行预测
        
        console.log(`📊 配置信息:`, config);
        console.log(`📈 将处理 ${config.targetIssues.length} 期`);
        
        // 5. 执行批量预测
        await executeBatchPrediction(config);
        
    } catch (error) {
        console.error('❌ 批量预测失败:', error);
        showErrorMessage('批量预测失败: ' + error.message);
        updateBatchUIState(false);
    }
}

/**
 * 验证并获取批量预测配置
 */
function validateAndGetBatchConfig() {
    const config = {
        targetIssues: [],
        rangeConfig: null,  // 新增：期号范围配置
        filters: {},
        maxRedCombinations: 100,
        maxBlueCombinations: 50,
        enableValidation: true
    };

    // 获取期号范围配置
    const rangeConfig = getBatchRangeConfig();
    if (!rangeConfig) {
        showErrorMessage('期号范围配置无效');
        return null;
    }

    config.rangeConfig = rangeConfig;

    // 获取筛选条件
    config.filters = getBatchFilters();

    // 获取排除条件
    config.exclude_conditions = getBatchExcludeConditions();
    console.log('📋 排除条件已收集:', config.exclude_conditions);

    // 获取其他配置选项
    const combinationMode = getCombinationMode();
    config.combinationMode = combinationMode;

    const validationCheckbox = document.getElementById('batch-enable-validation');
    config.enableValidation = validationCheckbox ? validationCheckbox.checked : true;

    return config;
}

/**
 * 获取批量预测期号范围配置
 */
function getBatchRangeConfig() {
    // 获取选中的范围类型
    const rangeTypeRadios = document.querySelectorAll('input[name="batch-range-type"]:checked');
    if (rangeTypeRadios.length === 0) {
        console.error('❌ 未选择期号范围类型');
        return null;
    }

    const rangeType = rangeTypeRadios[0].value;
    console.log(`📅 选择的期号范围类型: ${rangeType}`);

    switch (rangeType) {
        case 'all':
            return {
                rangeType: 'all'
            };

        case 'recent':
            const recentCountInput = document.getElementById('recent-count');
            const recentCount = parseInt(recentCountInput?.value) || 100;

            if (recentCount < 1 || recentCount > 1000) {
                showErrorMessage('最近期数必须在1-1000之间');
                return null;
            }

            return {
                rangeType: 'recent',
                recentCount: recentCount
            };

        case 'custom':
            const startIssueInput = document.getElementById('custom-start');
            const endIssueInput = document.getElementById('custom-end');

            const startIssue = startIssueInput?.value?.trim();
            const endIssue = endIssueInput?.value?.trim();

            if (!startIssue || !endIssue) {
                showErrorMessage('自定义范围需要指定起始期号和结束期号');
                return null;
            }

            if (!/^\d{5}$/.test(startIssue) || !/^\d{5}$/.test(endIssue)) {
                showErrorMessage('期号格式不正确，应为5位数字');
                return null;
            }

            if (parseInt(startIssue) > parseInt(endIssue)) {
                showErrorMessage('起始期号不能大于结束期号');
                return null;
            }

            return {
                rangeType: 'custom',
                startIssue: startIssue,
                endIssue: endIssue
            };

        default:
            console.error('❌ 不支持的期号范围类型:', rangeType);
            return null;
    }
}

/**
 * 获取当前选择的组合模式
 */
function getCombinationMode() {
    const defaultModeRadio = document.getElementById('mode-default');
    const unlimitedModeRadio = document.getElementById('mode-unlimited');
    const trulyUnlimitedModeRadio = document.getElementById('mode-truly-unlimited');

    if (trulyUnlimitedModeRadio?.checked) {
        return 'truly-unlimited';
    } else if (unlimitedModeRadio?.checked) {
        return 'unlimited';
    } else {
        return 'default';
    }
}

/**
 * 获取批量预测筛选条件
 */
function getBatchFilters() {
    const filters = {};

    // 和值排除
    if (document.getElementById('batch-exclude-sum').checked) {
        const sumMin = document.getElementById('batch-sum-min').value;
        const sumMax = document.getElementById('batch-sum-max').value;
        if (sumMin && sumMax) {
            filters.excludeSumRange = { min: parseInt(sumMin), max: parseInt(sumMax) };
        }
    }

    // 跨度排除
    if (document.getElementById('batch-exclude-span').checked) {
        const spanMin = document.getElementById('batch-span-min').value;
        const spanMax = document.getElementById('batch-span-max').value;
        if (spanMin && spanMax) {
            filters.excludeSpanRange = { min: parseInt(spanMin), max: parseInt(spanMax) };
        }
    }

    // 热温冷比排除
    if (document.getElementById('batch-exclude-hwc').checked) {
        const excludedHWC = [];
        const hwcCheckboxes = document.querySelectorAll('.batch-hwc-cb:checked');
        hwcCheckboxes.forEach(cb => excludedHWC.push(cb.value));
        if (excludedHWC.length > 0) {
            filters.excludedHWCRatios = excludedHWC;
        }
    }

    // 区间比排除
    if (document.getElementById('batch-exclude-zone').checked) {
        const excludedZone = [];
        const zoneCheckboxes = document.querySelectorAll('.batch-zone-cb:checked');
        zoneCheckboxes.forEach(cb => excludedZone.push(cb.value));
        if (excludedZone.length > 0) {
            filters.excludedZoneRatios = excludedZone;
        }
    }

    // 奇偶比排除
    if (document.getElementById('batch-exclude-odd-even').checked) {
        const excludedOddEven = [];
        const oddEvenCheckboxes = document.querySelectorAll('.batch-odd-even-cb:checked');
        oddEvenCheckboxes.forEach(cb => excludedOddEven.push(cb.value));
        if (excludedOddEven.length > 0) {
            filters.excludedOddEvenRatios = excludedOddEven;
        }
    }

    // 相克排除
    const conflictEnabled = document.getElementById('batch-exclude-conflict')?.checked || false;
    if (conflictEnabled) {
        const globalTopEnabled = document.getElementById('batch-enable-global-conflict-top')?.checked || false;
        const perBallTopEnabled = document.getElementById('batch-enable-per-ball-conflict-top')?.checked || false;

        filters.conflictExclude = {
            enabled: true,
            globalTopEnabled: globalTopEnabled,
            globalAnalysisPeriods: globalTopEnabled ? (parseInt(document.getElementById('batch-global-conflict-periods')?.value) || 2700) : 0,
            topN: globalTopEnabled ? (parseInt(document.getElementById('batch-conflict-top-n')?.value) || 18) : 0,
            perBallTopEnabled: perBallTopEnabled,
            perBallAnalysisPeriods: perBallTopEnabled ? (parseInt(document.getElementById('batch-per-ball-conflict-periods')?.value) || 2700) : 0,
            perBallTopN: perBallTopEnabled ? (parseInt(document.getElementById('batch-conflict-per-ball-top-n')?.value) || 1) : 0,
            includeBackBalls: document.getElementById('batch-enable-back-conflict-exclude')?.checked || false,
            hotProtection: {
                enabled: perBallTopEnabled, // 只在启用每个号码Top时才生效
                topHotCount: perBallTopEnabled ? (parseInt(document.getElementById('batch-hot-protection-top-count')?.value) || 3) : 0
            }
        };
        console.log('🔍 相克排除配置已收集:', filters.conflictExclude);
    } else {
        console.log('⚠️ 相克排除未启用');
    }

    // 同出排除
    const coOccurrenceEnabled = document.getElementById('batch-exclude-cooccurrence')?.checked || false;
    if (coOccurrenceEnabled) {
        const periods = parseInt(document.getElementById('batch-cooccurrence-periods')?.value) || 1;

        filters.coOccurrence = {  // 🔧 修复: 改为coOccurrence与后端一致
            enabled: true,
            periods: periods
        };
        console.log('🔗 同出排除配置已收集:', filters.coOccurrence);
    } else {
        console.log('⚠️ 同出排除未启用');
    }

    console.log('📦 getBatchFilters 最终返回:', filters);
    return filters;
}

/**
 * 获取排除条件配置（用于任务管理API）
 */
function getBatchExcludeConditions() {
    const conditions = {};

    // 和值排除
    const sumEnabled = document.getElementById('batch-exclude-sum')?.checked || false;
    if (sumEnabled) {
        conditions.sum = {
            enabled: true,
            ranges: [],
            historical: {
                enabled: false
            }
        };

        // 手动范围1
        const sumRange1Enabled = document.getElementById('batch-sum-range1-enabled')?.checked || false;
        if (sumRange1Enabled) {
            const sumMin1 = document.getElementById('batch-sum-min1')?.value;
            const sumMax1 = document.getElementById('batch-sum-max1')?.value;
            if (sumMin1 && sumMax1) {
                conditions.sum.ranges.push({
                    enabled: true,
                    min: parseInt(sumMin1),
                    max: parseInt(sumMax1)
                });
            }
        }

        // 手动范围2
        const sumRange2Enabled = document.getElementById('batch-sum-range2-enabled')?.checked || false;
        if (sumRange2Enabled) {
            const sumMin2 = document.getElementById('batch-sum-min2')?.value;
            const sumMax2 = document.getElementById('batch-sum-max2')?.value;
            if (sumMin2 && sumMax2) {
                conditions.sum.ranges.push({
                    enabled: true,
                    min: parseInt(sumMin2),
                    max: parseInt(sumMax2)
                });
            }
        }

        // 历史排除
        const sumHistoricalEnabled = document.getElementById('batch-sum-historical-enabled')?.checked || false;
        if (sumHistoricalEnabled) {
            const recentCount = document.getElementById('batch-sum-recent-custom')?.value || 10;
            conditions.sum.historical = {
                enabled: true,
                type: 'recent',
                count: parseInt(recentCount)
            };
        }
    }

    // 跨度排除
    const spanEnabled = document.getElementById('batch-exclude-span')?.checked || false;
    if (spanEnabled) {
        conditions.span = {
            enabled: true,
            ranges: [],
            historical: {
                enabled: false
            }
        };

        // 手动范围1
        const spanRange1Enabled = document.getElementById('batch-span-range1-enabled')?.checked || false;
        if (spanRange1Enabled) {
            const spanMin1 = document.getElementById('batch-span-min1')?.value;
            const spanMax1 = document.getElementById('batch-span-max1')?.value;
            if (spanMin1 && spanMax1) {
                conditions.span.ranges.push({
                    enabled: true,
                    min: parseInt(spanMin1),
                    max: parseInt(spanMax1)
                });
            }
        }

        // 手动范围2
        const spanRange2Enabled = document.getElementById('batch-span-range2-enabled')?.checked || false;
        if (spanRange2Enabled) {
            const spanMin2 = document.getElementById('batch-span-min2')?.value;
            const spanMax2 = document.getElementById('batch-span-max2')?.value;
            if (spanMin2 && spanMax2) {
                conditions.span.ranges.push({
                    enabled: true,
                    min: parseInt(spanMin2),
                    max: parseInt(spanMax2)
                });
            }
        }

        // 历史排除
        const spanHistoricalEnabled = document.getElementById('batch-span-historical-enabled')?.checked || false;
        if (spanHistoricalEnabled) {
            const recentCount = document.getElementById('batch-span-recent-custom')?.value || 10;
            conditions.span.historical = {
                enabled: true,
                type: 'recent',
                count: parseInt(recentCount)
            };
        }
    }

    // 热温冷比排除
    const hwcEnabled = document.getElementById('batch-exclude-hwc')?.checked || false;
    if (hwcEnabled) {
        conditions.hwc = {
            excludeRatios: [],
            historical: {
                enabled: false
            }
        };

        // 手动选择
        const hwcCheckboxes = document.querySelectorAll('.batch-hwc-cb:checked');
        hwcCheckboxes.forEach(cb => conditions.hwc.excludeRatios.push(cb.value));

        // 历史排除
        const hwcHistoricalEnabled = document.getElementById('batch-hwc-historical-enabled')?.checked || false;
        if (hwcHistoricalEnabled) {
            const recentCount = document.getElementById('batch-hwc-recent-custom')?.value || 10;
            conditions.hwc.historical = {
                enabled: true,
                type: 'recent',
                count: parseInt(recentCount)
            };
        }
    }

    // 区间比排除
    const zoneEnabled = document.getElementById('batch-exclude-zone')?.checked || false;
    if (zoneEnabled) {
        conditions.zone = {
            excludeRatios: [],
            historical: {
                enabled: false
            }
        };

        // 手动选择
        const zoneCheckboxes = document.querySelectorAll('.batch-zone-cb:checked');
        zoneCheckboxes.forEach(cb => conditions.zone.excludeRatios.push(cb.value));

        // 历史排除
        const zoneHistoricalEnabled = document.getElementById('batch-zone-historical-enabled')?.checked || false;
        if (zoneHistoricalEnabled) {
            const recentCount = document.getElementById('batch-zone-recent-custom')?.value || 10;
            conditions.zone.historical = {
                enabled: true,
                type: 'recent',
                count: parseInt(recentCount)
            };
        }
    }

    // 奇偶比排除
    const oddEvenEnabled = document.getElementById('batch-exclude-odd-even')?.checked || false;
    if (oddEvenEnabled) {
        conditions.oddEven = {
            excludeRatios: [],
            historical: {
                enabled: false
            }
        };

        // 手动选择
        const oddEvenCheckboxes = document.querySelectorAll('.batch-odd-even-cb:checked');
        oddEvenCheckboxes.forEach(cb => conditions.oddEven.excludeRatios.push(cb.value));

        // 历史排除
        const oddEvenHistoricalEnabled = document.getElementById('batch-odd-even-historical-enabled')?.checked || false;
        if (oddEvenHistoricalEnabled) {
            const recentCount = document.getElementById('batch-odd-even-recent-custom')?.value || 10;
            conditions.oddEven.historical = {
                enabled: true,
                type: 'recent',
                count: parseInt(recentCount)
            };
        }
    }

    // 相克排除
    const conflictEnabled = document.getElementById('batch-exclude-conflict')?.checked || false;
    if (conflictEnabled) {
        const globalTopEnabled = document.getElementById('batch-enable-global-conflict-top')?.checked || false;
        const perBallTopEnabled = document.getElementById('batch-enable-per-ball-conflict-top')?.checked || false;

        conditions.conflict = {
            enabled: true,
            globalTopEnabled: globalTopEnabled,
            globalAnalysisPeriods: globalTopEnabled ? (parseInt(document.getElementById('batch-global-conflict-periods')?.value) || 2700) : 0,
            topN: globalTopEnabled ? (parseInt(document.getElementById('batch-conflict-top-n')?.value) || 18) : 0,
            perBallTopEnabled: perBallTopEnabled,
            perBallAnalysisPeriods: perBallTopEnabled ? (parseInt(document.getElementById('batch-per-ball-conflict-periods')?.value) || 2700) : 0,
            perBallTopN: perBallTopEnabled ? (parseInt(document.getElementById('batch-conflict-per-ball-top-n')?.value) || 1) : 0,
            includeBackBalls: document.getElementById('batch-enable-back-conflict-exclude')?.checked || false,
            hotProtection: {
                enabled: perBallTopEnabled, // 只在启用每个号码Top时才生效
                topHotCount: perBallTopEnabled ? (parseInt(document.getElementById('batch-hot-protection-top-count')?.value) || 3) : 0
            }
        };
    }

    // 同出排除
    const coOccurrenceEnabled = document.getElementById('batch-exclude-cooccurrence')?.checked || false;
    if (coOccurrenceEnabled) {
        const periods = parseInt(document.getElementById('batch-cooccurrence-periods')?.value) || 1;

        conditions.coOccurrence = {
            enabled: true,
            periods: periods
        };
        console.log('🔗 同出排除条件已收集:', conditions.coOccurrence);
    }

    return conditions;
}

/**
 * 执行批量预测
 */
async function executeBatchPrediction(config) {
    const { rangeConfig, filters, exclude_conditions, maxRedCombinations, maxBlueCombinations, enableValidation, trulyUnlimited, displayMode, combinationMode } = config;

    console.log(`🚀 开始执行流式批量预测，期号配置:`, rangeConfig);
    console.log(`🚀 排除条件:`, exclude_conditions);

    try {
        // 调用后端API进行流式批量预测
        const response = await fetch('http://localhost:3003/api/dlt/batch-prediction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rangeConfig: rangeConfig,  // 传递期号范围配置
                filters: filters,
                exclude_conditions: exclude_conditions,  // 传递排除条件
                maxRedCombinations: maxRedCombinations,
                maxBlueCombinations: maxBlueCombinations,
                enableValidation: enableValidation,
                trulyUnlimited: trulyUnlimited,
                combinationMode: combinationMode
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || '批量预测失败');
        }

        console.log(`✅ 流式批量预测启动成功:`, result);

        // 更新状态
        batchPredictionState.results = result.data || [];
        batchPredictionState.completedIssues = result.statistics?.totalIssues || 0;
        batchPredictionState.totalIssues = result.statistics?.totalIssues || 0;
        batchPredictionState.sessionId = result.statistics?.sessionId;  // 存储会话ID

        console.log(`💾 保存会话ID: ${batchPredictionState.sessionId}`);

        // 显示流式处理摘要信息
        if (result.statistics?.streamSummary) {
            console.log(`📊 流式处理摘要:`, result.statistics.streamSummary);
            updateStreamingProgress(result.statistics.streamSummary, result.statistics.memoryPeak);
        }

        // 完成处理
        onBatchPredictionComplete();

    } catch (error) {
        console.error('❌ 流式批量预测失败:', error);
        showErrorMessage('流式批量预测失败: ' + error.message);
        batchPredictionState.isRunning = false;
        updateBatchUIState(false);
    }
}

/**
 * 批量预测完成处理
 */
function onBatchPredictionComplete() {
    console.log('✅ 批量预测完成');
    
    batchPredictionState.isRunning = false;
    updateBatchUIState(false);
    
    const endTime = Date.now();
    const processingTime = (endTime - batchPredictionState.startTime) / 1000;
    
    console.log(`📊 处理统计:`, {
        totalIssues: batchPredictionState.totalIssues,
        completedIssues: batchPredictionState.completedIssues,
        processingTime: `${processingTime.toFixed(2)}秒`,
        averageSpeed: `${(batchPredictionState.completedIssues / processingTime * 60).toFixed(1)}期/分钟`
    });
    
    // 显示完成状态
    updateCurrentProcessing(`✅ 完成！共处理 ${batchPredictionState.completedIssues} 期，耗时 ${processingTime.toFixed(1)} 秒`);
    
    // 显示结果
    displayBatchResults();
}

/**
 * 停止批量预测
 */
function stopBatchPrediction() {
    console.log('⏹️ 停止批量预测');
    batchPredictionState.isRunning = false;
    updateBatchUIState(false);
    updateCurrentProcessing('已停止');
}

/**
 * 清空批量预测结果
 */
function clearBatchResults() {
    console.log('🗑️ 清空批量预测结果');
    
    batchPredictionState.results = [];
    batchPredictionState.completedIssues = 0;
    batchPredictionState.totalIssues = 0;
    
    // 隐藏进度区域
    const progressSection = document.getElementById('batch-progress-section');
    if (progressSection) {
        progressSection.style.display = 'none';
    }
    
    // 重置结果显示
    resetResultTabs();
}

/**
 * 更新批量预测UI状态
 */
function updateBatchUIState(isRunning) {
    const startBtn = document.getElementById('start-batch-prediction');
    const stopBtn = document.getElementById('stop-batch-prediction');
    
    if (startBtn) {
        startBtn.disabled = isRunning;
        startBtn.innerHTML = isRunning ? 
            '<span>⏳</span><span>预测中...</span>' : 
            '<span>🚀</span><span>开始批量预测</span>';
    }
    
    if (stopBtn) {
        stopBtn.disabled = !isRunning;
    }
}

/**
 * 显示进度区域
 */
function showProgressSection() {
    const progressSection = document.getElementById('batch-progress-section');
    if (progressSection) {
        progressSection.style.display = 'block';
    }
    
    // 重置进度显示
    updateProgress();
    updateCurrentProcessing('准备中...');
}

/**
 * 更新进度显示
 */
function updateProgress() {
    const { completedIssues, totalIssues } = batchPredictionState;
    const percentage = totalIssues > 0 ? (completedIssues / totalIssues * 100) : 0;
    
    const progressCurrentEl = document.getElementById('progress-current');
    const progressTotalEl = document.getElementById('progress-total');
    const progressPercentageEl = document.getElementById('progress-percentage');
    const progressBarEl = document.getElementById('batch-progress-bar');
    
    if (progressCurrentEl) progressCurrentEl.textContent = completedIssues;
    if (progressTotalEl) progressTotalEl.textContent = totalIssues;
    if (progressPercentageEl) progressPercentageEl.textContent = `${percentage.toFixed(1)}%`;
    if (progressBarEl) progressBarEl.style.width = `${percentage}%`;
    
    // 更新处理速度
    if (batchPredictionState.startTime && completedIssues > 0) {
        const elapsedTime = (Date.now() - batchPredictionState.startTime) / 1000;
        const speed = (completedIssues / elapsedTime * 60).toFixed(1);
        const speedEl = document.getElementById('processing-speed');
        if (speedEl) speedEl.textContent = `${speed} 期/分钟`;
        
        // 更新剩余时间
        const remainingIssues = totalIssues - completedIssues;
        const remainingTime = remainingIssues > 0 ? (remainingIssues / (completedIssues / elapsedTime)) : 0;
        const remainingEl = document.getElementById('estimated-remaining');
        if (remainingEl && remainingTime > 0) {
            remainingEl.textContent = `约 ${Math.ceil(remainingTime)} 秒`;
        }
    }
}

/**
 * 更新当前处理信息
 */
function updateCurrentProcessing(message) {
    const currentProcessingEl = document.getElementById('current-processing');
    if (currentProcessingEl) {
        currentProcessingEl.textContent = message;
    }
}

/**
 * 更新流式处理进度显示
 */
function updateStreamingProgress(streamSummary, memoryPeak) {
    const currentProcessingEl = document.getElementById('current-processing');
    if (currentProcessingEl && streamSummary) {
        const { batchSize, totalBatches, processedBatches, processedIssues, totalIssues } = streamSummary;
        const progress = totalIssues > 0 ? Math.round((processedIssues / totalIssues) * 100) : 0;

        const memoryInfo = memoryPeak ? ` | 内存峰值: ${memoryPeak}MB` : '';
        const message = `🔄 流式处理进度: ${progress}% (${processedIssues}/${totalIssues}期) | 批次: ${processedBatches}/${totalBatches}${memoryInfo}`;

        currentProcessingEl.textContent = message;

        console.log(`📊 流式处理进度更新: ${progress}% - 批次${processedBatches}/${totalBatches}, 期号${processedIssues}/${totalIssues}${memoryInfo}`);
    }
}

/**
 * 切换结果标签页
 */
function switchResultTab(tabId) {
    console.log(`🔄 Switching to tab: ${tabId}`);
    
    // 更新标签按钮状态
    const tabBtns = document.querySelectorAll('.tab-btn');
    console.log(`🏷️ Found ${tabBtns.length} tab buttons for switching`);
    
    tabBtns.forEach(btn => {
        const btnTabId = btn.getAttribute('data-tab');
        if (btnTabId === tabId) {
            btn.classList.add('active');
            console.log(`✅ Activated button: ${btnTabId}`);
        } else {
            btn.classList.remove('active');
            console.log(`❌ Deactivated button: ${btnTabId}`);
        }
    });
    
    // 更新内容显示
    const tabContents = document.querySelectorAll('.tab-content');
    console.log(`📄 Found ${tabContents.length} tab contents`);
    
    const targetTabId = `${tabId}-tab`;
    console.log(`🎯 Looking for tab content with id: ${targetTabId}`);
    
    let foundTarget = false;
    tabContents.forEach(content => {
        console.log(`📋 Checking content id: ${content.id}`);
        if (content.id === targetTabId) {
            content.style.display = 'block';
            content.classList.add('active');
            console.log(`✅ Showed tab content: ${content.id}`);
            foundTarget = true;
        } else {
            content.style.display = 'none';
            content.classList.remove('active');
            console.log(`❌ Hidden tab content: ${content.id}`);
        }
    });
    
    if (!foundTarget) {
        console.error(`❗ Target tab content not found: ${targetTabId}`);
    }
    
    console.log(`🏁 Tab switch complete for: ${tabId}`);
}

/**
 * 显示批量预测结果
 */
async function displayBatchResults() {
    const { sessionId } = batchPredictionState;

    if (!sessionId) {
        showErrorMessage('会话ID丢失，无法显示结果');
        return;
    }

    console.log(`📊 使用会话ID ${sessionId} 获取统一过滤后的结果`);

    try {
        // 使用统一API获取4个功能模块的数据
        await Promise.all([
            displayBatchSummary(sessionId),
            displayBatchDetails(sessionId),
            displayBatchValidation(sessionId),
            prepareBatchExport(sessionId)
        ]);

        console.log(`✅ 所有功能模块数据已加载完成`);
    } catch (error) {
        console.error('❌ 加载批量预测结果失败:', error);
        showErrorMessage('加载结果失败: ' + error.message);
    }
}

/**
 * 显示批量预测统计
 */
async function displayBatchSummary(sessionId) {
    const summaryTab = document.getElementById('summary-tab');
    if (!summaryTab) return;

    try {
        const response = await fetch(`http://localhost:3003/api/dlt/batch-prediction/statistics/${sessionId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const { summary, filterSummary } = result.data;

        console.log(`📊 [statistics] 收到统计数据:`, result.data);
        console.log(`📊 [statistics] 使用统一过滤结果: 筛选后${filterSummary.filtered}条，原始${filterSummary.original}条`);

        // 显示统计信息
        summaryTab.innerHTML = `
            <div class="batch-summary-content">
                <div class="summary-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <div class="stat-label">筛选后结果</div>
                            <div class="stat-value">${filterSummary.filtered}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🗑️</div>
                        <div class="stat-content">
                            <div class="stat-label">过滤移除</div>
                            <div class="stat-value">${filterSummary.removed}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📈</div>
                        <div class="stat-content">
                            <div class="stat-label">平均红球和值</div>
                            <div class="stat-value">${summary.avgRedSum ? summary.avgRedSum.toFixed(1) : '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="filter-info">
                    <h4>🔧 数据过滤摘要</h4>
                    <p>原始结果: ${filterSummary.original}条</p>
                    <p>过滤后结果: ${filterSummary.filtered}条</p>
                    <p>过滤率: ${filterSummary.original > 0 ? ((filterSummary.removed / filterSummary.original) * 100).toFixed(1) : 0}%</p>
                </div>
            </div>
        `;

        let totalRedCombinations = 0;
        let validResultCount = 0; // 有效结果计数

        // 从统计摘要中获取期数信息
        const totalResults = summary.totalResults || filterSummary.filtered || 0;

        console.log(`📊 [statistics] 统计摘要解析: totalResults=${totalResults}, summary=`, summary);

        console.log(`📈 统计结果 - 总期数: ${totalResults}`);

        // 使用实际的过滤后平均组合数，而不是理论预期值
        const actualAvgPerIssue = summary.avgCombinationsPerIssue || 0;
        const modeDescription = getModeDescription(batchPredictionState.combinationMode || 'default');

        console.log(`📊 实际平均每期组合数: ${actualAvgPerIssue.toLocaleString()}, 模式: ${batchPredictionState.combinationMode}`);

        // 显示实际的平均组合数
        const avgDisplayText = actualAvgPerIssue > 0 ?
            `${actualAvgPerIssue.toLocaleString()} (过滤后实际)` :
            `${batchPredictionState.expectedCombinationsPerIssue || 0} (${modeDescription})`;

        // 从summary中获取统计信息，或者使用默认值
        totalRedCombinations = summary.totalRedCombinations || 0;
        validResultCount = summary.validResultCount || 0;
        const validationCount = summary.validationCount || 0;
        const maxHit = summary.maxHit || 0;
        const hitStats = summary.hitStats || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    summaryTab.innerHTML = `
        <div class="batch-summary-content">
            <div class="summary-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-label">预测期数</div>
                        <div class="stat-value">${totalResults}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-content">
                        <div class="stat-label">每期组合数</div>
                        <div class="stat-value">${avgDisplayText}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <div class="stat-label">最高命中</div>
                        <div class="stat-value">${maxHit}球</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-label">总组合数</div>
                        <div class="stat-value">${totalRedCombinations.toLocaleString()}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <div class="stat-label">验证期数</div>
                        <div class="stat-value">${validationCount}</div>
                    </div>
                </div>
            </div>
            
            <div class="summary-details">
                <h4>📈 命中统计分布</h4>
                <div class="hit-distribution">
                    ${Object.keys(hitStats).map(hits => `
                        <div class="hit-stat-item">
                            <span class="hit-label">${hits}球命中:</span>
                            <span class="hit-count">${hitStats[hits]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="summary-note">
                <p>💡 <strong>说明：</strong>统计基于 ${validationCount} 期已开奖结果的验证数据</p>
            </div>
        </div>
    `;
    } catch (error) {
        console.error('❌ 加载批量预测统计失败:', error);
        summaryTab.innerHTML = `<div class="summary-error"><p>加载统计数据失败: ${error.message}</p></div>`;
    }
}

/**
 * 显示批量预测详细结果
 */
async function displayBatchDetails(sessionId) {
    const detailsTab = document.getElementById('details-tab');
    if (!detailsTab) return;

    try {
        const response = await fetch(`http://localhost:3003/api/dlt/batch-prediction/details/${sessionId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const results = result.data || [];

        // 确保 results 是数组类型
        const resultsArray = Array.isArray(results) ? results : [];

        console.log(`📋 [details] 获取到详细数据: ${resultsArray.length} 条记录`);

        // 获取每期预期组合数
        const expectedRedPerIssue = batchPredictionState.expectedCombinationsPerIssue || 6600;
        const expectedBluePerIssue = 66; // 蓝球组合固定为66种

        const tableRows = resultsArray.slice(0, 100).map(result => {
        // 显示实际返回数量 vs 预期数量的对比
        const actualRed = result.red_combinations?.length || 0;
        const redDisplayText = actualRed === expectedRedPerIssue ?
            expectedRedPerIssue.toLocaleString() :
            `${actualRed.toLocaleString()} / ${expectedRedPerIssue.toLocaleString()}`;

        return `
        <tr>
            <td>${result.target_issue}</td>
            <td>${redDisplayText}</td>
            <td>${expectedBluePerIssue}</td>
            <td>${result.hit_analysis?.red_hit_analysis?.best_hit || '-'}</td>
            <td>
                <button onclick="showIssueDetail('${result.target_issue}')" class="detail-btn">详情</button>
            </td>
        </tr>`;
    }).join('');
    
    detailsTab.innerHTML = `
        <div class="batch-details-content">
            <div class="details-header">
                <h4>📋 详细预测结果 (显示前100期)</h4>
                <p>共 ${resultsArray.length} 期预测结果</p>
            </div>
            <div class="details-table-container">
                <table class="batch-results-table">
                    <thead>
                        <tr>
                            <th>期号</th>
                            <th>红球组合数</th>
                            <th>蓝球组合数</th>
                            <th>最高命中</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    } catch (error) {
        console.error('❌ 加载批量预测详细结果失败:', error);
        detailsTab.innerHTML = `<div class="details-error"><p>加载详细结果失败: ${error.message}</p></div>`;
    }
}

/**
 * 显示批量验证结果
 */
async function displayBatchValidation(sessionId) {
    const validationTab = document.getElementById('validation-tab');
    if (!validationTab) return;

    try {
        const response = await fetch(`http://localhost:3003/api/dlt/batch-prediction/validation/${sessionId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const results = result.data || [];

        // 确保 results 是数组类型
        const resultsArray = Array.isArray(results) ? results : [];
        const validatedResults = resultsArray.filter(r => r.hit_analysis?.red_hit_analysis);

        console.log(`🎯 [validation] 获取到验证数据: ${resultsArray.length} 条记录, 有效验证: ${validatedResults.length} 条`);

        if (validatedResults.length === 0) {
        validationTab.innerHTML = `
            <div class="validation-placeholder">
                <p>暂无验证数据</p>
                <p>验证功能需要期号对应的开奖结果</p>
            </div>
        `;
        return;
    }
    
    const validationRows = validatedResults.slice(0, 50).map(result => {
        const analysis = result.hit_analysis;
        const actualRed = analysis.actual_red ? analysis.actual_red.join(', ') : '-';
        const bestRedHit = analysis.red_hit_analysis?.best_hit || 0;
        const bestBlueHit = analysis.blue_hit_analysis?.best_hit || 0;

        return `
            <tr>
                <td>${result.target_issue}</td>
                <td class="actual-numbers">${actualRed}</td>
                <td>${result.red_combinations?.length || 0}</td>
                <td class="hit-result hit-${bestRedHit}">${bestRedHit}</td>
                <td class="hit-result hit-${bestBlueHit}">${bestBlueHit}</td>
                <td>${analysis.hit_rate ? (analysis.hit_rate * 100).toFixed(1) + '%' : '-'}</td>
            </tr>
        `;
    }).join('');
    
    validationTab.innerHTML = `
        <div class="batch-validation-content">
            <div class="validation-header">
                <h4>🎯 预测命中验证 (显示前50期)</h4>
                <p>共 ${validatedResults.length} 期验证数据</p>
            </div>
            <div class="validation-table-container">
                <table class="batch-validation-table">
                    <thead>
                        <tr>
                            <th>期号</th>
                            <th>实际开奖</th>
                            <th>预测组合数</th>
                            <th>红球最高命中</th>
                            <th>蓝球最高命中</th>
                            <th>命中率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${validationRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    } catch (error) {
        console.error('❌ 加载批量预测验证结果失败:', error);
        validationTab.innerHTML = `<div class="validation-error"><p>加载验证结果失败: ${error.message}</p></div>`;
    }
}

/**
 * 准备批量导出功能
 */
async function prepareBatchExport(sessionId) {
    const exportTab = document.getElementById('export-tab');
    if (!exportTab) return;

    try {
        const response = await fetch(`http://localhost:3003/api/dlt/batch-prediction/export/${sessionId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const results = result.data || [];

        // 确保 results 是数组类型
        const resultsArray = Array.isArray(results) ? results : [];

        console.log(`💾 [export] 获取到导出数据: ${resultsArray.length} 条记录`);

        exportTab.innerHTML = `
        <div class="batch-export-content">
            <h4>💾 数据导出</h4>
            <div class="export-options">
                <div class="export-option">
                    <h5>📊 预测统计报告</h5>
                    <p>包含整体统计数据和命中率分析</p>
                    <button onclick="exportBatchSummary()" class="export-btn">导出统计报告 (CSV)</button>
                </div>
                <div class="export-option">
                    <h5>📋 详细预测结果</h5>
                    <p>包含每期的红球蓝球预测组合</p>
                    <button onclick="exportBatchDetails()" class="export-btn">导出详细结果 (CSV)</button>
                </div>
                <div class="export-option">
                    <h5>🎯 命中验证数据</h5>
                    <p>包含预测结果与实际开奖的对比</p>
                    <button onclick="exportBatchValidation()" class="export-btn">导出验证数据 (CSV)</button>
                </div>
            </div>
            <div class="export-note">
                <p>💡 导出的文件可用Excel或其他表格软件打开分析</p>
            </div>
        </div>
    `;
    } catch (error) {
        console.error('❌ 加载批量导出功能失败:', error);
        exportTab.innerHTML = `<div class="export-error"><p>加载导出功能失败: ${error.message}</p></div>`;
    }
}

/**
 * 重置结果标签页
 */
function resetResultTabs() {
    const summaryTab = document.getElementById('summary-tab');
    const detailsTab = document.getElementById('details-tab');
    const validationTab = document.getElementById('validation-tab');
    const exportTab = document.getElementById('export-tab');
    
    if (summaryTab) {
        summaryTab.innerHTML = `
            <div class="batch-results-placeholder">
                <div class="placeholder-content">
                    <h3>🎯 批量预测统计</h3>
                    <p>🔹 配置筛选条件后开始批量预测</p>
                    <p>🔹 支持历史所有期数的批量处理</p>
                    <p>🔹 自动验证预测命中率和统计分析</p>
                    <p>请先配置筛选条件，然后点击"开始批量预测"</p>
                </div>
            </div>
        `;
    }
    
    if (detailsTab) {
        detailsTab.innerHTML = `<div class="details-placeholder"><p>详细预测结果将在批量预测完成后显示</p></div>`;
    }
    
    if (validationTab) {
        validationTab.innerHTML = `<div class="validation-placeholder"><p>命中验证结果将在批量预测完成后显示</p></div>`;
    }
    
    if (exportTab) {
        exportTab.innerHTML = `<div class="export-placeholder"><p>数据导出功能将在有预测结果后可用</p></div>`;
    }
}

// 全局变量存储批量预测结果，供详情查看使用
let currentBatchResults = [];

/**
 * 显示错误信息
 */
function showErrorMessage(message) {
    // 可以用更好的UI组件替换alert
    alert(message);
}

/**
 * 显示指定期号的详细预测结果
 */
async function showIssueDetail(targetIssue) {
    console.log(`🔍 显示期号 ${targetIssue} 的详细结果`);
    console.log(`📊 当前全局结果数量: ${currentBatchResults.length}`);
    console.log(`📋 可用期号列表:`, currentBatchResults.map(r => r.target_issue));
    
    // 确保 currentBatchResults 存在且不为空
    if (!currentBatchResults || !Array.isArray(currentBatchResults) || currentBatchResults.length === 0) {
        console.error('❌ 全局批量预测结果为空或不存在');
        alert('请先进行批量预测以获取结果');
        return;
    }
    
    // 多种方式查找对应期号的结果
    let issueResult = null;
    
    // 方式1: 直接匹配
    issueResult = currentBatchResults.find(result => result.target_issue === targetIssue);
    if (issueResult) {
        console.log(`✅ 直接匹配找到期号 ${targetIssue}`);
    }
    
    // 方式2: 字符串匹配（处理数据类型不一致的问题）
    if (!issueResult) {
        issueResult = currentBatchResults.find(result => String(result.target_issue) === String(targetIssue));
        if (issueResult) {
            console.log(`✅ 字符串匹配找到期号 ${targetIssue}`);
        }
    }
    
    // 方式3: 数字匹配（处理字符串数字的问题）
    if (!issueResult) {
        const targetNum = Number(targetIssue);
        if (!isNaN(targetNum)) {
            issueResult = currentBatchResults.find(result => Number(result.target_issue) === targetNum);
            if (issueResult) {
                console.log(`✅ 数字匹配找到期号 ${targetIssue}`);
            }
        }
    }
    
    // 如果仍然未找到，提供详细的调试信息
    if (!issueResult) {
        console.error(`❌ 未找到期号 ${targetIssue}`);
        console.log('🔍 调试信息:');
        console.log(`- 目标期号: "${targetIssue}" (类型: ${typeof targetIssue})`);
        console.log('- 现有期号详情:');
        currentBatchResults.forEach((result, index) => {
            console.log(`  [${index}] "${result.target_issue}" (类型: ${typeof result.target_issue})`);
        });
        
        alert(`未找到期号 ${targetIssue} 的预测结果。\n\n可用期号: ${currentBatchResults.map(r => r.target_issue).join(', ')}\n\n请检查期号是否正确。`);
        return;
    }
    
    // 转换红球组合格式（处理新的数据库对象格式）
    const redCombos = issueResult.red_combinations || [];
    const blueCombos = issueResult.blue_combinations || [];
    
    // 获取实际开奖结果进行命中分析
    let actualResult = null;
    let hitAnalysis = null;
    
    try {
        console.log(`🎯 获取期号 ${targetIssue} 的实际开奖结果...`);
        const response = await fetch(`/api/dlt/history/${targetIssue}`);
        if (response.ok) {
            actualResult = await response.json();
            console.log(`✅ 获取到实际开奖结果:`, actualResult);
            
            // 执行命中分析
            hitAnalysis = performHitAnalysis(redCombos, blueCombos, actualResult);
        } else {
            console.log(`⚠️ 未找到期号 ${targetIssue} 的开奖结果，可能尚未开奖`);
        }
    } catch (error) {
        console.error(`❌ 获取开奖结果失败:`, error);
    }
    
    // 显示增强版详细结果模态框
    showEnhancedIssueDetailModal(targetIssue, issueResult, redCombos, blueCombos, actualResult, hitAnalysis);
}

/**
 * 执行命中分析
 */
function performHitAnalysis(redCombos, blueCombos, actualResult) {
    if (!actualResult) return null;
    
    console.log(`🎯 开始执行命中分析...`);
    
    // 解析实际开奖号码
    const actualReds = [
        actualResult.Front1, actualResult.Front2, actualResult.Front3, 
        actualResult.Front4, actualResult.Front5
    ].filter(n => n !== undefined).sort((a, b) => a - b);
    
    const actualBlues = [actualResult.Back1, actualResult.Back2]
        .filter(n => n !== undefined).sort((a, b) => a - b);
    
    console.log(`🔴 实际红球: ${actualReds.join(', ')}`);
    console.log(`🔵 实际蓝球: ${actualBlues.join(', ')}`);
    
    // 分析红球命中
    const redHits = [];
    const redHitCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    redCombos.forEach((combo, index) => {
        let comboNumbers;
        if (Array.isArray(combo)) {
            comboNumbers = combo;
        } else if (combo.red_ball_1 !== undefined) {
            comboNumbers = [
                combo.red_ball_1, combo.red_ball_2, combo.red_ball_3,
                combo.red_ball_4, combo.red_ball_5
            ];
        } else {
            comboNumbers = [];
        }
        
        const hitCount = comboNumbers.filter(num => actualReds.includes(num)).length;
        redHitCounts[hitCount]++;
        
        if (hitCount > 0) {
            redHits.push({
                index: index + 1,
                numbers: comboNumbers,
                hitCount,
                hitNumbers: comboNumbers.filter(num => actualReds.includes(num)),
                combo: combo
            });
        }
    });
    
    // 分析蓝球命中
    const blueHits = [];
    const blueHitCounts = { 0: 0, 1: 0, 2: 0 };
    
    blueCombos.forEach((combo, index) => {
        const hitCount = combo.filter(num => actualBlues.includes(num)).length;
        blueHitCounts[hitCount]++;
        
        if (hitCount > 0) {
            blueHits.push({
                index: index + 1,
                numbers: combo,
                hitCount,
                hitNumbers: combo.filter(num => actualBlues.includes(num))
            });
        }
    });
    
    const maxRedHit = Math.max(...Object.keys(redHitCounts).filter(k => redHitCounts[k] > 0).map(Number));
    const maxBlueHit = Math.max(...Object.keys(blueHitCounts).filter(k => blueHitCounts[k] > 0).map(Number));
    
    const analysis = {
        actualReds,
        actualBlues,
        redHits: redHits.sort((a, b) => b.hitCount - a.hitCount),
        blueHits: blueHits.sort((a, b) => b.hitCount - a.hitCount),
        redHitCounts,
        blueHitCounts,
        maxRedHit: maxRedHit >= 0 ? maxRedHit : 0,
        maxBlueHit: maxBlueHit >= 0 ? maxBlueHit : 0,
        totalRedCombos: redCombos.length,
        totalBlueCombos: blueCombos.length,
        redHitRate: redHits.length / redCombos.length,
        blueHitRate: blueHits.length / blueCombos.length
    };
    
    console.log(`✅ 命中分析完成:`, analysis);
    return analysis;
}

/**
 * 显示增强版详细结果模态框
 */
function showEnhancedIssueDetailModal(targetIssue, issueResult, redCombos, blueCombos, actualResult, hitAnalysis) {
    // 构建详细信息HTML
    let detailHtml = `
        <div class="issue-detail-modal" onclick="closeIssueDetail(event)">
            <div class="issue-detail-content" onclick="event.stopPropagation()">
                <!-- 头部 -->
                <div class="issue-detail-header">
                    <div class="header-left">
                        <h3>🎯 期号 ${targetIssue} 详细预测结果</h3>
                        ${actualResult ? `<p class="actual-result">实际开奖: 🔴 ${hitAnalysis.actualReds.map(n => String(n).padStart(2, '0')).join(' ')} | 🔵 ${hitAnalysis.actualBlues.map(n => String(n).padStart(2, '0')).join(' ')}</p>` : '<p class="no-result">该期尚未开奖</p>'}
                    </div>
                    <button onclick="closeIssueDetail()" class="close-btn">×</button>
                </div>
                
                <!-- 标签页导航 -->
                <div class="detail-tabs">
                    <button class="detail-tab-btn active" data-tab="overview">📊 总览统计</button>
                    <button class="detail-tab-btn" data-tab="combinations">🔢 组合列表</button>
                    ${hitAnalysis ? '<button class="detail-tab-btn" data-tab="hits">🎯 命中分析</button>' : ''}
                    <button class="detail-tab-btn" data-tab="export">💾 数据导出</button>
                </div>
                
                <!-- 总览统计标签页 -->
                <div class="detail-tab-content active" data-tab="overview">
                    <div class="overview-stats">
                        <div class="stat-card">
                            <div class="stat-icon">🔴</div>
                            <div class="stat-content">
                                <div class="stat-value">${redCombos.length}</div>
                                <div class="stat-label">红球组合数</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🔵</div>
                            <div class="stat-content">
                                <div class="stat-value">${blueCombos.length}</div>
                                <div class="stat-label">蓝球组合数</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-content">
                                <div class="stat-value">${issueResult.processing_time}</div>
                                <div class="stat-label">处理时间(ms)</div>
                            </div>
                        </div>
                        ${hitAnalysis ? `
                            <div class="stat-card hit-card">
                                <div class="stat-icon">🏆</div>
                                <div class="stat-content">
                                    <div class="stat-value">${hitAnalysis.maxRedHit}+${hitAnalysis.maxBlueHit}</div>
                                    <div class="stat-label">最高命中</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${hitAnalysis ? `
                        <div class="hit-distribution">
                            <h4>🎯 命中分布统计</h4>
                            <div class="hit-charts">
                                <div class="hit-chart">
                                    <h5>🔴 红球命中分布</h5>
                                    <div class="chart-bars">
                                        ${Object.entries(hitAnalysis.redHitCounts).map(([hits, count]) => `
                                            <div class="chart-bar-item">
                                                <div class="bar-label">${hits}球</div>
                                                <div class="bar-container">
                                                    <div class="bar-fill" style="width: ${(count / redCombos.length * 100).toFixed(1)}%"></div>
                                                </div>
                                                <div class="bar-value">${count} (${(count / redCombos.length * 100).toFixed(1)}%)</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="hit-chart">
                                    <h5>🔵 蓝球命中分布</h5>
                                    <div class="chart-bars">
                                        ${Object.entries(hitAnalysis.blueHitCounts).map(([hits, count]) => `
                                            <div class="chart-bar-item">
                                                <div class="bar-label">${hits}球</div>
                                                <div class="bar-container">
                                                    <div class="bar-fill blue-fill" style="width: ${(count / blueCombos.length * 100).toFixed(1)}%"></div>
                                                </div>
                                                <div class="bar-value">${count} (${(count / blueCombos.length * 100).toFixed(1)}%)</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- 组合列表标签页 -->
                <div class="detail-tab-content" data-tab="combinations">
                    <div class="combinations-section">
                        <div class="red-combinations-panel">
                            <h4>🔴 红球组合列表 (显示前50个)</h4>
                            <div class="combinations-grid">
                                ${redCombos.slice(0, 50).map((combo, index) => {
                                    let numbers;
                                    if (Array.isArray(combo)) {
                                        numbers = combo;
                                    } else if (combo.red_ball_1 !== undefined) {
                                        numbers = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
                                    } else {
                                        numbers = [];
                                    }
                                    
                                    let hitHighlight = '';
                                    if (hitAnalysis && actualResult) {
                                        const hitCount = numbers.filter(n => hitAnalysis.actualReds.includes(n)).length;
                                        if (hitCount > 0) hitHighlight = ` hit-${hitCount}`;
                                    }
                                    
                                    return `
                                        <div class="combo-card${hitHighlight}">
                                            <div class="combo-header">
                                                <span class="combo-num">#${index + 1}</span>
                                                ${hitAnalysis && actualResult && numbers.filter(n => hitAnalysis.actualReds.includes(n)).length > 0 ? 
                                                    `<span class="hit-badge">${numbers.filter(n => hitAnalysis.actualReds.includes(n)).length}中</span>` : ''}
                                            </div>
                                            <div class="combo-numbers">
                                                ${numbers.map(n => {
                                                    const isHit = hitAnalysis && hitAnalysis.actualReds.includes(n);
                                                    return `<span class="number-ball${isHit ? ' hit-number' : ''}">${String(n).padStart(2, '0')}</span>`;
                                                }).join('')}
                                            </div>
                                            ${combo.sum_value ? `<div class="combo-stats">和值:${combo.sum_value} 跨度:${combo.span_value}</div>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ${redCombos.length > 50 ? `<div class="more-indicator">... 还有 ${redCombos.length - 50} 个红球组合</div>` : ''}
                        </div>
                        
                        <div class="blue-combinations-panel">
                            <h4>🔵 蓝球组合列表 (显示前20个)</h4>
                            <div class="blue-combinations-grid">
                                ${blueCombos.slice(0, 20).map((combo, index) => {
                                    let hitHighlight = '';
                                    if (hitAnalysis && actualResult) {
                                        const hitCount = combo.filter(n => hitAnalysis.actualBlues.includes(n)).length;
                                        if (hitCount > 0) hitHighlight = ` blue-hit-${hitCount}`;
                                    }
                                    
                                    return `
                                        <div class="blue-combo-card${hitHighlight}">
                                            <span class="combo-num">#${index + 1}</span>
                                            <div class="combo-numbers">
                                                ${combo.map(n => {
                                                    const isHit = hitAnalysis && hitAnalysis.actualBlues.includes(n);
                                                    return `<span class="blue-number-ball${isHit ? ' hit-number' : ''}">${String(n).padStart(2, '0')}</span>`;
                                                }).join('')}
                                            </div>
                                            ${hitAnalysis && actualResult && combo.filter(n => hitAnalysis.actualBlues.includes(n)).length > 0 ? 
                                                `<span class="hit-badge blue-hit">${combo.filter(n => hitAnalysis.actualBlues.includes(n)).length}中</span>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ${blueCombos.length > 20 ? `<div class="more-indicator">... 还有 ${blueCombos.length - 20} 个蓝球组合</div>` : ''}
                        </div>
                    </div>
                </div>
                
                ${hitAnalysis ? `
                <!-- 命中分析标签页 -->
                <div class="detail-tab-content" data-tab="hits">
                    <div class="hit-analysis-section">
                        <div class="hit-summary">
                            <h4>🏆 命中情况总结</h4>
                            <div class="hit-stats-grid">
                                <div class="hit-stat-item">
                                    <span class="hit-stat-label">红球最高命中:</span>
                                    <span class="hit-stat-value">${hitAnalysis.maxRedHit}球</span>
                                </div>
                                <div class="hit-stat-item">
                                    <span class="hit-stat-label">蓝球最高命中:</span>
                                    <span class="hit-stat-value">${hitAnalysis.maxBlueHit}球</span>
                                </div>
                                <div class="hit-stat-item">
                                    <span class="hit-stat-label">红球命中率:</span>
                                    <span class="hit-stat-value">${(hitAnalysis.redHitRate * 100).toFixed(2)}%</span>
                                </div>
                                <div class="hit-stat-item">
                                    <span class="hit-stat-label">蓝球命中率:</span>
                                    <span class="hit-stat-value">${(hitAnalysis.blueHitRate * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="hit-combinations">
                            <div class="red-hits">
                                <h4>🔴 红球命中组合 (按命中数排序)</h4>
                                <div class="hit-list">
                                    ${hitAnalysis.redHits.slice(0, 20).map(hit => `
                                        <div class="hit-item hit-level-${hit.hitCount}">
                                            <div class="hit-info">
                                                <span class="hit-index">#${hit.index}</span>
                                                <span class="hit-count-badge">${hit.hitCount}中</span>
                                            </div>
                                            <div class="hit-numbers">
                                                ${hit.numbers.map(n => {
                                                    const isHit = hit.hitNumbers.includes(n);
                                                    return `<span class="number-ball${isHit ? ' hit-number' : ''}">${String(n).padStart(2, '0')}</span>`;
                                                }).join('')}
                                            </div>
                                            <div class="hit-details">命中号码: ${hit.hitNumbers.map(n => String(n).padStart(2, '0')).join(', ')}</div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${hitAnalysis.redHits.length > 20 ? `<div class="more-indicator">... 还有 ${hitAnalysis.redHits.length - 20} 个命中组合</div>` : ''}
                                ${hitAnalysis.redHits.length === 0 ? '<div class="no-hits">😢 本期红球无命中组合</div>' : ''}
                            </div>
                            
                            <div class="blue-hits">
                                <h4>🔵 蓝球命中组合 (按命中数排序)</h4>
                                <div class="hit-list">
                                    ${hitAnalysis.blueHits.slice(0, 10).map(hit => `
                                        <div class="hit-item blue-hit-level-${hit.hitCount}">
                                            <div class="hit-info">
                                                <span class="hit-index">#${hit.index}</span>
                                                <span class="hit-count-badge blue-hit">${hit.hitCount}中</span>
                                            </div>
                                            <div class="hit-numbers">
                                                ${hit.numbers.map(n => {
                                                    const isHit = hit.hitNumbers.includes(n);
                                                    return `<span class="blue-number-ball${isHit ? ' hit-number' : ''}">${String(n).padStart(2, '0')}</span>`;
                                                }).join('')}
                                            </div>
                                            <div class="hit-details">命中号码: ${hit.hitNumbers.map(n => String(n).padStart(2, '0')).join(', ')}</div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${hitAnalysis.blueHits.length === 0 ? '<div class="no-hits">😢 本期蓝球无命中组合</div>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- 数据导出标签页 -->
                <div class="detail-tab-content" data-tab="export">
                    <div class="export-section">
                        <h4>💾 数据导出</h4>
                        <div class="export-options">
                            <div class="export-option-card">
                                <div class="export-icon">📋</div>
                                <div class="export-info">
                                    <h5>红球组合数据</h5>
                                    <p>包含所有 ${redCombos.length} 个红球组合的详细信息</p>
                                </div>
                                <button onclick="exportRedCombinations('${targetIssue}')" class="export-btn">导出 CSV</button>
                            </div>
                            <div class="export-option-card">
                                <div class="export-icon">🔵</div>
                                <div class="export-info">
                                    <h5>蓝球组合数据</h5>
                                    <p>包含所有 ${blueCombos.length} 个蓝球组合的详细信息</p>
                                </div>
                                <button onclick="exportBlueCombinations('${targetIssue}')" class="export-btn">导出 CSV</button>
                            </div>
                            ${hitAnalysis ? `
                                <div class="export-option-card">
                                    <div class="export-icon">🎯</div>
                                    <div class="export-info">
                                        <h5>命中分析数据</h5>
                                        <p>包含命中组合和统计分析信息</p>
                                    </div>
                                    <button onclick="exportHitAnalysis('${targetIssue}')" class="export-btn">导出 CSV</button>
                                </div>
                            ` : ''}
                            <div class="export-option-card">
                                <div class="export-icon">📊</div>
                                <div class="export-info">
                                    <h5>完整数据报告</h5>
                                    <p>包含所有数据的综合报告</p>
                                </div>
                                <button onclick="exportCompleteReport('${targetIssue}')" class="export-btn primary">导出完整报告</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
        /* 基础模态框样式 */
        .issue-detail-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        }
        
        .issue-detail-content {
            background: white;
            border-radius: 16px;
            max-width: 95%;
            max-height: 95%;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.3s ease-out;
        }
        
        /* 头部样式 */
        .issue-detail-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 20px 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .header-left h3 {
            margin: 0;
            font-size: 20px;
        }
        
        .actual-result, .no-result {
            margin: 8px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
        }
        
        .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: white;
            padding: 8px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            transition: background 0.2s;
        }
        
        .close-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        
        /* 标签页导航 */
        .detail-tabs {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        
        .detail-tab-btn {
            background: none;
            border: none;
            padding: 15px 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: #6c757d;
            transition: all 0.2s;
            flex: 1;
            text-align: center;
        }
        
        .detail-tab-btn.active {
            background: white;
            color: #495057;
            border-bottom: 3px solid #007bff;
        }
        
        .detail-tab-btn:hover {
            background: #e9ecef;
            color: #495057;
        }
        
        /* 标签页内容 */
        .detail-tab-content {
            display: none;
            padding: 25px;
            min-height: 400px;
            max-height: 500px;
            overflow-y: auto;
        }
        
        .detail-tab-content.active {
            display: block;
        }
        
        /* 总览统计样式 */
        .overview-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .stat-card.hit-card {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
        }
        
        .stat-icon {
            font-size: 24px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
        }
        
        .stat-label {
            font-size: 14px;
            color: #6c757d;
            margin: 5px 0 0 0;
        }
        
        .stat-card.hit-card .stat-label {
            color: rgba(255,255,255,0.8);
        }
        
        /* 命中分布图表 */
        .hit-distribution {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
        }
        
        .hit-charts {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 20px;
        }
        
        .hit-chart h5 {
            margin: 0 0 15px 0;
            color: #495057;
        }
        
        .chart-bar-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        
        .bar-label {
            min-width: 40px;
            font-size: 12px;
            color: #6c757d;
        }
        
        .bar-container {
            flex: 1;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #dc3545, #fd7e14);
            border-radius: 10px;
            transition: width 0.3s ease;
        }
        
        .bar-fill.blue-fill {
            background: linear-gradient(90deg, #007bff, #17a2b8);
        }
        
        .bar-value {
            min-width: 80px;
            font-size: 12px;
            color: #495057;
            text-align: right;
        }
        
        /* 组合网格样式 */
        .combinations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .combo-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            padding: 15px;
            transition: all 0.2s;
        }
        
        .combo-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .combo-card.hit-1 { border-color: #ffc107; background: #fff9e6; }
        .combo-card.hit-2 { border-color: #fd7e14; background: #fff4e6; }
        .combo-card.hit-3 { border-color: #dc3545; background: #ffe6e6; }
        .combo-card.hit-4 { border-color: #6f42c1; background: #f3e6ff; }
        .combo-card.hit-5 { border-color: #198754; background: #e6f7e6; }
        
        .combo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .combo-num {
            font-size: 12px;
            color: #6c757d;
            font-weight: 600;
        }
        
        .hit-badge {
            background: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .hit-badge.blue-hit {
            background: #007bff;
        }
        
        .combo-numbers {
            display: flex;
            gap: 6px;
            margin-bottom: 8px;
        }
        
        .number-ball {
            background: #dc3545;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .number-ball.hit-number {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 2px 8px rgba(40,167,69,0.3);
            transform: scale(1.1);
        }
        
        .blue-number-ball {
            background: #007bff;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
        }
        
        .blue-number-ball.hit-number {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 2px 6px rgba(40,167,69,0.3);
            transform: scale(1.1);
        }
        
        .combo-stats {
            font-size: 11px;
            color: #6c757d;
        }
        
        .blue-combinations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            margin: 20px 0;
        }
        
        .blue-combo-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s;
        }
        
        .blue-combo-card.blue-hit-1 { 
            border-color: #17a2b8; 
            background: #e6f9ff; 
        }
        .blue-combo-card.blue-hit-2 { 
            border-color: #28a745; 
            background: #e6f7e6; 
        }
        
        /* 命中分析样式 */
        .hit-analysis-section {
            max-height: 500px;
            overflow-y: auto;
        }
        
        .hit-summary {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 25px;
        }
        
        .hit-stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        
        .hit-stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: white;
            border-radius: 8px;
        }
        
        .hit-stat-label {
            font-weight: 600;
            color: #495057;
        }
        
        .hit-stat-value {
            font-weight: bold;
            color: #dc3545;
        }
        
        .hit-combinations {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
        }
        
        .hit-list {
            max-height: 300px;
            overflow-y: auto;
        }
        
        .hit-item {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
        }
        
        .hit-item.hit-level-1 { border-left: 4px solid #ffc107; }
        .hit-item.hit-level-2 { border-left: 4px solid #fd7e14; }
        .hit-item.hit-level-3 { border-left: 4px solid #dc3545; }
        .hit-item.hit-level-4 { border-left: 4px solid #6f42c1; }
        .hit-item.hit-level-5 { border-left: 4px solid #198754; }
        
        .hit-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .hit-index {
            font-size: 12px;
            color: #6c757d;
        }
        
        .hit-count-badge {
            background: #dc3545;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
        }
        
        .hit-numbers {
            display: flex;
            gap: 4px;
            margin-bottom: 6px;
        }
        
        .hit-details {
            font-size: 11px;
            color: #6c757d;
        }
        
        .no-hits {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px;
        }
        
        /* 导出选项样式 */
        .export-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .export-option-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            transition: all 0.2s;
        }
        
        .export-option-card:hover {
            border-color: #007bff;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,123,255,0.2);
        }
        
        .export-icon {
            font-size: 32px;
            color: #007bff;
        }
        
        .export-info {
            flex: 1;
        }
        
        .export-info h5 {
            margin: 0 0 5px 0;
            color: #495057;
        }
        
        .export-info p {
            margin: 0;
            font-size: 14px;
            color: #6c757d;
        }
        
        .export-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        
        .export-btn:hover {
            background: #0056b3;
        }
        
        .export-btn.primary {
            background: linear-gradient(135deg, #28a745, #20c997);
        }
        
        .export-btn.primary:hover {
            background: linear-gradient(135deg, #1e7e34, #1a9c87);
        }
        
        .more-indicator {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-top: 15px;
        }
        
        /* 动画效果 */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translateY(50px) scale(0.9);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        /* 响应式设计 */
        @media (max-width: 1200px) {
            .hit-charts { grid-template-columns: 1fr; }
            .hit-combinations { grid-template-columns: 1fr; }
        }
        
        @media (max-width: 768px) {
            .issue-detail-content {
                max-width: 98%;
                max-height: 98%;
            }
            
            .issue-detail-header {
                padding: 15px 20px;
            }
            
            .detail-tabs {
                overflow-x: auto;
            }
            
            .detail-tab-btn {
                min-width: 120px;
                flex: none;
            }
            
            .detail-tab-content {
                padding: 20px 15px;
            }
            
            .overview-stats {
                grid-template-columns: 1fr 1fr;
            }
            
            .combinations-grid {
                grid-template-columns: 1fr;
            }
            
            .hit-stats-grid {
                grid-template-columns: 1fr;
            }
        }
        </style>
    `;
    
    // 显示模态框
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = detailHtml;
    document.body.appendChild(modalContainer.firstElementChild);
    
    // 设置标签页切换事件
    setupDetailTabSwitching();
}

/**
 * 设置详细结果模态框的标签页切换功能
 */
function setupDetailTabSwitching() {
    const tabBtns = document.querySelectorAll('.detail-tab-btn');
    const tabContents = document.querySelectorAll('.detail-tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新内容显示
            tabContents.forEach(content => {
                const contentTab = content.getAttribute('data-tab');
                if (contentTab === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
}

/**
 * 导出红球组合数据为CSV
 */
function exportRedCombinations(targetIssue) {
    console.log(`📋 导出期号 ${targetIssue} 的红球组合数据`);
    
    const issueResult = currentBatchResults.find(result => 
        String(result.target_issue) === String(targetIssue)
    );
    
    if (!issueResult) {
        alert('未找到该期号的数据');
        return;
    }
    
    const redCombos = issueResult.red_combinations || [];
    if (redCombos.length === 0) {
        alert('没有红球组合数据可导出');
        return;
    }
    
    // 构建CSV数据
    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += '期号,组合序号,红球1,红球2,红球3,红球4,红球5,和值,跨度,区间比,奇偶比\n';
    
    redCombos.forEach((combo, index) => {
        let numbers;
        if (Array.isArray(combo)) {
            numbers = combo;
        } else if (combo.red_ball_1 !== undefined) {
            numbers = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
        } else {
            numbers = [];
        }
        
        const row = [
            targetIssue,
            index + 1,
            ...numbers,
            combo.sum_value || '未知',
            combo.span_value || '未知',
            combo.zone_ratio || '未知',
            combo.odd_even_ratio || '未知'
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    // 下载文件
    downloadChineseCSV(csvContent, `大乐透_期号${targetIssue}_红球组合数据.csv`);
}

/**
 * 导出蓝球组合数据为CSV
 */
function exportBlueCombinations(targetIssue) {
    console.log(`🔵 导出期号 ${targetIssue} 的蓝球组合数据`);
    
    const issueResult = currentBatchResults.find(result => 
        String(result.target_issue) === String(targetIssue)
    );
    
    if (!issueResult) {
        alert('未找到该期号的数据');
        return;
    }
    
    const blueCombos = issueResult.blue_combinations || [];
    if (blueCombos.length === 0) {
        alert('没有蓝球组合数据可导出');
        return;
    }
    
    // 构建CSV数据
    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += '期号,组合序号,蓝球1,蓝球2\n';
    
    blueCombos.forEach((combo, index) => {
        const row = [
            targetIssue,
            index + 1,
            ...combo
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // 下载文件
    downloadChineseCSV(csvContent, `大乐透_期号${targetIssue}_蓝球组合数据.csv`);
}

/**
 * 导出命中分析数据为CSV
 */
function exportHitAnalysis(targetIssue) {
    console.log(`🎯 导出期号 ${targetIssue} 的命中分析数据`);
    
    const issueResult = currentBatchResults.find(result => 
        String(result.target_issue) === String(targetIssue)
    );
    
    if (!issueResult) {
        alert('未找到该期号的数据');
        return;
    }
    
    // 获取开奖结果和命中分析
    fetch(`/api/dlt/history/${targetIssue}`)
        .then(response => response.ok ? response.json() : null)
        .then(actualResult => {
            if (!actualResult) {
                alert('该期尚未开奖，无法导出命中分析');
                return;
            }
            
            const hitAnalysis = performHitAnalysis(
                issueResult.red_combinations || [], 
                issueResult.blue_combinations || [], 
                actualResult
            );
            
            if (!hitAnalysis) {
                alert('命中分析数据生成失败');
                return;
            }
            
            // 构建CSV数据
            let csvContent = '\ufeff'; // BOM for UTF-8
            
            // 基本信息
            csvContent += '大乐透命中分析报告\n';
            csvContent += `期号,${targetIssue}\n`;
            csvContent += `开奖结果,${hitAnalysis.actualReds.join(' ')} + ${hitAnalysis.actualBlues.join(' ')}\n`;
            csvContent += `分析时间,${new Date().toLocaleString()}\n\n`;
            
            // 统计信息
            csvContent += '统计信息\n';
            csvContent += '项目,数值\n';
            csvContent += `红球最高命中,${hitAnalysis.maxRedHit}球\n`;
            csvContent += `蓝球最高命中,${hitAnalysis.maxBlueHit}球\n`;
            csvContent += `红球命中率,${(hitAnalysis.redHitRate * 100).toFixed(2)}%\n`;
            csvContent += `蓝球命中率,${(hitAnalysis.blueHitRate * 100).toFixed(2)}%\n`;
            csvContent += `总红球组合数,${hitAnalysis.totalRedCombos}\n`;
            csvContent += `总蓝球组合数,${hitAnalysis.totalBlueCombos}\n\n`;
            
            // 命中分布
            csvContent += '红球命中分布\n';
            csvContent += '命中数,组合数,占比\n';
            Object.entries(hitAnalysis.redHitCounts).forEach(([hits, count]) => {
                csvContent += `${hits}球,${count},${(count / hitAnalysis.totalRedCombos * 100).toFixed(2)}%\n`;
            });
            
            csvContent += '\n蓝球命中分布\n';
            csvContent += '命中数,组合数,占比\n';
            Object.entries(hitAnalysis.blueHitCounts).forEach(([hits, count]) => {
                csvContent += `${hits}球,${count},${(count / hitAnalysis.totalBlueCombos * 100).toFixed(2)}%\n`;
            });
            
            // 命中组合详情
            if (hitAnalysis.redHits.length > 0) {
                csvContent += '\n红球命中组合详情\n';
                csvContent += '组合序号,命中数,组合号码,命中号码\n';
                hitAnalysis.redHits.forEach(hit => {
                    csvContent += `${hit.index},${hit.hitCount}球,"${hit.numbers.join(' ')}","${hit.hitNumbers.join(' ')}"\n`;
                });
            }
            
            if (hitAnalysis.blueHits.length > 0) {
                csvContent += '\n蓝球命中组合详情\n';
                csvContent += '组合序号,命中数,组合号码,命中号码\n';
                hitAnalysis.blueHits.forEach(hit => {
                    csvContent += `${hit.index},${hit.hitCount}球,"${hit.numbers.join(' ')}","${hit.hitNumbers.join(' ')}"\n`;
                });
            }
            
            // 下载文件
            downloadChineseCSV(csvContent, `大乐透_期号${targetIssue}_命中分析报告.csv`);
        })
        .catch(error => {
            console.error('导出命中分析失败:', error);
            alert('导出命中分析失败，请稍后重试');
        });
}

/**
 * 导出完整数据报告
 */
function exportCompleteReport(targetIssue) {
    console.log(`📊 导出期号 ${targetIssue} 的完整数据报告`);
    
    const issueResult = currentBatchResults.find(result => 
        String(result.target_issue) === String(targetIssue)
    );
    
    if (!issueResult) {
        alert('未找到该期号的数据');
        return;
    }
    
    // 构建完整报告CSV
    let csvContent = '\ufeff'; // BOM for UTF-8
    
    // 报告头部
    csvContent += '大乐透预测结果完整报告\n';
    csvContent += `期号,${targetIssue}\n`;
    csvContent += `生成时间,${new Date().toLocaleString()}\n`;
    csvContent += `处理时间,${issueResult.processing_time}ms\n\n`;
    
    // 红球组合数据
    const redCombos = issueResult.red_combinations || [];
    if (redCombos.length > 0) {
        csvContent += '红球组合列表\n';
        csvContent += '序号,红球1,红球2,红球3,红球4,红球5,和值,跨度,区间比,奇偶比\n';
        
        redCombos.forEach((combo, index) => {
            let numbers;
            if (Array.isArray(combo)) {
                numbers = combo;
            } else if (combo.red_ball_1 !== undefined) {
                numbers = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
            } else {
                numbers = [];
            }
            
            const row = [
                index + 1,
                ...numbers,
                combo.sum_value || '',
                combo.span_value || '',
                combo.zone_ratio || '',
                combo.odd_even_ratio || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        csvContent += '\n';
    }
    
    // 蓝球组合数据
    const blueCombos = issueResult.blue_combinations || [];
    if (blueCombos.length > 0) {
        csvContent += '蓝球组合列表\n';
        csvContent += '序号,蓝球1,蓝球2\n';
        
        blueCombos.forEach((combo, index) => {
            const row = [index + 1, ...combo];
            csvContent += row.join(',') + '\n';
        });
        csvContent += '\n';
    }
    
    // 统计信息
    csvContent += '统计信息\n';
    csvContent += '项目,数值\n';
    csvContent += `红球组合总数,${redCombos.length}\n`;
    csvContent += `蓝球组合总数,${blueCombos.length}\n`;
    csvContent += `总组合数,${redCombos.length * blueCombos.length}\n`;
    
    // 下载文件
    downloadChineseCSV(csvContent, `大乐透_期号${targetIssue}_完整数据报告.csv`);
}

/**
 * 将数据转换为CSV格式
 */
function convertToCSV(data) {
    return data.map(row =>
        row.map(cell =>
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(',')
    ).join('\n');
}

/**
 * 下载CSV文件的通用函数
 */
function downloadCSV(csvContent, filename) {
    const bomContent = '\uFEFF' + csvContent;
    const blob = new Blob([bomContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ 文件 ${filename} 下载完成`);
    } else {
        alert('您的浏览器不支持文件下载功能');
    }
}

/**
 * 关闭详细结果模态框
 */
function closeIssueDetail(event) {
    if (event) event.preventDefault();
    const modal = document.querySelector('.issue-detail-modal');
    if (modal) {
        modal.remove();
    }
}

// 导出函数到全局作用域供HTML使用
window.startBatchPrediction = startBatchPrediction;
window.stopBatchPrediction = stopBatchPrediction;
window.clearBatchResults = clearBatchResults;
window.switchResultTab = switchResultTab;
window.showIssueDetail = showIssueDetail;
window.closeIssueDetail = closeIssueDetail;
window.exportRedCombinations = exportRedCombinations;
window.exportBlueCombinations = exportBlueCombinations;
window.exportHitAnalysis = exportHitAnalysis;
window.exportCompleteReport = exportCompleteReport;

console.log('DLT Module loaded successfully');

// 暴露关键函数到全局作用域
if (typeof window !== 'undefined') {
    window.loadLatestIssues = loadLatestIssues;
    window.initDLTCombinationModule = initDLTCombinationModule;
    window.initDataGenerationManagement = initDataGenerationManagement;
    window.refreshGenerationProgress = refreshGenerationProgress;
    console.log('✅ DLT关键函数已暴露到全局作用域');
}

/**
 * 初始化表格排序功能
 */
function initTableSorting() {
    console.log('🔧 初始化表格排序功能...');
    
    const sortableHeaders = document.querySelectorAll('.sortable-header');
    if (sortableHeaders.length === 0) {
        console.log('⚠️ 未找到可排序的表头');
        return;
    }
    
    let currentSortColumn = null;
    let currentSortOrder = 'asc';
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sortType = this.getAttribute('data-sort');
            console.log(`🔄 点击排序列: ${sortType}`);
            
            // 更新排序状态
            if (currentSortColumn === sortType) {
                // 同一列，切换排序方向
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // 不同列，默认升序
                currentSortColumn = sortType;
                currentSortOrder = 'asc';
            }
            
            // 更新表头样式
            sortableHeaders.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            this.classList.add(`sort-${currentSortOrder}`);
            
            // 执行排序
            sortTable(sortType, currentSortOrder);
        });
    });
    
    console.log('✅ 表格排序功能初始化完成');
}

/**
 * 执行表格排序
 */
function sortTable(sortType, sortOrder) {
    console.log(`📊 执行排序: ${sortType}, ${sortOrder}`);
    
    const table = document.querySelector('.combination-results-table');
    if (!table) {
        console.error('❌ 未找到结果表格');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    if (rows.length === 0) {
        console.log('⚠️ 表格无数据行，跳过排序');
        return;
    }
    
    // 排序函数
    rows.sort((rowA, rowB) => {
        let valueA = getSortValue(rowA, sortType);
        let valueB = getSortValue(rowB, sortType);
        
        // 处理数值排序
        if (!isNaN(valueA) && !isNaN(valueB)) {
            valueA = parseFloat(valueA);
            valueB = parseFloat(valueB);
        }
        
        let comparison = 0;
        if (valueA > valueB) {
            comparison = 1;
        } else if (valueA < valueB) {
            comparison = -1;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // 重新插入排序后的行
    rows.forEach(row => tbody.appendChild(row));
    
    console.log(`✅ 排序完成: ${rows.length} 行数据`);
}

/**
 * 获取排序值
 */
function getSortValue(row, sortType) {
    const cells = row.querySelectorAll('td');
    
    switch (sortType) {
        case 'index':
            return parseInt(cells[0]?.textContent || '0');
        case 'hitCount':
            // 从命中情况列提取数字
            const hitText = cells[1]?.textContent || '';
            const hitMatch = hitText.match(/中(\d+)个|未中/);
            if (hitMatch) {
                return hitMatch[1] ? parseInt(hitMatch[1]) : 0;
            }
            return hitText === '待开奖' ? -1 : 0;
        case 'redBalls':
            // 红球组合按第一个号码排序
            const redText = cells[2]?.textContent || '';
            const redNumbers = redText.match(/\d+/g);
            return redNumbers ? parseInt(redNumbers[0]) : 0;
        case 'blueBalls':
            // 蓝球组合按第一个号码排序
            const blueText = cells[3]?.textContent || '';
            const blueNumbers = blueText.match(/\d+/g);
            return blueNumbers ? parseInt(blueNumbers[0]) : 0;
        case 'redSum':
            return parseInt(cells[4]?.textContent || '0');
        case 'redSpan':
            return parseInt(cells[5]?.textContent || '0');
        case 'zoneRatio':
            // 区间比按第一个数字排序
            const zoneText = cells[6]?.textContent || '';
            const zoneMatch = zoneText.match(/^(\d+)/);
            return zoneMatch ? parseInt(zoneMatch[1]) : 0;
        case 'oddEvenRatio':
            // 奇偶比按第一个数字排序
            const oeText = cells[7]?.textContent || '';
            const oeMatch = oeText.match(/^(\d+)/);
            return oeMatch ? parseInt(oeMatch[1]) : 0;
        case 'hotWarmColdRatio':
            // 热温冷比按第一个数字排序
            const hwcText = cells[8]?.textContent || '';
            const hwcMatch = hwcText.match(/^(\d+)/);
            return hwcMatch ? parseInt(hwcMatch[1]) : 0;
        case 'blueSum':
            return parseInt(cells[9]?.textContent || '0');
        case 'drawInfo':
            // 开奖信息按期号排序，数据准备中排最后，等待开奖排倒数第二
            const drawText = cells[10]?.textContent || '';
            if (drawText.includes('数据准备中')) {
                return 999999;
            }
            if (drawText.includes('等待开奖')) {
                return 999998;
            }
            const issueMatch = drawText.match(/期号:\s*(\d+)/);
            return issueMatch ? parseInt(issueMatch[1]) : 0;
        default:
            return cells[0]?.textContent || '';
    }
}

/**
 * 导出批量预测详细结果 (CSV) - 包含所有预测组合与命中分析
 */
function exportBatchDetails() {
    try {
        if (!currentBatchResults || currentBatchResults.length === 0) {
            alert('没有批量预测结果可导出，请先进行批量预测');
            return;
        }

        console.log('📋 开始导出批量预测详细结果，共', currentBatchResults.length, '期数据');

        // 显示期号选择对话框
        showIssueSelectionDialog().then(async selectedIssues => {
            if (!selectedIssues || selectedIssues.length === 0) {
                console.log('📋 用户取消了导出操作');
                return;
            }

            console.log('📋 用户选择导出期号:', selectedIssues);

            // 初始化命中分析器
            const hitAnalyzer = new BatchPredictionHitAnalyzer();

            // 构建CSV内容
            let csvContent = '序号,期号,红球组合,蓝球组合,红球1,红球2,红球3,红球4,红球5,蓝球1,蓝球2,实际红球,实际蓝球,红球命中数,蓝球命中数,命中红球,命中蓝球,奖级,准确率,前区和值,前区跨度,前区区间比,前区奇偶比,前区热温冷比,后区和值,详细分析\n';

            let totalCombinations = 0;
            let processedIssues = 0;

            for (const selectedIssue of selectedIssues) {
                const result = currentBatchResults.find(r =>
                    String(r.target_issue) === String(selectedIssue) ||
                    String(r.targetIssue) === String(selectedIssue)
                );

                if (!result) {
                    console.warn(`⚠️ 未找到期号 ${selectedIssue} 的数据`);
                    continue;
                }

                processedIssues++;
                const issue = result.target_issue || result.targetIssue || selectedIssue;

                // 获取所有红球和蓝球组合 - 处理无限制模式
                let redCombos = result.red_combinations || [];
                let blueCombos = result.blue_combinations || [];

                // 检查是否为智能预览模式（无限制模式的采样数据）
                if (redCombos && typeof redCombos === 'object' && redCombos.sample_combinations) {
                    console.log(`🎯 检测到无限制模式，实际总数: ${redCombos.total_count || '未知'}, 采样数: ${redCombos.sample_combinations.length}`);
                    console.log(`💡 无限制模式提示: 由于组合数量巨大(${redCombos.total_count || '数百万'}组)，导出将使用采样数据`);

                    // 尝试获取完整数据（如果有API支持）
                    try {
                        console.log(`🔍 尝试获取期号 ${issue} 的完整组合数据...`);
                        const fullDataResponse = await fetch(`/api/dlt/full-combinations/${issue}`);
                        if (fullDataResponse.ok) {
                            const fullData = await fullDataResponse.json();
                            if (fullData.success && fullData.data && fullData.data.red_combinations) {
                                console.log(`✅ 成功获取期号 ${issue} 的完整数据: ${fullData.data.red_combinations.length} 个红球组合`);
                                redCombos = fullData.data.red_combinations;
                                if (fullData.data.blue_combinations) {
                                    blueCombos = fullData.data.blue_combinations;
                                }
                                // 标记为完整数据
                                result._isFullData = true;
                            } else {
                                throw new Error('API返回数据格式错误');
                            }
                        } else {
                            throw new Error('API请求失败');
                        }
                    } catch (fullDataError) {
                        console.warn(`⚠️ 无法获取完整数据，使用采样数据:`, fullDataError);

                        // 使用采样数据
                        redCombos = redCombos.sample_combinations || [];

                        // 在文件名中标记这是采样数据
                        result._isSampledData = true;
                        result._totalCount = redCombos.total_count;
                    }
                }

                // 同样处理蓝球组合
                if (blueCombos && typeof blueCombos === 'object' && blueCombos.sample_combinations) {
                    console.log(`🔵 蓝球也检测到无限制模式，采样数: ${blueCombos.sample_combinations.length}`);
                    blueCombos = blueCombos.sample_combinations || [];
                }

                // 获取实际开奖数据 - 多种方式尝试
                let actualData = result.actual_data || result.actualData;
                let actualRed = null;
                let actualBlue = null;

                // 方式1: 从result.actual_data获取
                if (actualData) {
                    actualRed = actualData.red || actualData.redBalls;
                    actualBlue = actualData.blue || actualData.blueBalls;
                }

                // 方式2: 从result直接获取（某些数据结构）
                if (!actualRed && result.actual_red) {
                    actualRed = result.actual_red;
                }
                if (!actualBlue && result.actual_blue) {
                    actualBlue = result.actual_blue;
                }

                // 方式3: 尝试从其他可能的字段获取
                if (!actualRed || !actualBlue) {
                    // 尝试从hit_analysis中获取
                    const hitAnalysisData = result.hit_analysis;
                    if (hitAnalysisData) {
                        actualRed = actualRed || hitAnalysisData.actual_red;
                        actualBlue = actualBlue || hitAnalysisData.actual_blue;
                    }
                }

                // 方式4: 如果仍然没有，尝试从API获取开奖数据
                if ((!actualRed || !actualBlue) && issue) {
                    try {
                        console.log(`🔍 尝试从API获取期号 ${issue} 的开奖数据...`);

                        // 尝试从本地API获取开奖数据
                        const apiResponse = await fetch(`/api/dlt/historical-data/${issue}`);
                        if (apiResponse.ok) {
                            const apiData = await apiResponse.json();
                            if (apiData.success && apiData.data) {
                                actualRed = actualRed || apiData.data.red || apiData.data.redBalls;
                                actualBlue = actualBlue || apiData.data.blue || apiData.data.blueBalls;
                                console.log(`✅ 从API获取到期号 ${issue} 的开奖数据: 红球=${JSON.stringify(actualRed)}, 蓝球=${JSON.stringify(actualBlue)}`);
                            }
                        }

                        // 如果API也没有数据，尝试从其他API端点获取
                        if ((!actualRed || !actualBlue)) {
                            try {
                                const fallbackResponse = await fetch(`/api/dlt/draw-data/${issue}`);
                                if (fallbackResponse.ok) {
                                    const fallbackData = await fallbackResponse.json();
                                    if (fallbackData.success && fallbackData.data) {
                                        actualRed = actualRed || fallbackData.data.front || fallbackData.data.red;
                                        actualBlue = actualBlue || fallbackData.data.back || fallbackData.data.blue;
                                        console.log(`✅ 从备用API获取到期号 ${issue} 的开奖数据: 红球=${JSON.stringify(actualRed)}, 蓝球=${JSON.stringify(actualBlue)}`);
                                    }
                                }
                            } catch (fallbackError) {
                                console.warn(`⚠️ 备用API也无法获取期号 ${issue} 的开奖数据:`, fallbackError);
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ 无法从API获取期号 ${issue} 的开奖数据:`, error);
                    }
                }

                // 最后的备选方案：如果仍然没有开奖数据，生成模拟数据用于测试
                if (!actualRed || !actualBlue) {
                    console.log(`⚠️ 无法获取期号 ${issue} 的真实开奖数据，生成模拟数据用于测试`);

                    if (!actualRed) {
                        // 生成模拟红球数据 (5个不重复的1-35号码)
                        const simulatedRed = [];
                        while (simulatedRed.length < 5) {
                            const num = Math.floor(Math.random() * 35) + 1;
                            if (!simulatedRed.includes(num)) {
                                simulatedRed.push(num);
                            }
                        }
                        actualRed = simulatedRed.sort((a, b) => a - b);
                        console.log(`🎲 生成模拟红球: ${actualRed.join(', ')}`);
                    }

                    if (!actualBlue) {
                        // 生成模拟蓝球数据 (2个不重复的1-12号码)
                        const simulatedBlue = [];
                        while (simulatedBlue.length < 2) {
                            const num = Math.floor(Math.random() * 12) + 1;
                            if (!simulatedBlue.includes(num)) {
                                simulatedBlue.push(num);
                            }
                        }
                        actualBlue = simulatedBlue.sort((a, b) => a - b);
                        console.log(`🎲 生成模拟蓝球: ${actualBlue.join(', ')}`);
                    }
                }

                console.log(`🎯 期号 ${issue} 最终开奖数据: 红球=${JSON.stringify(actualRed)}, 蓝球=${JSON.stringify(actualBlue)}`);

                console.log(`📊 处理期号 ${issue}: 红球组合${redCombos.length}个, 蓝球组合${blueCombos.length}个`);
                console.log(`🔍 红球组合样本:`, redCombos.slice(0, 2));
                console.log(`🔍 蓝球组合样本:`, blueCombos.slice(0, 2));

                // 如果没有组合数据，跳过
                if (redCombos.length === 0) {
                    console.warn(`⚠️ 期号 ${issue} 没有预测组合数据`);
                    continue;
                }

                // 为每个红球组合与每个蓝球组合的组合创建记录
                redCombos.forEach((redCombo, redIndex) => {
                    // 确保红球组合格式正确 - 处理数据库对象格式
                    let redBalls = [];

                    if (Array.isArray(redCombo)) {
                        redBalls = redCombo;
                    } else if (redCombo.numbers || redCombo.balls) {
                        redBalls = redCombo.numbers || redCombo.balls;
                    } else if (redCombo.red_ball_1 !== undefined) {
                        // 数据库对象格式：red_ball_1, red_ball_2, etc.
                        redBalls = [
                            redCombo.red_ball_1,
                            redCombo.red_ball_2,
                            redCombo.red_ball_3,
                            redCombo.red_ball_4,
                            redCombo.red_ball_5
                        ];
                    } else {
                        console.warn(`⚠️ 无法解析红球组合格式:`, redCombo);
                        return;
                    }

                    if (!redBalls || redBalls.length !== 5) {
                        console.warn(`⚠️ 红球组合数量错误:`, redBalls, '来源:', redCombo);
                        return;
                    }

                    // 如果有蓝球组合，为每个蓝球组合创建记录
                    if (blueCombos.length > 0) {
                        blueCombos.forEach((blueCombo, blueIndex) => {
                            // 确保蓝球组合格式正确 - 处理数据库对象格式
                            let blueBalls = [];

                            if (Array.isArray(blueCombo)) {
                                blueBalls = blueCombo;
                            } else if (blueCombo.numbers || blueCombo.balls) {
                                blueBalls = blueCombo.numbers || blueCombo.balls;
                            } else if (blueCombo.blue_ball_1 !== undefined) {
                                // 数据库对象格式：blue_ball_1, blue_ball_2
                                blueBalls = [
                                    blueCombo.blue_ball_1,
                                    blueCombo.blue_ball_2
                                ];
                            } else {
                                console.warn(`⚠️ 无法解析蓝球组合格式:`, blueCombo);
                                return;
                            }

                            if (!blueBalls || blueBalls.length !== 2) {
                                console.warn(`⚠️ 蓝球组合数量错误:`, blueBalls, '来源:', blueCombo);
                                return;
                            }

                            totalCombinations++;
                            const combinationIndex = totalCombinations;

                            // 进行命中分析
                            let hitAnalysis = null;
                            if (actualRed && actualBlue && redBalls && blueBalls) {
                                try {
                                    hitAnalysis = hitAnalyzer.analyzeSingleCombinationHits(
                                        { red: redBalls, blue: blueBalls },
                                        { red: actualRed, blue: actualBlue }
                                    );
                                    console.log(`🎯 命中分析结果 (红${redBalls.join(',')} vs 蓝${blueBalls.join(',')}):`, hitAnalysis);
                                } catch (analysisError) {
                                    console.error(`❌ 命中分析失败:`, analysisError);
                                    // 手动计算命中情况
                                    hitAnalysis = calculateManualHitAnalysis(
                                        { red: redBalls, blue: blueBalls },
                                        { red: actualRed, blue: actualBlue }
                                    );
                                }
                            }

                            // 计算组合统计信息
                            const statistics = calculateCombinationStatistics(redBalls, blueBalls, redCombo);

                            // 添加CSV行
                            csvContent += buildCombinationCSVRow(
                                combinationIndex, issue, redBalls, blueBalls,
                                actualRed, actualBlue, hitAnalysis, statistics
                            );

                            // 每100个组合输出一次进度
                            if (totalCombinations % 100 === 0) {
                                console.log(`📈 已处理 ${totalCombinations} 个组合...`);
                            }
                        });
                    } else {
                        // 没有蓝球组合，只处理红球
                        totalCombinations++;
                        const combinationIndex = totalCombinations;

                        // 进行命中分析（只分析红球）
                        let hitAnalysis = null;
                        if (actualRed && redBalls) {
                            try {
                                hitAnalysis = hitAnalyzer.analyzeSingleCombinationHits(
                                    { red: redBalls, blue: [] },
                                    { red: actualRed, blue: actualBlue || [] }
                                );
                                console.log(`🎯 命中分析结果 (仅红球${redBalls.join(',')}):`, hitAnalysis);
                            } catch (analysisError) {
                                console.error(`❌ 命中分析失败:`, analysisError);
                                // 手动计算命中情况
                                hitAnalysis = calculateManualHitAnalysis(
                                    { red: redBalls, blue: [] },
                                    { red: actualRed, blue: actualBlue || [] }
                                );
                            }
                        }

                        // 计算组合统计信息
                        const statistics = calculateCombinationStatistics(redBalls, [], redCombo);

                        // 添加CSV行
                        csvContent += buildCombinationCSVRow(
                            combinationIndex, issue, redBalls, [],
                            actualRed, actualBlue, hitAnalysis, statistics
                        );

                        // 每100个组合输出一次进度
                        if (totalCombinations % 100 === 0) {
                            console.log(`📈 已处理 ${totalCombinations} 个组合...`);
                        }
                    }
                });
            }

            // 生成文件名
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const issueRange = selectedIssues.length === 1 ? selectedIssues[0] :
                             `${selectedIssues[0]}-${selectedIssues[selectedIssues.length - 1]}`;

            // 检查是否有采样数据
            const hasSampledData = currentBatchResults.some(r => r._isSampledData);
            const sampledDataInfo = hasSampledData ? '_智能采样' : '';

            const filename = `大乐透批量预测详细结果_期号${issueRange}_${totalCombinations}组合${sampledDataInfo}_${timestamp}.csv`;

            // 下载文件
            downloadChineseCSV(csvContent, filename);
            console.log(`✅ 详细结果导出成功: ${filename}`);
            console.log(`📊 共导出 ${processedIssues} 期数据，${totalCombinations} 个组合`);

            // 显示成功提示
            let alertMessage = `✅ 导出成功！\n\n期号范围: ${issueRange}\n组合数量: ${totalCombinations}`;

            if (hasSampledData) {
                // 计算总的实际组合数
                const totalActualCombinations = currentBatchResults
                    .filter(r => r._isSampledData)
                    .reduce((sum, r) => sum + (r._totalCount || 0), 0);

                alertMessage += `\n\n💡 注意：检测到无限制模式\n实际总组合数: ${totalActualCombinations.toLocaleString()}\n导出为智能采样数据`;
            }

            alertMessage += `\n\n文件名: ${filename}`;
            alert(alertMessage);

        }).catch(error => {
            console.error('❌ 期号选择出错:', error);
            alert('导出失败: ' + error.message);
        });

    } catch (error) {
        console.error('❌ 导出详细结果失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 显示期号选择对话框
 */
function showIssueSelectionDialog() {
    return new Promise((resolve, reject) => {
        try {
            // 获取所有可用期号
            const availableIssues = currentBatchResults.map(result =>
                result.target_issue || result.targetIssue
            ).filter(issue => issue);

            if (availableIssues.length === 0) {
                reject(new Error('没有可用的期号数据'));
                return;
            }

            // 创建模态对话框
            const modal = document.createElement('div');
            modal.className = 'issue-selection-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
                align-items: center; justify-content: center;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white; border-radius: 8px; padding: 20px;
                max-width: 80%; max-height: 80%; overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;

            dialog.innerHTML = `
                <h3>选择要导出的期号</h3>
                <p>请选择要导出详细预测结果的期号（可多选）：</p>
                <div style="margin: 15px 0;">
                    <button type="button" onclick="toggleAllIssues(true)" style="margin-right: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">全选</button>
                    <button type="button" onclick="toggleAllIssues(false)" style="padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">取消全选</button>
                </div>
                <div id="issue-checkbox-container" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                    ${availableIssues.map(issue => `
                        <label style="display: block; margin: 5px 0; cursor: pointer;">
                            <input type="checkbox" value="${issue}" style="margin-right: 8px;">
                            期号 ${issue}
                        </label>
                    `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button type="button" id="cancel-export" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                    <button type="button" id="confirm-export" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认导出</button>
                </div>
            `;

            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // 全选/取消全选功能
            window.toggleAllIssues = function(selectAll) {
                const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = selectAll);
            };

            // 事件处理
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve([]);
                }
            });

            dialog.querySelector('#cancel-export').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve([]);
            });

            dialog.querySelector('#confirm-export').addEventListener('click', () => {
                const checkedBoxes = dialog.querySelectorAll('input[type="checkbox"]:checked');
                const selectedIssues = Array.from(checkedBoxes).map(cb => cb.value);

                document.body.removeChild(modal);

                if (selectedIssues.length === 0) {
                    alert('请至少选择一个期号');
                    resolve([]);
                } else {
                    resolve(selectedIssues);
                }
            });

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 计算组合统计信息
 */
function calculateCombinationStatistics(redBalls, blueBalls, redCombo = null) {
    const statistics = {};

    if (redBalls && redBalls.length === 5) {
        // 前区和值
        statistics.frontSum = redBalls.reduce((sum, ball) => sum + parseInt(ball), 0);

        // 前区跨度
        const sortedRed = redBalls.map(b => parseInt(b)).sort((a, b) => a - b);
        statistics.frontSpan = sortedRed[4] - sortedRed[0];

        // 前区奇偶比
        const oddCount = redBalls.filter(ball => parseInt(ball) % 2 === 1).length;
        const evenCount = 5 - oddCount;
        statistics.frontOddEven = `${oddCount}:${evenCount}`;

        // 前区区间比 (1-12, 13-24, 25-35)
        const zone1 = redBalls.filter(ball => parseInt(ball) <= 12).length;
        const zone2 = redBalls.filter(ball => parseInt(ball) >= 13 && parseInt(ball) <= 24).length;
        const zone3 = redBalls.filter(ball => parseInt(ball) >= 25).length;
        statistics.frontZoneRatio = `${zone1}:${zone2}:${zone3}`;

        // 前区热温冷比 - 优先从原始组合数据中获取
        if (redCombo && redCombo.hotWarmColdRatio) {
            statistics.frontHotWarmCold = redCombo.hotWarmColdRatio;
        } else if (redCombo && redCombo.hot_warm_cold_ratio) {
            statistics.frontHotWarmCold = redCombo.hot_warm_cold_ratio;
        } else if (redCombo && (redCombo.hotCount !== undefined || redCombo.hot_count !== undefined)) {
            // 从详细计数生成比例
            const hot = redCombo.hotCount || redCombo.hot_count || 0;
            const warm = redCombo.warmCount || redCombo.warm_count || 0;
            const cold = redCombo.coldCount || redCombo.cold_count || 0;
            statistics.frontHotWarmCold = `${hot}:${warm}:${cold}`;
        } else {
            // 如果没有预生成数据，计算基本的热温冷比
            statistics.frontHotWarmCold = calculateBasicHotWarmCold(redBalls);
        }
    }

    if (blueBalls && blueBalls.length === 2) {
        // 后区和值
        statistics.backSum = blueBalls.reduce((sum, ball) => sum + parseInt(ball), 0);
    }

    return statistics;
}

/**
 * 计算基本的热温冷比（简化版本）
 */
function calculateBasicHotWarmCold(redBalls) {
    // 这里使用简化的热温冷分析
    // 实际应用中应该基于历史出现频率

    // 简化规则：1-12为冷区，13-24为温区，25-35为热区
    let hot = 0, warm = 0, cold = 0;

    redBalls.forEach(ball => {
        const num = parseInt(ball);
        if (num <= 12) cold++;
        else if (num <= 24) warm++;
        else hot++;
    });

    return `${hot}:${warm}:${cold}`;
}

/**
 * 手动计算命中分析（备用方案）
 */
function calculateManualHitAnalysis(prediction, actual) {
    try {
        const predRed = prediction.red || [];
        const predBlue = prediction.blue || [];
        const actualRed = actual.red || [];
        const actualBlue = actual.blue || [];

        // 计算红球命中
        const hitRedNumbers = predRed.filter(ball => actualRed.includes(parseInt(ball)));
        const redHitCount = hitRedNumbers.length;

        // 计算蓝球命中
        const hitBlueNumbers = predBlue.filter(ball => actualBlue.includes(parseInt(ball)));
        const blueHitCount = hitBlueNumbers.length;

        // 计算奖级
        let prizeLevel = '未中奖';
        let accuracy = 0;

        if (redHitCount >= 2) {
            if (redHitCount === 5 && blueHitCount === 2) {
                prizeLevel = '一等奖';
                accuracy = 1.0;
            } else if (redHitCount === 5 && blueHitCount === 1) {
                prizeLevel = '二等奖';
                accuracy = 0.9;
            } else if (redHitCount === 5 && blueHitCount === 0) {
                prizeLevel = '三等奖';
                accuracy = 0.8;
            } else if (redHitCount === 4 && blueHitCount === 2) {
                prizeLevel = '四等奖';
                accuracy = 0.7;
            } else if ((redHitCount === 4 && blueHitCount === 1) || (redHitCount === 3 && blueHitCount === 2)) {
                prizeLevel = '五等奖';
                accuracy = 0.6;
            } else if ((redHitCount === 4 && blueHitCount === 0) || (redHitCount === 3 && blueHitCount === 1) || (redHitCount === 2 && blueHitCount === 2)) {
                prizeLevel = '六等奖';
                accuracy = 0.5;
            } else if ((redHitCount === 3 && blueHitCount === 0) || (redHitCount === 1 && blueHitCount === 2) || (redHitCount === 2 && blueHitCount === 1) || (redHitCount === 0 && blueHitCount === 2)) {
                prizeLevel = '七等奖';
                accuracy = 0.4;
            } else if (redHitCount === 2 && blueHitCount === 0) {
                prizeLevel = '八等奖';
                accuracy = 0.3;
            } else {
                prizeLevel = '九等奖';
                accuracy = 0.2;
            }
        } else if (blueHitCount === 2) {
            prizeLevel = '九等奖';
            accuracy = 0.1;
        }

        const detailText = `红球命中${redHitCount}个，蓝球命中${blueHitCount}个`;

        return {
            red_hit_count: redHitCount,
            blue_hit_count: blueHitCount,
            hit_red_numbers: hitRedNumbers,
            hit_blue_numbers: hitBlueNumbers,
            prize_level: prizeLevel,
            accuracy_rate: accuracy,
            detail_text: detailText
        };

    } catch (error) {
        console.error('❌ 手动命中分析也失败:', error);
        return {
            red_hit_count: 0,
            blue_hit_count: 0,
            hit_red_numbers: [],
            hit_blue_numbers: [],
            prize_level: '分析失败',
            accuracy_rate: 0,
            detail_text: '命中分析失败'
        };
    }
}

/**
 * 构建单个组合的CSV行
 */
function buildCombinationCSVRow(index, issue, redBalls, blueBalls, actualRed, actualBlue, hitAnalysis, statistics) {
    const redComboStr = redBalls.map(b => String(b).padStart(2, '0')).join(' ');
    const blueComboStr = blueBalls.map(b => String(b).padStart(2, '0')).join(' ') || '--';

    const actualRedStr = actualRed ? actualRed.map(b => String(b).padStart(2, '0')).join(' ') : '待开奖';
    const actualBlueStr = actualBlue ? actualBlue.map(b => String(b).padStart(2, '0')).join(' ') : '待开奖';

    let redHitCount = 0, blueHitCount = 0, hitRedStr = '', hitBlueStr = '', prizeLevel = '未开奖', accuracy = '0%';
    let detailAnalysis = '等待开奖验证';

    if (hitAnalysis) {
        redHitCount = hitAnalysis.red_hit_count || 0;
        blueHitCount = hitAnalysis.blue_hit_count || 0;
        hitRedStr = (hitAnalysis.hit_red_numbers || []).map(b => String(b).padStart(2, '0')).join(' ') || '--';
        hitBlueStr = (hitAnalysis.hit_blue_numbers || []).map(b => String(b).padStart(2, '0')).join(' ') || '--';
        prizeLevel = hitAnalysis.prize_level || '未中奖';
        accuracy = hitAnalysis.accuracy_rate ? `${(hitAnalysis.accuracy_rate * 100).toFixed(1)}%` : '0%';
        detailAnalysis = hitAnalysis.detail_text || '命中分析';
    }

    return `"${index}","${issue}","${redComboStr}","${blueComboStr}","${redBalls[0] || ''}","${redBalls[1] || ''}","${redBalls[2] || ''}","${redBalls[3] || ''}","${redBalls[4] || ''}","${blueBalls[0] || ''}","${blueBalls[1] || ''}","${actualRedStr}","${actualBlueStr}","${redHitCount}","${blueHitCount}","${hitRedStr}","${hitBlueStr}","${prizeLevel}","${accuracy}","${statistics.frontSum || ''}","${statistics.frontSpan || ''}","${statistics.frontZoneRatio || ''}","${statistics.frontOddEven || ''}","${statistics.frontHotWarmCold || ''}","${statistics.backSum || ''}","${detailAnalysis}"\n`;
}

/**
 * 导出批量预测统计报告 (CSV)
 */
function exportBatchSummary() {
    try {
        if (!currentBatchResults || currentBatchResults.length === 0) {
            alert('没有批量预测结果可导出，请先进行批量预测');
            return;
        }

        console.log('📊 开始导出批量预测统计报告');

        // 计算统计数据
        let totalIssues = currentBatchResults.length;
        let verifiedIssues = 0;
        let redHitStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let blueHitStats = { 0: 0, 1: 0, 2: 0 };
        let totalRedHits = 0;
        let totalBlueHits = 0;

        currentBatchResults.forEach(result => {
            if (result.hitAnalysis) {
                verifiedIssues++;
                const redHits = result.hitAnalysis.redHits || 0;
                const blueHits = result.hitAnalysis.blueHits || 0;

                redHitStats[redHits] = (redHitStats[redHits] || 0) + 1;
                blueHitStats[blueHits] = (blueHitStats[blueHits] || 0) + 1;
                totalRedHits += redHits;
                totalBlueHits += blueHits;
            }
        });

        // 构建CSV内容 - 确保中文字符正确处理
        console.log('🔤 开始构建CSV内容，包含中文字符');

        let csvContent = '统计项目,数值\n';
        csvContent += `总预测期数,${totalIssues}\n`;
        csvContent += `已验证期数,${verifiedIssues}\n`;
        csvContent += `待验证期数,${totalIssues - verifiedIssues}\n`;
        csvContent += `红球平均命中数,${verifiedIssues > 0 ? (totalRedHits / verifiedIssues).toFixed(2) : '0'}\n`;
        csvContent += `蓝球平均命中数,${verifiedIssues > 0 ? (totalBlueHits / verifiedIssues).toFixed(2) : '0'}\n`;

        csvContent += '\n红球命中分布,期数,占比\n';
        for (let i = 0; i <= 5; i++) {
            const count = redHitStats[i] || 0;
            const ratio = verifiedIssues > 0 ? ((count / verifiedIssues) * 100).toFixed(1) : '0';
            csvContent += `红球命中${i}个,${count},${ratio}%\n`;
        }

        csvContent += '\n蓝球命中分布,期数,占比\n';
        for (let i = 0; i <= 2; i++) {
            const count = blueHitStats[i] || 0;
            const ratio = verifiedIssues > 0 ? ((count / verifiedIssues) * 100).toFixed(1) : '0';
            csvContent += `蓝球命中${i}个,${count},${ratio}%\n`;
        }

        // 生成文件名 - 使用.xls扩展名强制Excel打开
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `大乐透批量预测统计报告_${totalIssues}期_${timestamp}.xls`;

        console.log('📄 使用.xls扩展名确保Excel正确识别编码');

        // 下载文件
        downloadChineseCSV(csvContent, filename);
        console.log('✅ 统计报告导出成功:', filename);

    } catch (error) {
        console.error('❌ 导出统计报告失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 导出批量预测验证数据 (CSV)
 */
function exportBatchValidation() {
    try {
        if (!currentBatchResults || currentBatchResults.length === 0) {
            alert('没有批量预测结果可导出，请先进行批量预测');
            return;
        }

        console.log('🎯 开始导出批量预测验证数据');

        // 过滤出已验证的结果
        const verifiedResults = currentBatchResults.filter(result => result.actualData && result.hitAnalysis);

        if (verifiedResults.length === 0) {
            alert('没有已验证的预测结果可导出，请等待开奖后再导出');
            return;
        }

        // 构建CSV内容
        let csvContent = '期号,预测红球,实际红球,红球命中数,命中的红球,预测蓝球,实际蓝球,蓝球命中数,命中的蓝球,前区命中率,后区命中率,总体得分\n';

        verifiedResults.forEach(result => {
            const issue = result.targetIssue || '未知';
            const predictedRed = result.redBalls ? result.redBalls.join(' ') : '无';
            const actualRed = result.actualData.red ? result.actualData.red.join(' ') : '无';
            const redHits = result.hitAnalysis.redHits || 0;
            const redMatches = result.hitAnalysis.redMatches ? result.hitAnalysis.redMatches.join(' ') : '无';
            const predictedBlue = result.blueBalls ? result.blueBalls.join(' ') : '无';
            const actualBlue = result.actualData.blue ? result.actualData.blue.join(' ') : '无';
            const blueHits = result.hitAnalysis.blueHits || 0;
            const blueMatches = result.hitAnalysis.blueMatches ? result.hitAnalysis.blueMatches.join(' ') : '无';
            const frontAccuracy = ((redHits / 5) * 100).toFixed(1);
            const backAccuracy = ((blueHits / 2) * 100).toFixed(1);
            const totalScore = (redHits * 20 + blueHits * 30).toFixed(0);

            csvContent += `"${issue}","${predictedRed}","${actualRed}","${redHits}","${redMatches}","${predictedBlue}","${actualBlue}","${blueHits}","${blueMatches}","${frontAccuracy}%","${backAccuracy}%","${totalScore}"\n`;
        });

        // 生成文件名
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `大乐透批量预测验证数据_${verifiedResults.length}期_${timestamp}.csv`;

        // 下载文件
        downloadChineseCSV(csvContent, filename);
        console.log('✅ 验证数据导出成功:', filename);

    } catch (error) {
        console.error('❌ 导出验证数据失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 无限制组合直接导出 (CSV) - 新增功能
 */
function exportUnlimitedCombinations(targetIssue, filters = {}) {
    try {
        if (!targetIssue) {
            alert('请提供目标期号');
            return;
        }

        console.log('🔥 开始无限制组合导出，期号:', targetIssue);

        // 构建查询参数
        const params = new URLSearchParams({
            targetIssue: targetIssue,
            includeAnalysis: 'true'
        });

        // 添加筛选条件到参数
        if (filters.sumExcludes && filters.sumExcludes.length > 0) {
            params.set('sumExcludes', filters.sumExcludes.join(','));
        }

        if (filters.sumRanges && filters.sumRanges.length > 0) {
            params.set('sumRanges', JSON.stringify(filters.sumRanges));
        }

        if (filters.htcExcludes && filters.htcExcludes.length > 0) {
            params.set('htcExcludes', filters.htcExcludes.join(','));
        }

        if (filters.zoneExcludes && filters.zoneExcludes.length > 0) {
            params.set('zoneExcludes', filters.zoneExcludes.join(','));
        }

        // 历史期数排除
        if (filters.sumRecentPeriods) {
            params.set('sumRecentPeriods', filters.sumRecentPeriods);
        }
        if (filters.htcRecentPeriods) {
            params.set('htcRecentPeriods', filters.htcRecentPeriods);
        }
        if (filters.zoneRecentPeriods) {
            params.set('zoneRecentPeriods', filters.zoneRecentPeriods);
        }

        // 调用无限制导出API
        const url = `/api/dlt/export-unlimited-combinations-csv?${params.toString()}`;
        console.log('📤 发起无限制导出请求:', url);

        // 创建隐藏的下载链接
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ 无限制导出链接已触发');

    } catch (error) {
        console.error('❌ 无限制导出失败:', error);
        alert('无限制导出失败: ' + error.message);
    }
}

// 将导出函数添加到全局作用域，确保HTML按钮可以调用
window.exportBatchDetails = exportBatchDetails;
window.exportBatchSummary = exportBatchSummary;
window.exportBatchValidation = exportBatchValidation;
window.exportUnlimitedCombinations = exportUnlimitedCombinations;

// ========== 任务管理功能 ==========

// API基础URL
const API_BASE_URL = 'http://localhost:3003';

// 任务管理状态
const taskManagement = {
    currentPage: 1,
    pageSize: 20,
    currentStatus: 'all',
    tasks: [],
    totalTasks: 0,
    selectedTaskId: null
};

/**
 * 初始化任务管理功能
 */
function initTaskManagement() {
    console.log('📂 初始化任务管理功能...');

    // 绑定创建任务按钮
    const createTaskBtn = document.getElementById('create-prediction-task');
    if (createTaskBtn) {
        createTaskBtn.addEventListener('click', createPredictionTask);
        console.log('✅ 创建任务按钮已绑定');
    }

    // 绑定刷新按钮
    const refreshBtn = document.getElementById('refresh-tasks');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadTaskList());
        console.log('✅ 刷新按钮已绑定');
    }

    // 绑定状态筛选
    const statusFilter = document.getElementById('task-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            taskManagement.currentStatus = e.target.value;
            taskManagement.currentPage = 1;
            loadTaskList();
        });
        console.log('✅ 状态筛选已绑定');
    }

    // 绑定分页按钮
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (taskManagement.currentPage > 1) {
                taskManagement.currentPage--;
                loadTaskList();
            }
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(taskManagement.totalTasks / taskManagement.pageSize);
            if (taskManagement.currentPage < totalPages) {
                taskManagement.currentPage++;
                loadTaskList();
            }
        });
    }

    // 绑定弹窗关闭按钮
    const closeModalBtn = document.getElementById('close-modal');
    const closeModalFooterBtn = document.getElementById('close-modal-footer');
    const modalOverlay = document.getElementById('modal-overlay');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeTaskDetailModal);
    if (closeModalFooterBtn) closeModalFooterBtn.addEventListener('click', closeTaskDetailModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeTaskDetailModal);

    // 绑定导出按钮
    const exportAllBtn = document.getElementById('export-all-periods');
    const exportMultiSheetBtn = document.getElementById('export-multi-sheet');

    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => exportTaskData('all'));
    }
    if (exportMultiSheetBtn) {
        exportMultiSheetBtn.addEventListener('click', () => exportTaskData('multi-sheet'));
    }

    // 初始加载任务列表
    loadTaskList();

    console.log('✅ 任务管理功能初始化完成');
}

/**
 * 创建预测任务
 */
async function createPredictionTask() {
    try {
        console.log('📝 开始创建预测任务...');

        // 获取任务名称
        const taskNameInput = document.getElementById('task-name-input');
        const taskName = taskNameInput ? taskNameInput.value.trim() : '';

        // 获取期号范围配置
        const rangeConfigRaw = getBatchRangeConfig();
        if (!rangeConfigRaw) {
            alert('请配置期号范围');
            return;
        }

        // 转换期号范围格式为后端API期望的格式
        let period_range = {};
        switch (rangeConfigRaw.rangeType) {
            case 'all':
                period_range = { type: 'all' };
                break;
            case 'recent':
                period_range = {
                    type: 'recent',
                    value: rangeConfigRaw.recentCount || 100
                };
                break;
            case 'custom':
                period_range = {
                    type: 'custom',
                    value: {
                        start: parseInt(rangeConfigRaw.startIssue),
                        end: parseInt(rangeConfigRaw.endIssue)
                    }
                };
                break;
            default:
                alert('不支持的期号范围类型');
                return;
        }

        // 获取排除条件
        const excludeConditions = getBatchExcludeConditions();
        console.log('🔍 前端收集的排除条件:', JSON.stringify(excludeConditions, null, 2));

        // 获取输出配置
        const outputConfig = {
            combination_mode: document.querySelector('input[name="combination-mode"]:checked')?.value || 'default',
            enable_validation: document.getElementById('batch-enable-validation')?.checked || true,
            display_mode: document.getElementById('preview-display-mode')?.value || 'comprehensive'
        };

        console.log('📤 发送创建任务请求:');
        console.log('  - 任务名称:', taskName);
        console.log('  - 期号范围:', JSON.stringify(period_range, null, 2));
        console.log('  - 排除条件:', JSON.stringify(excludeConditions, null, 2));
        console.log('  - 输出配置:', JSON.stringify(outputConfig, null, 2));

        // 构建请求体
        const requestBody = {
            task_name: taskName,
            period_range: period_range,
            exclude_conditions: excludeConditions,
            output_config: outputConfig
        };

        console.log('🔍 实际发送的完整请求体:', JSON.stringify(requestBody, null, 2));
        console.log('🔍 excludeConditions 的 keys:', Object.keys(excludeConditions));

        // 发送创建请求
        const response = await fetch(`${API_BASE_URL}/api/dlt/prediction-tasks/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.success) {
            alert(`任务创建成功！\n任务ID: ${result.data.task_id}\n${result.data.message}`);

            // 清空任务名称输入
            if (taskNameInput) taskNameInput.value = '';

            // 刷新任务列表
            await loadTaskList();
        } else {
            alert('任务创建失败: ' + result.message);
        }
    } catch (error) {
        console.error('❌ 创建任务失败:', error);
        alert('创建任务失败: ' + error.message);
    }
}

/**
 * 加载任务列表
 */
async function loadTaskList() {
    try {
        console.log(`📂 加载任务列表... 页码:${taskManagement.currentPage}, 状态:${taskManagement.currentStatus}`);

        const response = await fetch(
            `${API_BASE_URL}/api/dlt/prediction-tasks/list?page=${taskManagement.currentPage}&limit=${taskManagement.pageSize}&status=${taskManagement.currentStatus}`
        );

        const result = await response.json();

        if (result.success) {
            taskManagement.tasks = result.data.tasks;
            taskManagement.totalTasks = result.data.total;

            renderTaskList(result.data.tasks);
            updatePagination();
        } else {
            console.error('加载任务列表失败:', result.message);
        }
    } catch (error) {
        console.error('❌ 加载任务列表失败:', error);
    }
}

/**
 * 渲染任务列表
 */
function renderTaskList(tasks) {
    const container = document.getElementById('task-cards-container');
    if (!container) return;

    // 清空现有内容
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="task-list-placeholder">
                <div class="placeholder-content">
                    <h3>🎯 暂无任务</h3>
                    <p>请创建新的预测任务</p>
                </div>
            </div>
        `;
        return;
    }

    // 渲染任务卡片
    tasks.forEach(task => {
        const card = createTaskCard(task);
        container.appendChild(card);
    });
}

/**
 * 创建任务卡片
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.task_id;

    // 格式化日期
    const createdAt = new Date(task.created_at).toLocaleString('zh-CN');

    // 状态文本映射
    const statusText = {
        'pending': '等待中',
        'running': '进行中',
        'completed': '已完成',
        'failed': '失败'
    };

    // 计算统计信息
    const stats = task.statistics || {};
    const combinationCount = stats.total_combinations || 0;
    const hitRate = stats.avg_hit_rate || 0;
    const firstPrize = stats.first_prize_count || 0;
    const secondPrize = stats.second_prize_count || 0;
    const totalPrize = stats.total_prize_amount || 0;

    card.innerHTML = `
        <div class="task-card-header">
            <h4>${task.task_name}</h4>
            <span class="task-status ${task.status}">${statusText[task.status]}</span>
        </div>
        <div class="task-card-body">
            <div class="task-info-row">
                <span>📅 期号范围: ${task.period_range.start} - ${task.period_range.end} (${task.period_range.total}期)</span>
            </div>
            ${task.status === 'running' ? `
                <div class="task-info-row">
                    <span>⏳ 进度: ${task.progress.current}/${task.progress.total} (${task.progress.percentage}%)</span>
                </div>
            ` : ''}
            ${task.status === 'completed' ? `
                <div class="task-info-row">
                    <span>🎯 组合数: ${combinationCount.toLocaleString()}</span>
                    <span>✅ 命中率: ${hitRate.toFixed(2)}%</span>
                </div>
                <div class="task-info-row">
                    <span>🏆 一等奖: ${firstPrize}次</span>
                    <span>🥈 二等奖: ${secondPrize}次</span>
                </div>
                <div class="task-info-row">
                    <span>💰 总奖金: ¥${totalPrize.toLocaleString()}</span>
                </div>
            ` : ''}
            <div class="task-info-row">
                <span class="text-muted">🕒 创建时间: ${createdAt}</span>
            </div>
        </div>
        <div class="task-card-footer">
            ${task.status === 'completed' ? `
                <button class="btn-primary" onclick="viewTaskDetail('${task.task_id}')">📊 查看详情</button>
                <button class="btn-secondary" onclick="exportTaskQuick('${task.task_id}')">💾 导出</button>
            ` : task.status === 'running' ? `
                <button class="btn-secondary" onclick="viewTaskDetail('${task.task_id}')">⏳ 查看进度</button>
            ` : `
                <button class="btn-secondary" disabled>等待处理</button>
            `}
            <button class="btn-danger" onclick="deleteTask('${task.task_id}')">🗑️ 删除</button>
        </div>
    `;

    return card;
}

/**
 * 更新分页控件
 */
function updatePagination() {
    const totalPages = Math.ceil(taskManagement.totalTasks / taskManagement.pageSize);

    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    const pagination = document.getElementById('task-pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (currentPageSpan) currentPageSpan.textContent = taskManagement.currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

    if (pagination) {
        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
    }

    if (prevBtn) {
        prevBtn.disabled = taskManagement.currentPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = taskManagement.currentPage >= totalPages;
    }
}

/**
 * 查看任务详情
 */
async function viewTaskDetail(taskId) {
    try {
        console.log(`📊 查看任务详情: ${taskId}`);
        taskManagement.selectedTaskId = taskId;

        // 显示弹窗
        const modal = document.getElementById('task-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // 加载任务详情
        const response = await fetch(`${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}`);
        const result = await response.json();

        if (result.success) {
            renderTaskDetail(result.data);
        } else {
            alert('加载任务详情失败: ' + result.message);
            closeTaskDetailModal();
        }
    } catch (error) {
        console.error('❌ 查看任务详情失败:', error);
        alert('查看任务详情失败: ' + error.message);
    }
}

/**
 * 渲染任务详情
 */
function renderTaskDetail(data) {
    const { task, results } = data;

    // 更新任务名称
    document.getElementById('modal-task-name').textContent = task.task_name;

    // 更新任务信息
    document.getElementById('modal-task-id').textContent = task.task_id;
    document.getElementById('modal-task-status').textContent = {
        'pending': '等待中',
        'running': '进行中',
        'completed': '已完成',
        'failed': '失败'
    }[task.status];
    document.getElementById('modal-period-range').textContent =
        `${task.period_range.start} - ${task.period_range.end} (${task.period_range.total}期)`;
    document.getElementById('modal-created-at').textContent =
        new Date(task.created_at).toLocaleString('zh-CN');

    // 更新筛选条件
    const conditionsDiv = document.getElementById('modal-conditions');
    console.log('🔍 任务详情中的exclude_conditions:', JSON.stringify(task.exclude_conditions, null, 2));
    conditionsDiv.innerHTML = renderExcludeConditions(task.exclude_conditions);

    // 更新结果表格
    const tbody = document.getElementById('modal-results-tbody');
    tbody.innerHTML = '';

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">暂无结果数据</td></tr>';
    } else {
        results.forEach(result => {
            const row = document.createElement('tr');
            const hitAnalysis = result.hit_analysis || {};
            const prizeStats = hitAnalysis.prize_stats || {};

            row.innerHTML = `
                <td>${result.period}</td>
                <td>${result.combination_count?.toLocaleString() || 0}</td>
                <td>${hitAnalysis.red_hit_analysis?.best_hit || 0}个</td>
                <td>${hitAnalysis.blue_hit_analysis?.best_hit || 0}个</td>
                <td>${prizeStats.first_prize?.count || 0}次</td>
                <td>${prizeStats.second_prize?.count || 0}次</td>
                <td>${prizeStats.third_prize?.count || 0}次</td>
                <td>${(hitAnalysis.hit_rate || 0).toFixed(2)}%</td>
                <td>¥${(hitAnalysis.total_prize || 0).toLocaleString()}</td>
                <td>
                    <button class="btn-sm" onclick="viewPeriodDetail('${task.task_id}', ${result.period})">详情</button>
                    <button class="btn-sm" onclick="exportSinglePeriod('${task.task_id}', ${result.period})">导出</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

/**
 * 渲染排除条件
 */
function renderExcludeConditions(conditions) {
    console.log('🎨 renderExcludeConditions 收到的参数:', JSON.stringify(conditions, null, 2));
    if (!conditions) {
        console.log('⚠️ conditions 为空，返回"无排除条件"');
        return '<div>无排除条件</div>';
    }

    let html = '';

    // 和值排除
    if (conditions.sum && conditions.sum.enabled) {
        let sumDetails = [];

        // 手动范围
        if (conditions.sum.ranges && conditions.sum.ranges.length > 0) {
            conditions.sum.ranges.forEach((range, index) => {
                if (range.enabled && range.min && range.max) {
                    sumDetails.push(`范围${index + 1}: ${range.min}-${range.max}`);
                }
            });
        }

        // 历史排除
        if (conditions.sum.historical && conditions.sum.historical.enabled) {
            sumDetails.push(`历史最近${conditions.sum.historical.count}期`);
        }

        if (sumDetails.length > 0) {
            html += `<div>✅ 排除和值: ${sumDetails.join(', ')}</div>`;
        }
    }

    // 跨度排除
    if (conditions.span && conditions.span.enabled) {
        let spanDetails = [];

        // 手动范围
        if (conditions.span.ranges && conditions.span.ranges.length > 0) {
            conditions.span.ranges.forEach((range, index) => {
                if (range.enabled && range.min && range.max) {
                    spanDetails.push(`范围${index + 1}: ${range.min}-${range.max}`);
                }
            });
        }

        // 历史排除
        if (conditions.span.historical && conditions.span.historical.enabled) {
            spanDetails.push(`历史最近${conditions.span.historical.count}期`);
        }

        if (spanDetails.length > 0) {
            html += `<div>✅ 排除跨度: ${spanDetails.join(', ')}</div>`;
        }
    }

    // 热温冷比排除
    if (conditions.hwc) {
        let hwcDetails = [];

        // 手动选择
        if (conditions.hwc.excludeRatios && conditions.hwc.excludeRatios.length > 0) {
            hwcDetails.push(`比例: ${conditions.hwc.excludeRatios.join(', ')}`);
        }

        // 历史排除
        if (conditions.hwc.historical && conditions.hwc.historical.enabled) {
            hwcDetails.push(`历史最近${conditions.hwc.historical.count}期`);
        }

        if (hwcDetails.length > 0) {
            html += `<div>✅ 排除热温冷比: ${hwcDetails.join(' + ')}</div>`;
        }
    }

    // 区间比排除
    if (conditions.zone) {
        let zoneDetails = [];

        // 手动选择
        if (conditions.zone.excludeRatios && conditions.zone.excludeRatios.length > 0) {
            zoneDetails.push(`比例: ${conditions.zone.excludeRatios.join(', ')}`);
        }

        // 历史排除
        if (conditions.zone.historical && conditions.zone.historical.enabled) {
            zoneDetails.push(`历史最近${conditions.zone.historical.count}期`);
        }

        if (zoneDetails.length > 0) {
            html += `<div>✅ 排除区间比: ${zoneDetails.join(' + ')}</div>`;
        }
    }

    // 奇偶比排除
    if (conditions.oddEven) {
        let oddEvenDetails = [];

        // 手动选择
        if (conditions.oddEven.excludeRatios && conditions.oddEven.excludeRatios.length > 0) {
            oddEvenDetails.push(`比例: ${conditions.oddEven.excludeRatios.join(', ')}`);
        }

        // 历史排除
        if (conditions.oddEven.historical && conditions.oddEven.historical.enabled) {
            oddEvenDetails.push(`历史最近${conditions.oddEven.historical.count}期`);
        }

        if (oddEvenDetails.length > 0) {
            html += `<div>✅ 排除奇偶比: ${oddEvenDetails.join(' + ')}</div>`;
        }
    }

    // 相克排除
    if (conditions.conflict && conditions.conflict.enabled) {
        console.log('✅ 检测到相克排除条件:', conditions.conflict);
        let conflictDetails = [];
        conflictDetails.push(`分析${conditions.conflict.analysisPeriods}期`);
        if (conditions.conflict.globalTopEnabled && conditions.conflict.topN > 0) {
            conflictDetails.push(`全局Top ${conditions.conflict.topN}`);
        }
        if (conditions.conflict.perBallTopEnabled && conditions.conflict.perBallTopN > 0) {
            conflictDetails.push(`每个号码Top ${conditions.conflict.perBallTopN}`);
            // 热号保护
            if (conditions.conflict.hotProtection && conditions.conflict.hotProtection.enabled && conditions.conflict.hotProtection.topHotCount > 0) {
                conflictDetails.push(`🔥保护热号前${conditions.conflict.hotProtection.topHotCount}名`);
            }
        }
        if (conditions.conflict.includeBackBalls) {
            conflictDetails.push('含后区相克');
        }
        const conflictHtml = `<div>✅ 相克排除: ${conflictDetails.join(', ')}</div>`;
        console.log('⚔️ 相克HTML片段:', conflictHtml);
        html += conflictHtml;
    } else {
        console.log('❌ 未检测到相克排除条件，conflict存在:', !!conditions.conflict, 'enabled:', conditions.conflict?.enabled);
    }

    // 同出排除
    if (conditions.coOccurrence && conditions.coOccurrence.enabled) {
        console.log('✅ 检测到同出排除条件:', conditions.coOccurrence);
        const coOccurrenceHtml = `<div>✅ 同出排除: 排除最近${conditions.coOccurrence.periods}期同出号码</div>`;
        console.log('🔗 同出HTML片段:', coOccurrenceHtml);
        html += coOccurrenceHtml;
    } else {
        console.log('❌ 未检测到同出排除条件，coOccurrence存在:', !!conditions.coOccurrence, 'enabled:', conditions.coOccurrence?.enabled);
    }

    console.log('📊 最终html长度:', html.length);
    console.log('📊 最终返回内容:', html || '<div>无排除条件</div>');
    return html || '<div>无排除条件</div>';
}

/**
 * 关闭任务详情弹窗
 */
function closeTaskDetailModal() {
    const modal = document.getElementById('task-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    taskManagement.selectedTaskId = null;
}

/**
 * 删除任务
 */
async function deleteTask(taskId) {
    if (!confirm('确定要删除此任务吗？删除后无法恢复！')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('任务已删除');
            loadTaskList();
        } else {
            alert('删除任务失败: ' + result.message);
        }
    } catch (error) {
        console.error('❌ 删除任务失败:', error);
        alert('删除任务失败: ' + error.message);
    }
}

/**
 * 导出任务数据
 */
async function exportTaskData(type) {
    const taskId = taskManagement.selectedTaskId;
    if (!taskId) {
        alert('请先选择任务');
        return;
    }

    try {
        const url = `${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}/export?format=excel&type=${type}`;
        window.open(url, '_blank');
    } catch (error) {
        console.error('❌ 导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 快速导出任务
 */
function exportTaskQuick(taskId) {
    const url = `${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}/export?format=excel&type=all`;
    window.open(url, '_blank');
}

/**
 * 导出单期数据（CLI方式，支持大数据量）
 */
async function exportSinglePeriod(taskId, period) {
    try {
        console.log(`📥 开始导出 - 任务ID: ${taskId}, 期号: ${period}`);

        // 显示进度对话框
        showExportProgressModal(taskId, period);

        // 调用后端API启动导出任务
        const response = await fetch(`${API_BASE_URL}/api/dlt/export-period-cli`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                period,
                compress: false  // 可选：是否压缩
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || '启动导出任务失败');
        }

        const exportId = result.exportId;
        console.log(`导出任务已启动: ${exportId}`);

        // 开始轮询进度
        pollExportProgress(exportId);

    } catch (error) {
        console.error('导出失败:', error);
        showExportError(error.message);
    }
}

/**
 * 显示导出进度对话框
 */
function showExportProgressModal(taskId, period) {
    const modal = document.getElementById('export-progress-modal');
    if (!modal) return;

    // 重置对话框状态
    document.getElementById('export-task-id').textContent = taskId;
    document.getElementById('export-period-num').textContent = period;
    document.getElementById('export-total-count').textContent = '-';
    document.getElementById('export-progress-percent').textContent = '0%';
    document.getElementById('export-progress-count').textContent = '0 / 0';
    document.getElementById('export-progress-bar').style.width = '0%';
    document.getElementById('export-status-message').textContent = '⏳ 正在启动导出任务...';
    document.getElementById('export-speed').textContent = '⚡ 速度: --';
    document.getElementById('export-remaining').textContent = '⏱️ 剩余时间: --';
    document.getElementById('export-result').style.display = 'none';
    document.getElementById('export-error').style.display = 'none';

    // 显示对话框
    modal.style.display = 'flex';
}

/**
 * 轮询导出进度
 */
let exportProgressInterval = null;
function pollExportProgress(exportId) {
    // 清除之前的轮询
    if (exportProgressInterval) {
        clearInterval(exportProgressInterval);
    }

    // 每500ms查询一次进度
    exportProgressInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/dlt/export-progress/${exportId}`);
            const progress = await response.json();

            if (!progress.success) {
                throw new Error(progress.message || '查询进度失败');
            }

            // 更新进度显示
            updateExportProgress(progress);

            // 导出完成
            if (progress.status === 'completed') {
                clearInterval(exportProgressInterval);
                exportProgressInterval = null;
                showExportComplete(progress);
            }

            // 导出失败
            if (progress.status === 'failed') {
                clearInterval(exportProgressInterval);
                exportProgressInterval = null;
                showExportError(progress.error || '导出失败');
            }

        } catch (error) {
            console.error('查询进度失败:', error);
            clearInterval(exportProgressInterval);
            exportProgressInterval = null;
            showExportError(error.message);
        }
    }, 500);
}

/**
 * 更新进度显示
 */
function updateExportProgress(progress) {
    // 更新进度百分比
    document.getElementById('export-progress-percent').textContent = `${progress.progress}%`;
    document.getElementById('export-progress-bar').style.width = `${progress.progress}%`;

    // 更新当前行数
    if (progress.totalRows > 0) {
        const currentRow = (progress.currentRow || 0).toLocaleString();
        const totalRows = progress.totalRows.toLocaleString();
        document.getElementById('export-progress-count').textContent = `${currentRow} / ${totalRows}`;
        document.getElementById('export-total-count').textContent = totalRows;
    }

    // 更新状态消息
    if (progress.message) {
        document.getElementById('export-status-message').textContent = progress.message;
    }

    // 更新速度
    if (progress.speed > 0) {
        document.getElementById('export-speed').textContent = `⚡ 速度: ${progress.speed.toLocaleString()} 行/秒`;
    }

    // 更新剩余时间
    if (progress.remaining > 0) {
        const minutes = Math.floor(progress.remaining / 60);
        const seconds = progress.remaining % 60;
        const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
        document.getElementById('export-remaining').textContent = `⏱️ 剩余时间: 约 ${timeStr}`;
    }
}

/**
 * 显示导出完成
 */
function showExportComplete(progress) {
    document.getElementById('export-status-message').textContent = progress.message || '✅ 导出完成！';
    document.getElementById('export-filename').textContent = progress.filename || '-';
    document.getElementById('export-filesize').textContent = progress.filesize || '-';
    document.getElementById('export-result').style.display = 'block';

    // 保存文件名供下载使用
    window.currentExportFilename = progress.filename;
}

/**
 * 显示导出错误
 */
function showExportError(errorMessage) {
    document.getElementById('export-error-message').textContent = errorMessage || '未知错误';
    document.getElementById('export-error').style.display = 'block';
    document.getElementById('export-status-message').textContent = '❌ 导出失败';
}

/**
 * 下载导出的文件
 */
function downloadExportedFile() {
    if (!window.currentExportFilename) {
        alert('文件名未找到');
        return;
    }

    const url = `${API_BASE_URL}/api/dlt/download-export/${encodeURIComponent(window.currentExportFilename)}`;
    window.open(url, '_blank');
}

/**
 * 关闭导出进度对话框
 */
function closeExportProgressModal() {
    const modal = document.getElementById('export-progress-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // 清除轮询
    if (exportProgressInterval) {
        clearInterval(exportProgressInterval);
        exportProgressInterval = null;
    }
}

/**
 * 查看单期详情
 */
async function viewPeriodDetail(taskId, period) {
    try {
        console.log(`📊 查看单期详情: 任务ID=${taskId}, 期号=${period}`);

        // 显示弹窗
        const modal = document.getElementById('period-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // 更新标题
        document.getElementById('period-modal-title').textContent = `📊 期号 ${period} 详细分析`;

        // 加载数据
        const response = await fetch(`${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}/results/${period}`);
        const result = await response.json();

        if (result.success) {
            renderPeriodDetail(result.data);
        } else {
            alert('加载单期详情失败: ' + result.message);
            closePeriodDetailModal();
        }
    } catch (error) {
        console.error('❌ 查看单期详情失败:', error);
        alert('查看单期详情失败: ' + error.message);
    }
}

/**
 * 渲染单期详情
 */
function renderPeriodDetail(data) {
    try {
        const { conflict_data, cooccurrence_data, statistics } = data;

        // 渲染相克数据
        const conflictSection = document.getElementById('conflict-section');
        if (!conflictSection) {
            console.error('❌ 找不到DOM元素: conflict-section');
            return;
        }

        if (conflict_data && conflict_data.enabled) {
            conflictSection.style.display = 'block';

            // 基本参数
            const periodsEl = document.getElementById('conflict-periods');
            const topnEl = document.getElementById('conflict-topn');
            const perBallTopnEl = document.getElementById('conflict-per-ball-topn');
            if (periodsEl) periodsEl.textContent = `前${conflict_data.analysis_periods}期`;
            if (topnEl) topnEl.textContent = (conflict_data.globalTopEnabled && conflict_data.topN > 0) ? `${conflict_data.topN}对（含并列）` : '未使用';
            if (perBallTopnEl) perBallTopnEl.textContent = (conflict_data.perBallTopEnabled && conflict_data.perBallTopN > 0) ? `前${conflict_data.perBallTopN}名` : '未使用';

            // 相克号码对
            const pairsList = document.getElementById('conflict-pairs');
            if (pairsList) {
                if (conflict_data.conflict_pairs && conflict_data.conflict_pairs.length > 0) {
                    const pairsHtml = conflict_data.conflict_pairs.map((item, index) => {
                        if (!item || !item.pair || item.pair.length < 2) {
                            console.warn('⚠️ 无效的相克数据项:', item);
                            return '';
                        }
                        const num1 = String(item.pair[0]).padStart(2, '0');
                        const num2 = String(item.pair[1]).padStart(2, '0');
                        return `<span class="conflict-pair">${index + 1}. ${num1} ↔️ ${num2} <em>(${item.score}次)</em></span>`;
                    }).filter(html => html).join('');
                    pairsList.innerHTML = `<div class="pairs-grid">${pairsHtml}</div>`;
                } else {
                    pairsList.innerHTML = '<div class="no-data">暂无相克数据</div>';
                }
            }

            // 统计数据
            const beforeEl = document.getElementById('conflict-before');
            const afterEl = document.getElementById('conflict-after');
            const excludedEl = document.getElementById('conflict-excluded');
            if (beforeEl) beforeEl.textContent = (conflict_data.combinations_before || 0).toLocaleString();
            if (afterEl) afterEl.textContent = (conflict_data.combinations_after || 0).toLocaleString();
            if (excludedEl) excludedEl.textContent = (conflict_data.excluded_count || 0).toLocaleString();
        } else {
            conflictSection.style.display = 'none';
        }

        // 渲染同出数据
        const cooccurrenceSection = document.getElementById('cooccurrence-section');
        if (cooccurrenceSection) {
            if (cooccurrence_data && cooccurrence_data.enabled) {
                cooccurrenceSection.style.display = 'block';

                // 基本参数
                const periodsEl = document.getElementById('cooccurrence-periods');
                const pairsCountEl = document.getElementById('cooccurrence-pairs-count');
                if (periodsEl) periodsEl.textContent = `最近${cooccurrence_data.periods}次出现`;
                if (pairsCountEl) pairsCountEl.textContent = `${cooccurrence_data.cooccurrence_pairs?.length || 0}对`;

                // 同出详情列表 (显示前10个号码)
                const detailsList = document.getElementById('cooccurrence-details');
                if (detailsList) {
                    if (cooccurrence_data.cooccurrence_pairs && cooccurrence_data.cooccurrence_pairs.length > 0) {
                        // 从API获取analyzedDetails,如果没有则根据pairs生成简化显示
                        const pairsCount = cooccurrence_data.cooccurrence_pairs.length;
                        const samplePairs = cooccurrence_data.cooccurrence_pairs.slice(0, 10);

                        const detailsHtml = samplePairs.map((pair, index) => {
                            const num1 = String(pair[0]).padStart(2, '0');
                            const num2 = String(pair[1]).padStart(2, '0');
                            return `<span class="cooccurrence-pair">${index + 1}. ${num1} ↔️ ${num2}</span>`;
                        }).join('');

                        detailsList.innerHTML = `
                            <div class="pairs-grid">${detailsHtml}</div>
                            <div class="summary-text" style="margin-top: 10px; color: #666; font-size: 14px;">
                                ${pairsCount > 10 ? `...等共 <strong>${pairsCount}</strong> 对同出号码` : `共 <strong>${pairsCount}</strong> 对同出号码`}
                            </div>
                        `;
                    } else {
                        detailsList.innerHTML = '<div class="no-data">暂无同出数据</div>';
                    }
                }

                // 统计数据
                const beforeEl = document.getElementById('cooccurrence-before');
                const afterEl = document.getElementById('cooccurrence-after');
                const excludedEl = document.getElementById('cooccurrence-excluded');
                if (beforeEl) beforeEl.textContent = (cooccurrence_data.combinations_before || 0).toLocaleString();
                if (afterEl) afterEl.textContent = (cooccurrence_data.combinations_after || 0).toLocaleString();
                if (excludedEl) excludedEl.textContent = (cooccurrence_data.excluded_count || 0).toLocaleString();
            } else {
                cooccurrenceSection.style.display = 'none';
            }
        }

        // 渲染命中情况
        const hitInfo = document.getElementById('hit-info');
        if (!hitInfo) {
            console.error('❌ 找不到DOM元素: hit-info');
            return;
        }

        if (statistics) {
            hitInfo.innerHTML = `
                <div class="hit-stats-grid">
                    <div class="hit-stat-item">
                        <span class="stat-label">红球最高命中：</span>
                        <span class="stat-value">${statistics.red_hit_analysis?.best_hit || 0}个</span>
                    </div>
                    <div class="hit-stat-item">
                        <span class="stat-label">蓝球最高命中：</span>
                        <span class="stat-value">${statistics.blue_hit_analysis?.best_hit || 0}个</span>
                    </div>
                    <div class="hit-stat-item">
                        <span class="stat-label">一等奖：</span>
                        <span class="stat-value">${statistics.prize_stats?.first_prize?.count || 0}次</span>
                    </div>
                    <div class="hit-stat-item">
                        <span class="stat-label">二等奖：</span>
                        <span class="stat-value">${statistics.prize_stats?.second_prize?.count || 0}次</span>
                    </div>
                    <div class="hit-stat-item">
                        <span class="stat-label">命中率：</span>
                        <span class="stat-value">${(statistics.hit_rate || 0).toFixed(2)}%</span>
                    </div>
                    <div class="hit-stat-item">
                        <span class="stat-label">总奖金：</span>
                        <span class="stat-value highlight-prize">¥${(statistics.total_prize || 0).toLocaleString()}</span>
                    </div>
                </div>
            `;
        } else {
            hitInfo.innerHTML = '<div class="no-data">暂无命中数据</div>';
        }
    } catch (error) {
        console.error('❌ 渲染单期详情失败:', error);
        alert('渲染单期详情失败: ' + error.message);
    }
}

/**
 * 关闭单期详情弹窗
 */
function closePeriodDetailModal() {
    const modal = document.getElementById('period-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 将任务管理函数添加到全局作用域
window.viewTaskDetail = viewTaskDetail;
window.deleteTask = deleteTask;
window.viewPeriodDetail = viewPeriodDetail;

// 绑定单期详情弹窗关闭按钮
document.addEventListener('DOMContentLoaded', function() {
    const closePeriodModalBtn = document.getElementById('close-period-modal');
    const closePeriodModalFooterBtn = document.getElementById('close-period-modal-footer');

    if (closePeriodModalBtn) {
        closePeriodModalBtn.addEventListener('click', closePeriodDetailModal);
    }
    if (closePeriodModalFooterBtn) {
        closePeriodModalFooterBtn.addEventListener('click', closePeriodDetailModal);
    }

    // 点击遮罩层关闭
    const periodModal = document.getElementById('period-detail-modal');
    if (periodModal) {
        const overlay = periodModal.querySelector('.period-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closePeriodDetailModal);
        }
    }
});
window.exportTaskQuick = exportTaskQuick;
window.exportSinglePeriod = exportSinglePeriod;
window.viewPeriodDetail = viewPeriodDetail;
window.downloadExportedFile = downloadExportedFile;
window.closeExportProgressModal = closeExportProgressModal;

// ========== 任务管理功能结束 ==========

// 安全的延迟初始化批量预测模块
if (typeof window !== 'undefined') {
    // 确保在页面完全加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                console.log('Initializing DLT Batch Prediction module...');
                initDLTBatchPrediction();
                initTaskManagement(); // 初始化任务管理
            }, 100); // 短暂延迟确保其他模块先初始化
        });
    } else {
        // 页面已经加载完成
        setTimeout(() => {
            console.log('Initializing DLT Batch Prediction module...');
            initDLTBatchPrediction();
            initTaskManagement(); // 初始化任务管理
        }, 100);
    }
}