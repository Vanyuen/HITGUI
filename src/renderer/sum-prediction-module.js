/**
 * 和值预测批量验证 - 前端模块
 * 创建日期: 2025-12-07
 */

(function() {
    'use strict';

    const API_BASE = 'http://localhost:3003';

    // ========== 辅助函数：格式化预测显示 ==========
    function formatPredictionDisplay(pred) {
        if (!pred) return '-';

        // 历史和值集方法：显示集合信息
        if (pred.sum_set && pred.sum_set.length > 0) {
            const setCount = pred.set_count || pred.sum_set.length;
            const rangeExpand = pred.range_expand || 0;
            const expandText = rangeExpand > 0 ? ` ±${rangeExpand}` : '';

            // 如果集合较小，显示全部；否则显示摘要
            if (pred.sum_set.length <= 5) {
                return `{${pred.sum_set.join(',')}}${expandText}`;
            } else {
                return `集合[${setCount}]${expandText} (${pred.set_min}-${pred.set_max})`;
            }
        }

        // 其他方法：显示范围
        if (pred.range_min !== null && pred.range_max !== null) {
            return `${pred.range_min}-${pred.range_max} (${pred.recommended || '-'})`;
        }

        return pred.recommended ? `(${pred.recommended})` : '-';
    }

    // ========== 初始化 ==========
    function initSumPredictionModule() {
        console.log('📊 初始化和值预测批量验证模块...');

        // 训练窗口按钮事件
        initTrainingWindowButtons();

        // 前区方法切换
        initFrontMethodSwitch();

        // 后区方法切换
        initBackMethodSwitch();

        // 技术分析开关
        initTechAnalysisToggle();

        // 创建任务按钮
        const createBtn = document.getElementById('sum-pred-create-task-btn');
        if (createBtn) {
            createBtn.addEventListener('click', createSumPredictionTask);
        }

        // 自动寻优按钮
        const optimizeBtn = document.getElementById('sum-pred-auto-optimize-btn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', runAutoOptimization);
        }

        // 刷新任务列表按钮
        const refreshBtn = document.getElementById('sum-pred-refresh-tasks-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadSumPredictionTasks);
        }

        // 关闭详情弹窗
        const closeDetailBtn = document.getElementById('sum-pred-close-detail-btn');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', closeTaskDetailModal);
        }

        // 关闭寻优弹窗
        const closeOptimizeBtn = document.getElementById('sum-pred-close-optimize-btn');
        if (closeOptimizeBtn) {
            closeOptimizeBtn.addEventListener('click', closeOptimizeModal);
        }

        // 初始化Socket事件监听
        initSocketListeners();

        // 加载任务列表
        loadSumPredictionTasks();

        console.log('✅ 和值预测批量验证模块初始化完成');
    }

    // ========== 训练窗口按钮 ==========
    function initTrainingWindowButtons() {
        const buttons = document.querySelectorAll('.sum-pred-window-btn');
        const customInput = document.getElementById('sum-pred-custom-window');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => {
                    b.style.border = '1px solid #ced4da';
                    b.style.background = '#fff';
                    b.classList.remove('active');
                });
                btn.style.border = '2px solid #007bff';
                btn.style.background = '#e7f1ff';
                btn.classList.add('active');
                if (customInput) customInput.value = '';
            });
        });

        if (customInput) {
            customInput.addEventListener('input', () => {
                if (customInput.value) {
                    buttons.forEach(b => {
                        b.style.border = '1px solid #ced4da';
                        b.style.background = '#fff';
                        b.classList.remove('active');
                    });
                }
            });
        }
    }

    // ========== 前区方法切换 ==========
    function initFrontMethodSwitch() {
        const methodRadios = document.querySelectorAll('input[name="sum-pred-front-method"]');
        const maParams = document.getElementById('sum-pred-front-ma-params');
        const fixedParams = document.getElementById('sum-pred-front-fixed-params');
        const historyParams = document.getElementById('sum-pred-front-history-params');

        methodRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const method = radio.value;
                // 隐藏所有参数面板
                if (maParams) maParams.style.display = 'none';
                if (fixedParams) fixedParams.style.display = 'none';
                if (historyParams) historyParams.style.display = 'none';

                // 显示对应参数面板
                if (method === 'ma' || method === 'weighted_ma' || method === 'regression') {
                    if (maParams) maParams.style.display = 'flex';
                } else if (method === 'fixed_range') {
                    if (fixedParams) fixedParams.style.display = 'flex';
                } else if (method === 'history_set') {
                    if (historyParams) historyParams.style.display = 'flex';
                }
            });
        });
    }

    // ========== 后区方法切换 ==========
    function initBackMethodSwitch() {
        const methodRadios = document.querySelectorAll('input[name="sum-pred-back-method"]');
        const maParams = document.getElementById('sum-pred-back-ma-params');
        const fixedParams = document.getElementById('sum-pred-back-fixed-params');
        const historyParams = document.getElementById('sum-pred-back-history-params');

        methodRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const method = radio.value;
                if (maParams) maParams.style.display = 'none';
                if (fixedParams) fixedParams.style.display = 'none';
                if (historyParams) historyParams.style.display = 'none';

                if (method === 'ma' || method === 'weighted_ma' || method === 'regression') {
                    if (maParams) maParams.style.display = 'flex';
                } else if (method === 'fixed_range') {
                    if (fixedParams) fixedParams.style.display = 'flex';
                } else if (method === 'history_set') {
                    if (historyParams) historyParams.style.display = 'flex';
                }
            });
        });
    }

    // ========== 技术分析开关 ==========
    function initTechAnalysisToggle() {
        const techEnabled = document.getElementById('sum-pred-tech-enabled');
        const techParams = document.getElementById('sum-pred-tech-params');

        if (techEnabled && techParams) {
            techEnabled.addEventListener('change', () => {
                techParams.style.display = techEnabled.checked ? 'block' : 'none';
            });
        }
    }

    // ========== 获取配置参数 ==========
    function getConfigParams() {
        // 期号范围
        const rangeType = document.querySelector('input[name="sum-pred-range-type"]:checked')?.value || 'recent';
        const recentCount = parseInt(document.getElementById('sum-pred-recent-count')?.value) || 100;
        const startIssue = document.getElementById('sum-pred-start-issue')?.value;
        const endIssue = document.getElementById('sum-pred-end-issue')?.value;

        // 训练窗口
        let trainingWindow = 30;
        const activeWindowBtn = document.querySelector('.sum-pred-window-btn.active');
        if (activeWindowBtn) {
            trainingWindow = parseInt(activeWindowBtn.dataset.window);
        }
        const customWindow = document.getElementById('sum-pred-custom-window')?.value;
        if (customWindow) {
            trainingWindow = parseInt(customWindow);
        }

        // 前区策略
        const frontMethod = document.querySelector('input[name="sum-pred-front-method"]:checked')?.value || 'ma';
        const frontMaPeriod = parseInt(document.getElementById('sum-pred-front-ma-period')?.value) || 20;
        const frontRangeExpand = parseInt(document.getElementById('sum-pred-front-range-expand')?.value) || 10;
        const frontFixedMin = parseInt(document.getElementById('sum-pred-front-fixed-min')?.value);
        const frontFixedMax = parseInt(document.getElementById('sum-pred-front-fixed-max')?.value);
        const frontHistoryMode = document.getElementById('sum-pred-front-history-mode')?.value || 'range';
        const frontHistoryExpand = parseInt(document.getElementById('sum-pred-front-history-expand')?.value) || 0;

        // 后区策略
        const backMethod = document.querySelector('input[name="sum-pred-back-method"]:checked')?.value || 'ma';
        const backMaPeriod = parseInt(document.getElementById('sum-pred-back-ma-period')?.value) || 10;
        const backRangeExpand = parseInt(document.getElementById('sum-pred-back-range-expand')?.value) || 3;
        const backFixedMin = parseInt(document.getElementById('sum-pred-back-fixed-min')?.value);
        const backFixedMax = parseInt(document.getElementById('sum-pred-back-fixed-max')?.value);
        const backHistoryMode = document.getElementById('sum-pred-back-history-mode')?.value || 'range';
        const backHistoryExpand = parseInt(document.getElementById('sum-pred-back-history-expand')?.value) || 0;

        // 技术分析
        const techEnabled = document.getElementById('sum-pred-tech-enabled')?.checked || false;
        const rsiEnabled = document.getElementById('sum-pred-rsi-enabled')?.checked || false;
        const macdEnabled = document.getElementById('sum-pred-macd-enabled')?.checked || false;
        const bollingerEnabled = document.getElementById('sum-pred-bollinger-enabled')?.checked || false;

        return {
            period_range: {
                type: rangeType,
                recent_count: recentCount,
                start_issue: startIssue,
                end_issue: endIssue
            },
            training_window: trainingWindow,
            front_strategy: {
                method: frontMethod,
                ma_period: frontMaPeriod,
                range_expand: frontRangeExpand,
                fixed_range: frontMethod === 'fixed_range' ? { min: frontFixedMin, max: frontFixedMax } : undefined,
                history_set: frontMethod === 'history_set' ? { match_mode: frontHistoryMode, range_expand: frontHistoryExpand } : undefined
            },
            back_strategy: {
                method: backMethod,
                ma_period: backMaPeriod,
                range_expand: backRangeExpand,
                fixed_range: backMethod === 'fixed_range' ? { min: backFixedMin, max: backFixedMax } : undefined,
                history_set: backMethod === 'history_set' ? { match_mode: backHistoryMode, range_expand: backHistoryExpand } : undefined
            },
            technical_analysis: {
                enabled: techEnabled,
                rsi: { enabled: rsiEnabled, period: 14, overbought: 70, oversold: 30 },
                macd: { enabled: macdEnabled, fast_period: 12, slow_period: 26, signal_period: 9 },
                bollinger: { enabled: bollingerEnabled, period: 20, std_dev: 2 }
            }
        };
    }

    // ========== 创建任务 ==========
    async function createSumPredictionTask() {
        const config = getConfigParams();
        const taskName = generateTaskName(config);

        const btn = document.getElementById('sum-pred-create-task-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ 创建中...';
        }

        try {
            const response = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_name: taskName,
                    ...config
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ 任务创建成功:', result.data);
                alert(`任务创建成功！\n任务ID: ${result.data.task_id}\n期数: ${result.data.period_range.total_periods}`);
                loadSumPredictionTasks();
            } else {
                throw new Error(result.message || '创建失败');
            }
        } catch (error) {
            console.error('❌ 创建任务失败:', error);
            alert('创建任务失败: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🚀 创建验证任务';
            }
        }
    }

    // ========== 生成任务名称 ==========
    function generateTaskName(config) {
        const frontMethod = config.front_strategy.method;
        const maPeriod = config.front_strategy.ma_period;
        const rangeExpand = config.front_strategy.range_expand;
        const rangeType = config.period_range.type;
        const count = config.period_range.recent_count;

        let methodName = {
            'ma': 'MA',
            'weighted_ma': '加权MA',
            'regression': '线性回归',
            'fixed_range': '固定范围',
            'history_set': '历史集'
        }[frontMethod] || frontMethod;

        let rangeName = rangeType === 'recent' ? `最近${count}期` :
                        rangeType === 'all' ? '全部历史' : '自定义范围';

        if (frontMethod === 'ma' || frontMethod === 'weighted_ma' || frontMethod === 'regression') {
            return `${methodName}${maPeriod}±${rangeExpand}_${rangeName}`;
        } else {
            return `${methodName}_${rangeName}`;
        }
    }

    // ========== 加载任务列表 ==========
    async function loadSumPredictionTasks() {
        const listContainer = document.getElementById('sum-pred-task-list');
        if (!listContainer) return;

        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">⏳ 加载中...</div>';

        try {
            const response = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/list?page=1&limit=20&status=all`);
            const result = await response.json();

            if (result.success && result.data.tasks.length > 0) {
                renderTaskList(result.data.tasks);
            } else {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: #6c757d; padding: 30px;">
                        <p>🎯 暂无任务</p>
                        <p style="font-size: 13px;">配置参数后点击"创建验证任务"开始</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ 加载任务列表失败:', error);
            listContainer.innerHTML = `<div style="text-align: center; color: #dc3545; padding: 20px;">加载失败: ${error.message}</div>`;
        }
    }

    // ========== 渲染任务列表 ==========
    function renderTaskList(tasks) {
        const listContainer = document.getElementById('sum-pred-task-list');
        if (!listContainer) return;

        const statusMap = {
            'pending': { text: '等待中', color: '#6c757d', icon: '⏸️' },
            'processing': { text: '处理中', color: '#007bff', icon: '⏳' },
            'completed': { text: '已完成', color: '#28a745', icon: '✅' },
            'failed': { text: '失败', color: '#dc3545', icon: '❌' }
        };

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 12px 8px; text-align: left;">任务名称</th>
                        <th style="padding: 12px 8px; text-align: center;">期号范围</th>
                        <th style="padding: 12px 8px; text-align: center;">状态</th>
                        <th style="padding: 12px 8px; text-align: center;">前区命中率</th>
                        <th style="padding: 12px 8px; text-align: center;">后区命中率</th>
                        <th style="padding: 12px 8px; text-align: center;">双区命中率</th>
                        <th style="padding: 12px 8px; text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tasks.forEach(task => {
            const status = statusMap[task.status] || statusMap['pending'];
            const stats = task.summary_stats || {};
            const progress = task.period_range.processed_periods || 0;
            const total = task.period_range.total_periods || 0;

            html += `
                <tr style="border-bottom: 1px solid #dee2e6;" data-task-id="${task.task_id}">
                    <td style="padding: 12px 8px;">
                        <div style="font-weight: 500;">${task.task_name}</div>
                        <div style="font-size: 12px; color: #6c757d;">${task.task_id}</div>
                    </td>
                    <td style="padding: 12px 8px; text-align: center;">
                        ${task.period_range.type === 'recent' ? `最近${task.period_range.recent_count}期` :
                          task.period_range.type === 'all' ? '全部' :
                          `${task.period_range.start_issue}-${task.period_range.end_issue}`}
                    </td>
                    <td style="padding: 12px 8px; text-align: center;">
                        <span style="color: ${status.color};">${status.icon} ${status.text}</span>
                        ${task.status === 'processing' ? `<div style="font-size: 11px; color: #6c757d;">${progress}/${total}</div>` : ''}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 500; color: ${stats.front_hit_rate >= 50 ? '#28a745' : '#dc3545'};">
                        ${task.status === 'completed' ? `${stats.front_hit_rate || 0}%` : '-'}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 500; color: ${stats.back_hit_rate >= 50 ? '#28a745' : '#dc3545'};">
                        ${task.status === 'completed' ? `${stats.back_hit_rate || 0}%` : '-'}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 500; color: ${stats.both_hit_rate >= 30 ? '#28a745' : '#dc3545'};">
                        ${task.status === 'completed' ? `${stats.both_hit_rate || 0}%` : '-'}
                    </td>
                    <td style="padding: 12px 8px; text-align: center;">
                        <button onclick="window.viewSumPredTaskDetail('${task.task_id}')" style="padding: 5px 10px; margin: 2px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📊 详情</button>
                        ${task.status === 'completed' ? `
                            <button onclick="window.exportSumPredTaskExcel('${task.task_id}')" style="padding: 5px 10px; margin: 2px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📥 导出</button>
                        ` : ''}
                        <button onclick="window.deleteSumPredTask('${task.task_id}')" style="padding: 5px 10px; margin: 2px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listContainer.innerHTML = html;
    }

    // ========== 查看任务详情 ==========
    async function viewSumPredTaskDetail(taskId) {
        const modal = document.getElementById('sum-pred-task-detail-modal');
        const titleEl = document.getElementById('sum-pred-detail-title');
        const contentEl = document.getElementById('sum-pred-detail-content');

        if (!modal || !contentEl) return;

        modal.style.display = 'block';
        contentEl.innerHTML = '<div style="text-align: center; padding: 40px;">⏳ 加载中...</div>';

        try {
            // 获取任务详情
            const taskRes = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/${taskId}`);
            const taskResult = await taskRes.json();

            if (!taskResult.success) {
                throw new Error(taskResult.message);
            }

            const task = taskResult.data;

            // 获取结果列表
            const resultsRes = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/${taskId}/results?page=1&limit=50`);
            const resultsResult = await resultsRes.json();

            const results = resultsResult.success ? resultsResult.data.results : [];

            if (titleEl) {
                titleEl.textContent = `📊 ${task.task_name}`;
            }

            // 渲染详情内容
            contentEl.innerHTML = renderTaskDetailContent(task, results);

        } catch (error) {
            console.error('❌ 加载任务详情失败:', error);
            contentEl.innerHTML = `<div style="text-align: center; color: #dc3545; padding: 40px;">加载失败: ${error.message}</div>`;
        }
    }

    // ========== 渲染任务详情内容 ==========
    function renderTaskDetailContent(task, results) {
        const stats = task.summary_stats || {};

        let html = `
            <!-- 统计概览 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #e7f1ff; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #007bff;">${stats.front_hit_rate || 0}%</div>
                    <div style="font-size: 13px; color: #666;">前区命中率</div>
                    <div style="font-size: 12px; color: #999;">${stats.front_hit_count || 0}/${task.period_range.processed_periods || 0}</div>
                </div>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.back_hit_rate || 0}%</div>
                    <div style="font-size: 13px; color: #666;">后区命中率</div>
                    <div style="font-size: 12px; color: #999;">${stats.back_hit_count || 0}/${task.period_range.processed_periods || 0}</div>
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #856404;">${stats.both_hit_rate || 0}%</div>
                    <div style="font-size: 13px; color: #666;">双区命中率</div>
                    <div style="font-size: 12px; color: #999;">${stats.both_hit_count || 0}/${task.period_range.processed_periods || 0}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #495057;">${stats.avg_front_diff || 0}</div>
                    <div style="font-size: 13px; color: #666;">前区平均偏差</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #495057;">${stats.avg_back_diff || 0}</div>
                    <div style="font-size: 13px; color: #666;">后区平均偏差</div>
                </div>
            </div>

            <!-- 配置信息 -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0;">⚙️ 任务配置</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px;">
                    <div><strong>训练窗口:</strong> ${task.training_window}期</div>
                    <div><strong>前区方法:</strong> ${task.front_strategy?.method || 'ma'}</div>
                    <div><strong>前区MA周期:</strong> ${task.front_strategy?.ma_period || 20}期</div>
                    <div><strong>前区范围:</strong> ±${task.front_strategy?.range_expand || 10}</div>
                    <div><strong>后区方法:</strong> ${task.back_strategy?.method || 'ma'}</div>
                    <div><strong>后区MA周期:</strong> ${task.back_strategy?.ma_period || 10}期</div>
                    <div><strong>后区范围:</strong> ±${task.back_strategy?.range_expand || 3}</div>
                    <div><strong>技术分析:</strong> ${task.technical_analysis?.enabled ? '启用' : '关闭'}</div>
                </div>
            </div>

            <!-- 详细结果表格 -->
            <div style="overflow-x: auto;">
                <h4 style="margin: 0 0 10px 0;">📋 详细验证结果 (最近50期)</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 800px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; border: 1px solid #dee2e6;">期号</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">训练范围</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">前区预测</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">前区实际</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">前区</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">后区预测</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">后区实际</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6;">后区</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        results.forEach(r => {
            const frontPred = r.prediction?.front_sum || {};
            const backPred = r.prediction?.back_sum || {};
            const validation = r.validation || {};

            html += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${r.period}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-size: 12px;">${r.training_info?.start_issue || '-'}-${r.training_info?.end_issue || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-size: 12px;">${formatPredictionDisplay(frontPred)}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: 500;">${r.actual?.front_sum || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
                        ${validation.front_hit ? '<span style="color: #28a745;">✓</span>' : '<span style="color: #dc3545;">✗</span>'}
                        ${validation.front_range_position === 'above' ? '↑' : validation.front_range_position === 'below' ? '↓' : ''}
                    </td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-size: 12px;">${formatPredictionDisplay(backPred)}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: 500;">${r.actual?.back_sum || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
                        ${validation.back_hit ? '<span style="color: #28a745;">✓</span>' : '<span style="color: #dc3545;">✗</span>'}
                        ${validation.back_range_position === 'above' ? '↑' : validation.back_range_position === 'below' ? '↓' : ''}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        return html;
    }

    // ========== 关闭详情弹窗 ==========
    function closeTaskDetailModal() {
        const modal = document.getElementById('sum-pred-task-detail-modal');
        if (modal) modal.style.display = 'none';
    }

    // ========== 导出Excel ==========
    function exportSumPredTaskExcel(taskId) {
        window.open(`${API_BASE}/api/dlt/sum-prediction-tasks/${taskId}/export`, '_blank');
    }

    // ========== 删除任务 ==========
    async function deleteSumPredTask(taskId) {
        if (!confirm(`确定要删除任务 ${taskId} 吗？`)) return;

        try {
            const response = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/${taskId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                alert('删除成功');
                loadSumPredictionTasks();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ 删除任务失败:', error);
            alert('删除失败: ' + error.message);
        }
    }

    // ========== 自动寻优 ==========
    async function runAutoOptimization() {
        const config = getConfigParams();

        const btn = document.getElementById('sum-pred-auto-optimize-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ 寻优中...';
        }

        try {
            const response = await fetch(`${API_BASE}/api/dlt/sum-prediction-tasks/auto-optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_range: config.period_range,
                    optimize_target: 'front_hit_rate',
                    parameter_ranges: {
                        methods: ['ma', 'weighted_ma', 'regression', 'history_set'],
                        ma_periods: [10, 15, 20, 30],
                        range_expands: [8, 10, 12, 15],
                        training_windows: [30]
                    },
                    top_n: 10
                })
            });

            const result = await response.json();

            if (result.success) {
                showOptimizeResults(result.data.results);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ 自动寻优失败:', error);
            alert('自动寻优失败: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🔍 自动寻优';
            }
        }
    }

    // ========== 显示寻优结果 ==========
    function showOptimizeResults(results) {
        const modal = document.getElementById('sum-pred-optimize-modal');
        const contentEl = document.getElementById('sum-pred-optimize-content');

        if (!modal || !contentEl) return;

        modal.style.display = 'block';

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; border: 1px solid #dee2e6;">排名</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">方法</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">MA周期</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">范围扩展</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">前区命中率</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">后区命中率</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">双区命中率</th>
                        <th style="padding: 12px; border: 1px solid #dee2e6;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach((r, i) => {
            const methodName = {
                'ma': 'MA均线',
                'weighted_ma': '加权MA',
                'regression': '线性回归',
                'history_set': '历史集'
            }[r.method] || r.method;

            html += `
                <tr style="${i === 0 ? 'background: #fff3cd;' : ''}">
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-weight: bold;">${i + 1}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${methodName}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${r.ma_period || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">±${r.range_expand}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-weight: bold; color: #28a745;">${r.front_hit_rate}%</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${r.back_hit_rate}%</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${r.both_hit_rate}%</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">
                        <button onclick="window.applyOptimizeConfig('${r.method}', ${r.ma_period || 20}, ${r.range_expand})" style="padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">应用</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        contentEl.innerHTML = html;
    }

    // ========== 应用寻优配置 ==========
    function applyOptimizeConfig(method, maPeriod, rangeExpand) {
        // 设置前区方法
        const methodRadio = document.querySelector(`input[name="sum-pred-front-method"][value="${method}"]`);
        if (methodRadio) {
            methodRadio.checked = true;
            methodRadio.dispatchEvent(new Event('change'));
        }

        // 设置MA周期
        const maPeriodSelect = document.getElementById('sum-pred-front-ma-period');
        if (maPeriodSelect) {
            maPeriodSelect.value = maPeriod;
        }

        // 设置范围扩展
        const rangeExpandSelect = document.getElementById('sum-pred-front-range-expand');
        if (rangeExpandSelect) {
            rangeExpandSelect.value = rangeExpand;
        }

        closeOptimizeModal();
        alert(`已应用配置: ${method} MA${maPeriod} ±${rangeExpand}`);
    }

    // ========== 关闭寻优弹窗 ==========
    function closeOptimizeModal() {
        const modal = document.getElementById('sum-pred-optimize-modal');
        if (modal) modal.style.display = 'none';
    }

    // ========== Socket事件监听 ==========
    function initSocketListeners() {
        if (typeof io === 'undefined') {
            console.warn('⚠️ Socket.IO 未加载，跳过事件监听');
            return;
        }

        const socket = io(API_BASE);

        socket.on('connect', () => {
            console.log('🔌 和值预测模块 Socket连接成功');
        });

        socket.on('sum-task-progress', (data) => {
            console.log('📊 任务进度:', data);
            updateTaskProgress(data);
        });

        socket.on('sum-task-completed', (data) => {
            console.log('✅ 任务完成:', data);
            loadSumPredictionTasks();
        });

        socket.on('sum-task-error', (data) => {
            console.error('❌ 任务错误:', data);
            loadSumPredictionTasks();
        });
    }

    // ========== 更新任务进度 ==========
    function updateTaskProgress(data) {
        const row = document.querySelector(`tr[data-task-id="${data.task_id}"]`);
        if (row) {
            const statusCell = row.querySelector('td:nth-child(3)');
            if (statusCell) {
                statusCell.innerHTML = `
                    <span style="color: #007bff;">⏳ 处理中</span>
                    <div style="font-size: 11px; color: #6c757d;">${data.current}/${data.total} (${data.percent}%)</div>
                `;
            }
        }
    }

    // ========== 导出全局函数 ==========
    window.initSumPredictionModule = initSumPredictionModule;
    window.viewSumPredTaskDetail = viewSumPredTaskDetail;
    window.exportSumPredTaskExcel = exportSumPredTaskExcel;
    window.deleteSumPredTask = deleteSumPredTask;
    window.applyOptimizeConfig = applyOptimizeConfig;

    // ========== 自动初始化 ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSumPredictionModule);
    } else {
        // DOM已加载，延迟初始化确保其他脚本加载完成
        setTimeout(initSumPredictionModule, 100);
    }

})();
