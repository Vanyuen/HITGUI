// 管理后台前端逻辑
const API_BASE_URL = 'http://localhost:3003';

// ========== SSE进度相关 ==========
let progressEventSource = null;

// 步骤配置
const UPDATE_STEPS = [
    { id: 1, name: '生成遗漏值表', icon: '📊' },
    { id: 2, name: '生成组合特征表', icon: '🔢' },
    { id: 3, name: '生成statistics字段', icon: '📈' },
    { id: 4, name: '生成热温冷比优化表', icon: '🔥' },
    { id: 5, name: '清理过期缓存', icon: '🧹' },
    { id: 6, name: '验证数据完整性', icon: '✔️' }
];

// 日志工具
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 显示Alert
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const firstSection = document.querySelector('.section');
    firstSection.insertBefore(alertDiv, firstSection.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// 切换导入方式
function toggleImportMethod() {
    const method = document.getElementById('importMethod').value;
    const manualImport = document.getElementById('manualImport');
    const jsonImport = document.getElementById('jsonImport');

    if (method === 'manual') {
        manualImport.classList.remove('hidden');
        jsonImport.classList.add('hidden');
    } else {
        manualImport.classList.add('hidden');
        jsonImport.classList.remove('hidden');
    }
}

// 刷新数据状态
async function refreshStatus() {
    const refreshIcon = document.getElementById('refreshIcon');
    refreshIcon.innerHTML = '<span class="loading"></span>';

    addLog('正在获取数据状态...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/dlt/data-status`);
        const result = await response.json();

        if (result.success) {
            displayStatus(result.data);
            addLog('数据状态刷新成功', 'success');
        } else {
            addLog(`获取数据状态失败: ${result.message}`, 'error');
            showAlert(result.message, 'error');
        }
    } catch (error) {
        addLog(`网络错误: ${error.message}`, 'error');
        showAlert('无法连接到服务器，请确保服务正在运行', 'error');
    } finally {
        refreshIcon.textContent = '🔄';
    }
}

// 显示数据状态
function displayStatus(data) {
    const statusContent = document.getElementById('statusContent');

    let html = '';

    // 最新期号
    html += `
        <div class="status-item ${data.needsUpdate ? 'status-warning' : 'status-ok'}">
            <h4>最新期号</h4>
            <div class="value">${data.latestIssue}</div>
            <div class="label">总记录: ${data.totalRecords}期</div>
        </div>
    `;

    // 各表状态
    if (data.tables && data.tables.length > 0) {
        data.tables.forEach(table => {
            const statusClass = table.status === 'ok' ? 'status-ok' : 'status-warning';
            const statusText = table.status === 'ok' ? '✅ 已同步' : `⚠️ 落后${table.lag}期`;

            html += `
                <div class="status-item ${statusClass}">
                    <h4>${table.name}</h4>
                    <div class="value">${table.count}</div>
                    <div class="label">${statusText}</div>
                </div>
            `;
        });
    }

    statusContent.innerHTML = html;

    // 如果有问题，显示警告
    if (data.needsUpdate) {
        showAlert('检测到数据不一致，建议执行"一键更新全部数据表"', 'warning');
    }
}

// 手动添加单条记录
async function submitManualImport() {
    const issue = document.getElementById('issue').value.trim();
    const red1 = parseInt(document.getElementById('red1').value);
    const red2 = parseInt(document.getElementById('red2').value);
    const red3 = parseInt(document.getElementById('red3').value);
    const red4 = parseInt(document.getElementById('red4').value);
    const red5 = parseInt(document.getElementById('red5').value);
    const blue1 = parseInt(document.getElementById('blue1').value);
    const blue2 = parseInt(document.getElementById('blue2').value);
    const drawDate = document.getElementById('drawDate').value;
    const autoUpdate = document.getElementById('autoUpdate').checked;

    // 验证
    if (!issue || !red1 || !red2 || !red3 || !red4 || !red5 || !blue1 || !blue2 || !drawDate) {
        showAlert('请填写所有必填字段', 'error');
        return;
    }

    const redBalls = [red1, red2, red3, red4, red5];
    const blueBalls = [blue1, blue2];

    // 验证红球范围
    if (redBalls.some(ball => ball < 1 || ball > 35 || isNaN(ball))) {
        showAlert('红球号码必须在1-35之间', 'error');
        return;
    }

    // 验证蓝球范围
    if (blueBalls.some(ball => ball < 1 || ball > 12 || isNaN(ball))) {
        showAlert('蓝球号码必须在1-12之间', 'error');
        return;
    }

    // 验证红球不重复
    if (new Set(redBalls).size !== 5) {
        showAlert('红球号码不能重复', 'error');
        return;
    }

    // 验证蓝球不重复
    if (new Set(blueBalls).size !== 2) {
        showAlert('蓝球号码不能重复', 'error');
        return;
    }

    addLog(`正在添加期号 ${issue}...`, 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dlt/add-single-record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                issue,
                redBalls,
                blueBalls,
                drawDate,
                autoUpdate
            })
        });

        const result = await response.json();

        if (result.success) {
            addLog(`✅ 期号 ${issue} 添加成功 (ID: ${result.data.id})`, 'success');
            showAlert(`期号 ${issue} 添加成功！`, 'success');

            // 清空表单
            document.getElementById('issue').value = '';
            document.getElementById('red1').value = '';
            document.getElementById('red2').value = '';
            document.getElementById('red3').value = '';
            document.getElementById('red4').value = '';
            document.getElementById('red5').value = '';
            document.getElementById('blue1').value = '';
            document.getElementById('blue2').value = '';
            document.getElementById('drawDate').value = '';

            if (autoUpdate) {
                addLog('自动触发数据更新中，请稍候...', 'info');
                setTimeout(() => {
                    refreshStatus();
                }, 3000);
            }
        } else {
            addLog(`❌ 添加失败: ${result.message}`, 'error');
            showAlert(result.message, 'error');
        }
    } catch (error) {
        addLog(`❌ 网络错误: ${error.message}`, 'error');
        showAlert('添加失败: 网络错误', 'error');
    }
}

// JSON批量导入
async function submitJSONImport() {
    const jsonData = document.getElementById('jsonData').value.trim();
    const autoUpdate = document.getElementById('autoUpdate').checked;

    if (!jsonData) {
        showAlert('请输入JSON数据', 'error');
        return;
    }

    let drawData;
    try {
        drawData = JSON.parse(jsonData);
        if (!Array.isArray(drawData)) {
            throw new Error('数据必须是数组格式');
        }
    } catch (error) {
        showAlert(`JSON格式错误: ${error.message}`, 'error');
        return;
    }

    addLog(`正在批量导入 ${drawData.length} 条记录...`, 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dlt/import-draw-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                drawData,
                autoUpdate
            })
        });

        const result = await response.json();

        if (result.success) {
            const { summary } = result;
            addLog(`📊 导入完成 - 总计: ${summary.total}, 成功: ${summary.imported}, 跳过: ${summary.skipped}, 失败: ${summary.failed}`, 'success');

            if (summary.failed > 0) {
                result.details.failed.forEach(item => {
                    addLog(`   失败: 期号 ${item.issue} - ${item.reason}`, 'error');
                });
            }

            if (summary.skipped > 0) {
                result.details.skipped.forEach(item => {
                    addLog(`   跳过: 期号 ${item.issue} - ${item.reason}`, 'info');
                });
            }

            showAlert(`批量导入完成！成功: ${summary.imported}, 跳过: ${summary.skipped}, 失败: ${summary.failed}`, 'success');

            if (autoUpdate && summary.imported > 0) {
                addLog('自动触发数据更新中，请稍候...', 'info');
                setTimeout(() => {
                    refreshStatus();
                }, 3000);
            }
        } else {
            addLog(`❌ 导入失败: ${result.message}`, 'error');
            showAlert(result.message, 'error');
        }
    } catch (error) {
        addLog(`❌ 网络错误: ${error.message}`, 'error');
        showAlert('导入失败: 网络错误', 'error');
    }
}

// ========== SSE进度相关函数 ==========

// 初始化步骤UI
function initializeProgressSteps() {
    const stepsContainer = document.getElementById('progressSteps');
    stepsContainer.innerHTML = UPDATE_STEPS.map(step => `
        <div class="progress-step" data-step="${step.id}">
            <span class="progress-step-icon">${step.icon}</span>
            <span class="progress-step-name">${step.name}</span>
            <span class="progress-step-status">等待中</span>
        </div>
    `).join('');
}

// 连接SSE进度流
function connectProgressStream() {
    // 关闭现有连接
    if (progressEventSource) {
        progressEventSource.close();
    }

    addLog('📡 正在连接进度推送服务...', 'info');

    progressEventSource = new EventSource(`${API_BASE_URL}/api/dlt/update-progress-stream`);

    progressEventSource.onopen = () => {
        addLog('✅ 进度推送服务已连接', 'success');
    };

    progressEventSource.onmessage = (event) => {
        const progress = JSON.parse(event.data);
        updateProgressUI(progress);
    };

    progressEventSource.onerror = (error) => {
        console.error('SSE连接错误:', error);

        // 检查连接状态
        if (progressEventSource.readyState === EventSource.CONNECTING) {
            addLog('⏳ 正在重新连接进度推送服务...', 'info');
        } else if (progressEventSource.readyState === EventSource.CLOSED) {
            addLog('❌ 进度推送连接已关闭', 'error');
            progressEventSource.close();
            progressEventSource = null;
        }
    };
}

// 更新进度UI
function updateProgressUI(progress) {
    // 更新百分比
    document.getElementById('progressPercentage').textContent = `${progress.percentage}%`;
    document.getElementById('progressBar').style.width = `${progress.percentage}%`;

    // 更新消息
    document.getElementById('progressMessage').textContent = progress.message;

    // 更新统计
    const elapsedSeconds = Math.floor(progress.elapsedTime / 1000);
    document.getElementById('elapsedTime').textContent = `${elapsedSeconds}秒`;
    document.getElementById('processedCount').textContent = progress.processedCount || 0;
    document.getElementById('totalCount').textContent = progress.totalCount || 0;

    // 更新步骤状态
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed', 'failed');

        if (stepNum < progress.step) {
            stepEl.classList.add('completed');
            stepEl.querySelector('.progress-step-status').textContent = '✅ 完成';
        } else if (stepNum === progress.step) {
            if (progress.status === 'failed') {
                stepEl.classList.add('failed');
                stepEl.querySelector('.progress-step-status').textContent = '❌ 失败';
            } else {
                stepEl.classList.add('active');
                stepEl.querySelector('.progress-step-status').textContent = '⏳ 进行中';
            }
        } else {
            stepEl.querySelector('.progress-step-status').textContent = '等待中';
        }
    });

    // 完成或失败时的处理
    if (progress.status === 'completed' || progress.status === 'failed') {
        setTimeout(() => {
            resetUpdateUI();
            if (progress.status === 'completed') {
                showAlert('✅ 数据更新完成！', 'success');
                addLog('✅ 数据更新完成，正在刷新数据状态...', 'success');
                setTimeout(() => {
                    refreshStatus();  // 自动刷新数据状态
                }, 1000);
            } else {
                showAlert('❌ 数据更新失败，请查看日志', 'error');
            }
        }, 2000);
    }
}

// 重置更新UI
function resetUpdateUI() {
    const updateBtn = document.getElementById('updateBtn');
    updateBtn.disabled = false;
    updateBtn.innerHTML = '🚀 一键更新全部数据表';

    if (progressEventSource) {
        progressEventSource.close();
        progressEventSource = null;
    }
}

// 执行统一更新 (修改版，支持SSE进度)
async function executeUnifiedUpdate() {
    if (!confirm('确定要执行数据更新吗？此操作可能需要数分钟时间。')) {
        return;
    }

    const updateBtn = document.getElementById('updateBtn');
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<span class="loading"></span> 更新中...';

    // 显示进度容器
    const progressContainer = document.getElementById('updateProgressContainer');
    progressContainer.classList.remove('hidden');

    // 初始化步骤UI
    initializeProgressSteps();

    // 建立SSE连接
    connectProgressStream();

    addLog('🚀 开始执行统一数据更新...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/dlt/unified-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'repair'
            })
        });

        const result = await response.json();

        if (result.success) {
            addLog(`✅ ${result.message}`, 'success');
        } else {
            addLog(`❌ 更新启动失败: ${result.message}`, 'error');
            showAlert(result.message, 'error');
            resetUpdateUI();
        }
    } catch (error) {
        addLog(`❌ 网络错误: ${error.message}`, 'error');
        showAlert('更新失败: 网络错误', 'error');
        resetUpdateUI();
    }
}

// 清理过期缓存
async function clearExpiredCache() {
    if (!confirm('确定要清理过期缓存吗？')) {
        return;
    }

    addLog('正在清理过期缓存...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/dlt/cleanup-expired-cache`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            addLog(`✅ 清理完成: ${result.message}`, 'success');
            showAlert(result.message, 'success');
        } else {
            addLog(`❌ 清理失败: ${result.message}`, 'error');
            showAlert(result.message, 'error');
        }
    } catch (error) {
        addLog(`❌ 网络错误: ${error.message}`, 'error');
        showAlert('清理失败: 网络错误', 'error');
    }
}

// 页面加载时自动刷新状态
window.addEventListener('DOMContentLoaded', () => {
    addLog('管理后台已就绪', 'info');

    // 设置当前日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('drawDate').value = today;

    // 自动刷新状态
    setTimeout(() => {
        refreshStatus();
    }, 500);
});

// 页面卸载时关闭SSE连接
window.addEventListener('beforeunload', () => {
    if (progressEventSource) {
        progressEventSource.close();
    }
});
