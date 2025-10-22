/**
 * 大乐透统计关系分析面板
 * 功能：选择热温冷比，统计同时出现的和值、跨度、区间比、AC值的高频组合
 */

// 全局变量：存储当前分析结果
let currentStatsData = null;

/**
 * 初始化统计关系分析面板
 */
function initDLTStatsRelation() {
    console.log('初始化大乐透统计关系分析面板');

    const panel = document.getElementById('dlt-stats-relation');
    if (!panel) {
        console.error('统计关系分析面板未找到');
        return;
    }

    // 绑定快捷选择按钮
    bindQuickSelectButtons();

    // 绑定清空选择按钮
    bindClearSelectButton();

    // 绑定范围选择切换
    bindRangeSelector();

    // 绑定分析按钮
    bindAnalyzeButton();

    // 绑定重置按钮
    bindResetButton();
}

/**
 * 绑定快捷选择按钮
 */
function bindQuickSelectButtons() {
    const quickBtns = document.querySelectorAll('.quick-select-btn');

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const checkboxes = document.querySelectorAll('.hwc-ratio-checkbox');

            // 先清空所有选择
            checkboxes.forEach(cb => cb.checked = false);

            // 根据类型选择对应的热温冷比
            const selections = getQuickSelections(type);
            checkboxes.forEach(cb => {
                if (selections.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        });
    });
}

/**
 * 获取快捷选择的热温冷比列表
 */
function getQuickSelections(type) {
    const selections = {
        hot: ['5:0:0', '4:1:0', '4:0:1', '3:2:0', '3:1:1', '3:0:2'], // 热号为主
        warm: ['0:5:0', '1:4:0', '2:3:0', '0:4:1', '1:3:1'], // 温号为主
        cold: ['0:0:5', '1:0:4', '0:1:4', '2:0:3', '0:2:3', '1:1:3'], // 冷号为主
        balanced: ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1', '1:1:3'] // 均衡型
    };

    return selections[type] || [];
}

/**
 * 绑定清空选择按钮
 */
function bindClearSelectButton() {
    const clearBtn = document.querySelector('.clear-select-btn');

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.querySelectorAll('.hwc-ratio-checkbox').forEach(cb => {
                cb.checked = false;
            });
        });
    }
}

/**
 * 绑定范围选择器
 */
function bindRangeSelector() {
    const radioInputs = document.querySelectorAll('input[name="stats-range"]');
    const customInputsDiv = document.querySelector('.custom-range-inputs');

    radioInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customInputsDiv.style.display = 'flex';
            } else {
                customInputsDiv.style.display = 'none';
            }
        });
    });
}

/**
 * 绑定分析按钮
 */
function bindAnalyzeButton() {
    const analyzeBtn = document.getElementById('start-stats-analyze');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            await executeStatsAnalysis();
        });
    }
}

/**
 * 绑定重置按钮
 */
function bindResetButton() {
    const resetBtn = document.getElementById('reset-stats-condition');

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // 清空所有复选框
            document.querySelectorAll('.hwc-ratio-checkbox').forEach(cb => cb.checked = false);

            // 重置范围选择为"最近30期"
            document.querySelector('input[name="stats-range"][value="30"]').checked = true;
            document.querySelector('.custom-range-inputs').style.display = 'none';

            // 清空自定义期号输入
            document.getElementById('stats-start-issue').value = '';
            document.getElementById('stats-end-issue').value = '';

            // 隐藏结果面板
            document.getElementById('stats-result-panel').style.display = 'none';
            currentStatsData = null;
        });
    }
}

/**
 * 执行统计分析
 */
async function executeStatsAnalysis() {
    // 1. 收集选中的热温冷比
    const selectedRatios = Array.from(document.querySelectorAll('.hwc-ratio-checkbox:checked'))
        .map(cb => cb.value);

    if (selectedRatios.length === 0) {
        alert('请至少选择一个热温冷比');
        return;
    }

    // 2. 获取分析范围
    const rangeValue = document.querySelector('input[name="stats-range"]:checked').value;
    let apiUrl = 'http://localhost:3003/api/dlt/stats-relation?';

    if (rangeValue === 'custom') {
        const startIssue = document.getElementById('stats-start-issue').value.trim();
        const endIssue = document.getElementById('stats-end-issue').value.trim();

        if (!startIssue || !endIssue) {
            alert('请输入起始期号和结束期号');
            return;
        }

        if (!/^\d{7}$/.test(startIssue) || !/^\d{7}$/.test(endIssue)) {
            alert('期号格式不正确，应为7位数字（如：2024001）');
            return;
        }

        if (startIssue > endIssue) {
            alert('起始期号不能大于结束期号');
            return;
        }

        apiUrl += `startIssue=${startIssue}&endIssue=${endIssue}`;
    } else {
        apiUrl += `periods=${rangeValue}`;
    }

    apiUrl += `&hwcRatios=${selectedRatios.join(',')}`;

    console.log('统计分析API:', apiUrl);
    console.log('选中的热温冷比:', selectedRatios);

    // 3. 显示加载状态
    showStatsLoading();

    try {
        // 4. 调用后端API
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        console.log('统计分析结果:', data);

        // 5. 保存结果并显示
        currentStatsData = data;
        displayStatsResult(data);

    } catch (error) {
        console.error('统计分析失败:', error);
        showStatsError(error.message);
    }
}

/**
 * 显示加载状态
 */
function showStatsLoading() {
    const resultPanel = document.getElementById('stats-result-panel');
    resultPanel.style.display = 'block';
    resultPanel.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
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
 * 显示错误信息
 */
function showStatsError(message) {
    const resultPanel = document.getElementById('stats-result-panel');
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
 * 显示统计结果
 */
function displayStatsResult(data) {
    const resultPanel = document.getElementById('stats-result-panel');
    resultPanel.style.display = 'block';

    const { totalRecords, matchedRecords, hwcRatios, topStats, detailRecords } = data;

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
                <p>在分析的 <strong>${totalRecords}</strong> 期数据中，没有找到热温冷比为 <strong style="color: #007bff;">${hwcRatios.join(', ')}</strong> 的开奖记录</p>
                <p style="margin-top: 12px; font-size: 13px; color: #6c757d;">
                    💡 提示：可以尝试选择其他热温冷比，或扩大分析范围（如：最近100期）
                </p>
            </div>
        `;
        return;
    }

    // 构建结果HTML
    let html = `
        <div class="stats-result-header">
            <h3>📊 统计分析结果</h3>
            <div class="stats-result-summary">
                分析范围：<strong>${totalRecords}</strong> 期数据 |
                符合热温冷比 <strong style="color: #007bff;">${hwcRatios.join(', ')}</strong> 的期数：<strong>${matchedRecords}</strong> 期
            </div>
        </div>

        <div class="stats-top3-grid">
            ${generateTop3Card('前区和值', topStats.frontSum)}
            ${generateTop3Card('前区跨度', topStats.frontSpan)}
            ${generateTop3Card('热温冷比', topStats.hwcRatio)}
            ${generateTop3Card('区间比', topStats.zoneRatio)}
            ${generateTop3Card('AC值', topStats.acValue)}
        </div>

        <div class="stats-detail-section">
            <h4>📋 详细数据列表</h4>
            <div class="stats-detail-actions">
                <button class="export-csv-btn" onclick="exportStatsToCSV()">📥 导出CSV</button>
            </div>
            ${generateDetailTable(detailRecords)}
        </div>
    `;

    resultPanel.innerHTML = html;
}

/**
 * 生成TOP3卡片HTML
 */
function generateTop3Card(title, data) {
    if (!data || data.length === 0) {
        return `
            <div class="stats-top3-card">
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
        <div class="stats-top3-card">
            <h5>${title}</h5>
            <div class="stats-value-list">
                ${valueItems}
            </div>
        </div>
    `;
}

/**
 * 生成详细数据表格HTML
 */
function generateDetailTable(records) {
    if (!records || records.length === 0) {
        return '<p style="text-align: center; color: #6c757d;">暂无详细数据</p>';
    }

    const rows = records.map(record => `
        <tr>
            <td>${record.issue}</td>
            <td>${record.frontBalls ? record.frontBalls.map(n => String(n).padStart(2, '0')).join(', ') : '-'}</td>
            <td>${record.frontSum || '-'}</td>
            <td>${record.frontSpan || '-'}</td>
            <td><strong>${record.hwcRatio || '-'}</strong></td>
            <td>${record.zoneRatio || '-'}</td>
            <td>${record.acValue !== undefined ? record.acValue : '-'}</td>
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
 * 导出统计数据为CSV
 */
function exportStatsToCSV() {
    if (!currentStatsData || !currentStatsData.detailRecords) {
        alert('没有可导出的数据');
        return;
    }

    const records = currentStatsData.detailRecords;

    // CSV表头
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += '期号,前区号码,和值,跨度,热温冷比,区间比,AC值\n';

    // CSV数据行
    records.forEach(record => {
        const frontBalls = record.frontBalls ? record.frontBalls.map(n => String(n).padStart(2, '0')).join(' ') : '';
        csvContent += `${record.issue},"${frontBalls}",${record.frontSum},${record.frontSpan},"${record.hwcRatio}","${record.zoneRatio}",${record.acValue}\n`;
    });

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `大乐透统计关系_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('CSV导出成功');
}

// 导出函数供外部调用
window.initDLTStatsRelation = initDLTStatsRelation;
window.exportStatsToCSV = exportStatsToCSV;
