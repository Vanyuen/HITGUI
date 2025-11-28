/**
 * 大乐透统计关系分析面板（重构版）
 * 功能：通用统计分析引擎，支持热温冷比、区间比等多维度分析
 */

// ==================== 通用统计分析引擎 ====================

/**
 * 分析类型配置
 */
const ANALYSIS_TYPES = {
    hwc: {
        id: 'hwc',
        name: '热温冷比',
        displayName: '热温冷比分析',
        filterField: 'statistics.frontHotWarmColdRatio',
        paramName: 'hwcRatios',
        checkboxClass: 'hwc-ratio-checkbox',
        panelId: 'hwc-analysis-panel',
        resultPanelId: 'stats-result-panel',
        rangeInputName: 'stats-range',
        customInputsClass: 'custom-range-inputs',
        startIssueId: 'stats-start-issue',
        endIssueId: 'stats-end-issue',
        recentCountId: 'stats-recent-count',
        analyzeButtonId: 'start-stats-analyze',
        resetButtonId: 'reset-stats-condition',
        quickBtnClass: 'quick-select-btn',
        selectAllClass: 'select-all-btn',
        clearBtnClass: 'clear-select-btn',
        apiEndpoint: '/api/dlt/stats-relation',
        defaultRange: '30',
        quickSelections: {
            hot: ['5:0:0', '4:1:0', '4:0:1', '3:2:0', '3:1:1', '3:0:2'],
            warm: ['0:5:0', '1:4:0', '2:3:0', '0:4:1', '1:3:1'],
            cold: ['0:0:5', '1:0:4', '0:1:4', '2:0:3', '0:2:3', '1:1:3'],
            balanced: ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1', '1:1:3']
        }
    },
    zone: {
        id: 'zone',
        name: '区间比',
        displayName: '区间比分析',
        filterField: 'statistics.frontZoneRatio',
        paramName: 'zoneRatios',
        checkboxClass: 'zone-ratio-checkbox',
        panelId: 'zone-analysis-panel',
        resultPanelId: 'zone-stats-result-panel',
        rangeInputName: 'zone-stats-range',
        customInputsClass: 'zone-custom-range-inputs',
        startIssueId: 'zone-stats-start-issue',
        endIssueId: 'zone-stats-end-issue',
        recentCountId: 'zone-stats-recent-count',
        analyzeButtonId: 'start-zone-stats-analyze',
        resetButtonId: 'reset-zone-stats-condition',
        quickBtnClass: 'zone-quick-btn',
        selectAllClass: 'select-all-btn',
        clearBtnClass: 'zone-clear-btn',
        apiEndpoint: '/api/dlt/zone-ratio-stats-relation',
        defaultRange: 'recent',
        quickSelections: {
            front: ['5:0:0', '4:1:0', '4:0:1', '3:2:0', '3:1:1', '3:0:2'],
            middle: ['0:5:0', '1:4:0', '2:3:0', '0:4:1', '1:3:1'],
            back: ['0:0:5', '1:0:4', '0:1:4', '2:0:3', '0:2:3', '1:1:3'],
            balanced: ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1', '1:1:3']
        }
    }
};

// 存储当前分析结果
const analysisDataCache = {
    hwc: null,
    zone: null
};

/**
 * 通用统计分析执行器
 */
class UniversalStatsAnalyzer {
    constructor(config) {
        this.config = config;
    }

    /**
     * 收集选中的比率
     */
    getSelectedRatios() {
        const checkboxes = document.querySelectorAll(`.${this.config.checkboxClass}:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * 构建API URL
     */
    buildApiUrl() {
        const selectedRatios = this.getSelectedRatios();

        if (selectedRatios.length === 0) {
            throw new Error(`请至少选择一个${this.config.name}`);
        }

        const rangeValue = document.querySelector(`input[name="${this.config.rangeInputName}"]:checked`)?.value;
        let apiUrl = `http://localhost:3003${this.config.apiEndpoint}?`;

        if (rangeValue === 'custom') {
            const startIssue = document.getElementById(this.config.startIssueId).value.trim();
            const endIssue = document.getElementById(this.config.endIssueId).value.trim();

            if (!startIssue || !endIssue) {
                throw new Error('请输入起始期号和结束期号');
            }

            if (!/^\d{5}$/.test(startIssue) || !/^\d{5}$/.test(endIssue)) {
                throw new Error('期号格式不正确，应为5位数字（如：25001）');
            }

            if (startIssue > endIssue) {
                throw new Error('起始期号不能大于结束期号');
            }

            apiUrl += `startIssue=${startIssue}&endIssue=${endIssue}`;
        } else {
            const recentCount = document.getElementById(this.config.recentCountId)?.value;
            const periodsNum = parseInt(recentCount);

            if (isNaN(periodsNum) || periodsNum <= 0) {
                throw new Error('请输入有效的期数（大于0的数字）');
            }

            apiUrl += `periods=${periodsNum}`;
        }

        apiUrl += `&${this.config.paramName}=${selectedRatios.join(',')}`;
        return apiUrl;
    }

    /**
     * 执行分析
     */
    async execute() {
        try {
            const apiUrl = this.buildApiUrl();
            console.log(`${this.config.displayName} API:`, apiUrl);

            this.showLoading();

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            console.log(`${this.config.displayName}结果:`, data);

            // 缓存结果
            analysisDataCache[this.config.id] = data;

            // 显示结果
            this.displayResult(data);

        } catch (error) {
            console.error(`${this.config.displayName}失败:`, error);
            this.showError(error.message);
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const resultPanel = document.getElementById(this.config.resultPanelId);
        resultPanel.style.display = 'block';
        resultPanel.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid #f3f3f3;
                            border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;">
                </div>
                <p style="margin-top: 20px; font-size: 16px; color: #6c757d;">正在分析数据，请稍候...</p>
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
     * 显示错误
     */
    showError(message) {
        const resultPanel = document.getElementById(this.config.resultPanelId);
        resultPanel.style.display = 'block';
        resultPanel.innerHTML = `
            <div class="stats-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h4>分析失败</h4>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * 显示结果
     */
    displayResult(data) {
        const resultPanel = document.getElementById(this.config.resultPanelId);
        resultPanel.style.display = 'block';

        const { totalRecords, matchedRecords, topStats, detailRecords } = data;
        const selectedRatios = this.getSelectedRatios();

        // 如果没有匹配数据
        if (matchedRecords === 0) {
            resultPanel.innerHTML = `
                <div class="stats-empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                    <h4>未找到符合条件的数据</h4>
                    <p>在分析的 <strong>${totalRecords}</strong> 期数据中，没有找到${this.config.name}为
                       <strong style="color: #007bff;">${selectedRatios.join(', ')}</strong> 的开奖记录</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #6c757d;">
                        💡 提示：可以尝试选择其他${this.config.name}，或扩大分析范围（如：最近100期）
                    </p>
                </div>
            `;
            return;
        }

        // 构建结果HTML
        let html = `
            <div class="stats-result-header">
                <h3>📊 ${this.config.displayName}结果</h3>
                <div class="stats-result-summary">
                    分析范围：<strong>${totalRecords}</strong> 期数据 |
                    符合${this.config.name} <strong style="color: #007bff;">${selectedRatios.join(', ')}</strong> 的期数：
                    <strong>${matchedRecords}</strong> 期
                </div>
            </div>

            <div class="stats-top6-grid">
                ${this.generateTop6Cards(topStats)}
            </div>

            <div class="stats-detail-section">
                <h4>📋 详细数据列表</h4>
                <div class="stats-detail-actions">
                    <button class="export-csv-btn" onclick="exportAnalysisToCSV('${this.config.id}')">📥 导出CSV</button>
                </div>
                ${this.generateDetailTable(detailRecords)}
            </div>
        `;

        resultPanel.innerHTML = html;
    }

    /**
     * 生成TOP6卡片
     */
    generateTop6Cards(topStats) {
        const cards = [];

        // 定义字段标题映射
        const titleMap = {
            // 主维度
            'hwcRatio': '热温冷比',
            'zoneRatio': '区间比',

            // 热温冷比组合
            'hwcRatio_frontSum': '热温冷比-和值',
            'hwcRatio_frontSpan': '热温冷比-跨度',
            'hwcRatio_zoneRatio': '热温冷比-区间比',
            'hwcRatio_acValue': '热温冷比-AC值',
            'hwcRatio_oddEvenRatio': '热温冷比-奇偶比',

            // 区间比组合
            'zoneRatio_hwcRatio': '区间比-热温冷比',
            'zoneRatio_frontSum': '区间比-和值',
            'zoneRatio_frontSpan': '区间比-跨度',
            'zoneRatio_acValue': '区间比-AC值',
            'zoneRatio_oddEvenRatio': '区间比-奇偶比'
        };

        // 定义显示顺序
        const displayOrder = [
            // 热温冷比分析的顺序
            'hwcRatio', 'hwcRatio_frontSum', 'hwcRatio_frontSpan',
            'hwcRatio_zoneRatio', 'hwcRatio_acValue', 'hwcRatio_oddEvenRatio',

            // 区间比分析的顺序
            'zoneRatio', 'zoneRatio_hwcRatio', 'zoneRatio_frontSum',
            'zoneRatio_frontSpan', 'zoneRatio_acValue', 'zoneRatio_oddEvenRatio'
        ];

        // 按顺序显示存在的字段
        displayOrder.forEach(key => {
            if (topStats[key] && topStats[key].length > 0) {
                const title = titleMap[key] || key;
                cards.push(this.generateTop6Card(title, topStats[key]));
            }
        });

        return cards.join('');
    }

    /**
     * 生成单个TOP6卡片
     */
    generateTop6Card(title, data) {
        if (!data || data.length === 0) {
            return `
                <div class="stats-top6-card">
                    <h5>${title}</h5>
                    <div class="stats-value-list">
                        <div style="text-align: center; padding: 20px; color: #6c757d;">暂无数据</div>
                    </div>
                </div>
            `;
        }

        const valueItems = data.map(item => `
            <div class="stats-value-item">
                <span class="stats-value-label">${item.value}</span>
                <span class="stats-value-count">${item.count}次</span>
            </div>
        `).join('');

        return `
            <div class="stats-top6-card">
                <h5>${title}</h5>
                <div class="stats-value-list">
                    ${valueItems}
                </div>
            </div>
        `;
    }

    /**
     * 生成详细数据表格
     */
    generateDetailTable(records) {
        if (!records || records.length === 0) {
            return '<p style="text-align: center; color: #6c757d;">暂无详细数据</p>';
        }

        const rows = records.map(record => `
            <tr>
                <td>${record.issue || record.Issue}</td>
                <td>${this.formatBalls(record.frontBalls || [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5])}</td>
                <td>${record.frontSum || record.FrontSum || '-'}</td>
                <td>${record.frontSpan || record.FrontSpan || '-'}</td>
                <td><strong>${record.hwcRatio || record.HWCRatio || '-'}</strong></td>
                <td>${record.zoneRatio || record.ZoneRatio || '-'}</td>
                <td>${record.acValue !== undefined ? record.acValue : (record.ACValue || '-')}</td>
                <td>${record.oddEvenRatio || record.OddEvenRatio || '-'}</td>
            </tr>
        `).join('');

        return `
            <div style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px;">
                <table class="stats-detail-table">
                    <thead>
                        <tr>
                            <th>期号</th>
                            <th>前区号码</th>
                            <th>和值</th>
                            <th>跨度</th>
                            <th>热温冷比</th>
                            <th>区间比</th>
                            <th>AC值</th>
                            <th>前区奇偶比</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * 格式化球号
     */
    formatBalls(balls) {
        if (!balls || balls.length === 0) return '-';
        return balls.map(n => String(n).padStart(2, '0')).join(', ');
    }
}

// ==================== 初始化函数 ====================

/**
 * 初始化统计关系分析面板
 */
function initDLTStatsRelation() {
    console.log('初始化大乐透统计关系分析面板（重构版）');

    const panel = document.getElementById('dlt-stats-relation');
    if (!panel) {
        console.error('统计关系分析面板未找到');
        return;
    }

    // 绑定子导航
    bindSubNavButtons();

    // 为每个分析类型初始化
    Object.values(ANALYSIS_TYPES).forEach(config => {
        initAnalysisType(config);
    });

    console.log('✅ 统计关系分析面板初始化完成');
}

/**
 * 绑定子导航按钮（面板切换）
 */
function bindSubNavButtons() {
    const subNavBtns = document.querySelectorAll('.stats-sub-nav-btn');

    subNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPanel = btn.dataset.panel;

            // 移除所有按钮的 active 状态
            subNavBtns.forEach(b => b.classList.remove('active'));

            // 添加当前按钮的 active 状态
            btn.classList.add('active');

            // 隐藏所有面板
            document.querySelectorAll('.stats-analysis-panel').forEach(panel => {
                panel.classList.remove('active');
            });

            // 显示目标面板
            const panel = document.getElementById(targetPanel + '-panel');
            if (panel) {
                panel.classList.add('active');
                console.log(`切换到面板: ${targetPanel}`);
            } else {
                console.error(`面板未找到: ${targetPanel}`);
            }
        });
    });
}

/**
 * 初始化单个分析类型
 */
function initAnalysisType(config) {
    const analyzer = new UniversalStatsAnalyzer(config);

    console.log(`初始化分析类型: ${config.displayName}`);

    // 快选按钮
    document.querySelectorAll(`#${config.panelId} .${config.quickBtnClass}`).forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const selections = config.quickSelections[type] || [];

            console.log(`快选: ${type}`, selections);

            // 清空所有选择
            document.querySelectorAll(`.${config.checkboxClass}`).forEach(cb => cb.checked = false);

            // 选中快选项
            document.querySelectorAll(`.${config.checkboxClass}`).forEach(cb => {
                if (selections.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        });
    });

    // 全选按钮
    const selectAllBtn = document.querySelector(`#${config.panelId} .${config.selectAllClass}`);
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll(`.${config.checkboxClass}`).forEach(cb => cb.checked = true);
        });
    }

    // 清空按钮
    const clearBtn = document.querySelector(`#${config.panelId} .${config.clearBtnClass}`);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.querySelectorAll(`.${config.checkboxClass}`).forEach(cb => cb.checked = false);
        });
    }

    // 范围选择器
    const rangeInputs = document.querySelectorAll(`input[name="${config.rangeInputName}"]`);
    const customInputsDiv = document.querySelector(`#${config.panelId} .${config.customInputsClass}`);

    rangeInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (customInputsDiv) {
                customInputsDiv.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            }
        });
    });

    // 分析按钮
    const analyzeBtn = document.getElementById(config.analyzeButtonId);
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            console.log(`执行${config.displayName}`);
            analyzer.execute();
        });
    }

    // 重置按钮
    const resetBtn = document.getElementById(config.resetButtonId);
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log(`重置${config.displayName}条件`);

            // 清空所有复选框
            document.querySelectorAll(`.${config.checkboxClass}`).forEach(cb => cb.checked = false);

            // 重置范围选择
            const defaultRadio = document.querySelector(`input[name="${config.rangeInputName}"][value="${config.defaultRange}"]`);
            if (defaultRadio) defaultRadio.checked = true;

            if (customInputsDiv) customInputsDiv.style.display = 'none';

            // 清空输入框
            if (document.getElementById(config.startIssueId)) {
                document.getElementById(config.startIssueId).value = '';
            }
            if (document.getElementById(config.endIssueId)) {
                document.getElementById(config.endIssueId).value = '';
            }

            // 隐藏结果面板
            document.getElementById(config.resultPanelId).style.display = 'none';
            analysisDataCache[config.id] = null;
        });
    }
}

/**
 * 导出分析结果为CSV
 */
function exportAnalysisToCSV(analysisType) {
    const data = analysisDataCache[analysisType];
    if (!data || !data.detailRecords) {
        alert('没有可导出的数据');
        return;
    }

    const config = ANALYSIS_TYPES[analysisType];
    const records = data.detailRecords;

    // CSV表头
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += '期号,前区号码,和值,跨度,热温冷比,区间比,AC值,前区奇偶比\n';

    // CSV数据行
    records.forEach(record => {
        const frontBalls = record.frontBalls
            ? record.frontBalls.map(n => String(n).padStart(2, '0')).join(' ')
            : `${String(record.Red1).padStart(2, '0')} ${String(record.Red2).padStart(2, '0')} ${String(record.Red3).padStart(2, '0')} ${String(record.Red4).padStart(2, '0')} ${String(record.Red5).padStart(2, '0')}`;

        csvContent += `${record.issue || record.Issue},`;
        csvContent += `"${frontBalls}",`;
        csvContent += `${record.frontSum || record.FrontSum},`;
        csvContent += `${record.frontSpan || record.FrontSpan},`;
        csvContent += `"${record.hwcRatio || record.HWCRatio}",`;
        csvContent += `"${record.zoneRatio || record.ZoneRatio}",`;
        csvContent += `${record.acValue !== undefined ? record.acValue : record.ACValue},`;
        csvContent += `"${record.oddEvenRatio || record.OddEvenRatio}"\n`;
    });

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${config.displayName}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`${config.displayName} CSV导出成功`);
}

// 导出函数供外部调用
window.initDLTStatsRelation = initDLTStatsRelation;
window.exportAnalysisToCSV = exportAnalysisToCSV;

// 兼容旧的导出函数名（向后兼容）
window.exportStatsToCSV = () => exportAnalysisToCSV('hwc');
window.exportZoneStatsToCSV = () => exportAnalysisToCSV('zone');
