/**
 * 热温冷正选批量预测 - 功能增强代码
 *
 * 使用说明：
 * 1. 修改 renderHwcPosTaskDetail 函数中的期号结果渲染部分（dlt-module.js 第17238-17264行）
 * 2. 在 dlt-module.js 文件末尾添加两个新函数：showPeriodExclusionDetails 和 exportPeriodExcel
 */

// ========== 第一部分：修改 renderHwcPosTaskDetail 函数 ==========
// 找到 dlt-module.js 第17238行附近的代码，替换为以下内容：

/*
    // 各期结果 - 修改为包含操作按钮
    const resultsBody = document.getElementById('hwc-pos-modal-results-tbody');
    if (resultsBody) {
        if (period_results && period_results.length > 0) {
            resultsBody.innerHTML = period_results.map(result => {
                // 安全访问所有嵌套属性
                const hit = result.hit_analysis || {};
                const prizeStats = hit.prize_stats || {};
                const isPredicted = result.is_predicted || false;

                return `
                    <tr>
                        <td>${result.period || '-'}${isPredicted ? ' (推算)' : ''}</td>
                        <td>${(result.combination_count || 0).toLocaleString()}</td>
                        <td>${hit.max_red_hit || 0}/5</td>
                        <td>${hit.max_blue_hit || 0}/2</td>
                        <td>${prizeStats.first_prize?.count || 0}</td>
                        <td>${prizeStats.second_prize?.count || 0}</td>
                        <td>${prizeStats.third_prize?.count || 0}</td>
                        <td>${(hit.hit_rate || 0).toFixed(2)}%</td>
                        <td>¥${(hit.total_prize || 0).toLocaleString()}</td>
                        <td>
                            <button class="btn-secondary" style="margin: 2px;"
                                    onclick="showPeriodExclusionDetails('${task.task_id}', '${result.period}')">
                                📋 排除明细
                            </button>
                            <button class="btn-primary" style="margin: 2px;"
                                    onclick="exportPeriodExcel('${task.task_id}', '${result.period}', '${task.task_name}')">
                                📥 导出
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            resultsBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999;">暂无结果数据</td></tr>';
        }
    }
*/

// ========== 第二部分：添加新函数到 dlt-module.js 文件末尾 ==========

/**
 * 显示期号排除明细
 */
async function showPeriodExclusionDetails(taskId, period) {
    try {
        console.log(`📋 查看第 ${period} 期排除明细`);

        // 获取任务结果数据
        const response = await fetch(`${API_BASE_URL}/api/dlt/hwc-positive-tasks/${taskId}`);
        const data = await response.json();

        if (!data.success) {
            alert('获取排除明细失败');
            return;
        }

        // 找到对应期号的结果
        const periodResult = data.data.period_results.find(r => r.period === parseInt(period));
        if (!periodResult || !periodResult.exclusion_summary) {
            alert('该期没有排除统计数据');
            return;
        }

        const summary = periodResult.exclusion_summary;

        // 构建排除详情HTML
        let detailsHTML = `
            <div style="padding: 20px; max-width: 600px;">
                <h3 style="margin-top: 0;">📊 第 ${period} 期排除统计</h3>

                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">✅ 正选筛选后</h4>
                    <p style="font-size: 18px; margin: 5px 0;"><strong>${(summary.positive_selection_count || 0).toLocaleString()}</strong> 个组合</p>
                </div>

                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">🚫 排除详情</h4>
        `;

        // 添加各项排除统计
        const exclusions = [
            { label: '历史和值排除', count: summary.sum_exclude_count, color: '#ff9800' },
            { label: '历史跨度排除', count: summary.span_exclude_count, color: '#ff5722' },
            { label: '历史热温冷比排除', count: summary.hwc_exclude_count, color: '#f44336' },
            { label: '历史区间比排除', count: summary.zone_exclude_count, color: '#e91e63' },
            { label: '相克对排除', count: summary.conflict_exclude_count, color: '#9c27b0' },
            { label: '同现比排除', count: summary.cooccurrence_exclude_count, color: '#673ab7' }
        ];

        exclusions.forEach(excl => {
            if (excl.count && excl.count > 0) {
                const percentage = summary.positive_selection_count > 0
                    ? ((excl.count / summary.positive_selection_count) * 100).toFixed(2)
                    : 0;
                detailsHTML += `
                    <div style="padding: 8px; margin: 5px 0; border-left: 4px solid ${excl.color};">
                        <strong>${excl.label}:</strong>
                        ${excl.count.toLocaleString()} 个组合
                        <span style="color: #666;">(${percentage}%)</span>
                    </div>
                `;
            }
        });

        detailsHTML += `</div>`;

        // 最终保留数量
        const finalCount = summary.final_count || periodResult.combination_count || 0;
        const retentionRate = summary.positive_selection_count > 0
            ? ((finalCount / summary.positive_selection_count) * 100).toFixed(2)
            : 0;

        detailsHTML += `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4 style="margin-top: 0;">📌 最终保留</h4>
                <p style="font-size: 20px; margin: 5px 0; color: #1976d2;">
                    <strong>${finalCount.toLocaleString()}</strong> 个组合
                </p>
                <p style="color: #666; margin: 5px 0;">保留率: ${retentionRate}%</p>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <button class="btn-secondary" onclick="closeExclusionDetailsModal()">关闭</button>
            </div>
        </div>
        `;

        // 创建并显示模态框
        let modal = document.getElementById('period-exclusion-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'period-exclusion-modal';
            modal.className = 'modal';
            modal.style.cssText = 'display: flex; position: fixed; z-index: 1001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); align-items: center; justify-content: center;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="background-color: #fefefe; margin: auto; padding: 0; border: 1px solid #888; width: 90%; max-width: 700px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ${detailsHTML}
            </div>
        `;

        modal.style.display = 'flex';

    } catch (error) {
        console.error('显示排除明细失败:', error);
        alert('显示排除明细失败: ' + error.message);
    }
}

/**
 * 关闭排除明细模态框
 */
function closeExclusionDetailsModal() {
    const modal = document.getElementById('period-exclusion-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 导出期号Excel
 */
async function exportPeriodExcel(taskId, period, taskName) {
    try {
        console.log(`📥 导出第 ${period} 期Excel`);

        // 创建加载提示模态框
        let loadingModal = document.getElementById('export-loading-modal');
        if (!loadingModal) {
            loadingModal = document.createElement('div');
            loadingModal.id = 'export-loading-modal';
            loadingModal.className = 'modal';
            loadingModal.style.cssText = 'display: none; position: fixed; z-index: 1002; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); align-items: center; justify-content: center;';
            document.body.appendChild(loadingModal);
        }

        loadingModal.innerHTML = `
            <div class="modal-content" style="background-color: #fefefe; margin: auto; padding: 40px; border: 1px solid #888; width: 90%; max-width: 400px; border-radius: 8px; text-align: center;">
                <h3 style="margin-top: 0;">正在生成 Excel 文件</h3>
                <p style="margin: 20px 0; color: #666;">大数据量可能需要较长时间，请稍候...</p>
                <div style="margin: 20px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
        `;

        loadingModal.style.display = 'flex';

        // 请求导出
        const response = await fetch(
            `${API_BASE_URL}/api/dlt/hwc-positive-tasks/${taskId}/period/${period}/export`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error(`导出失败: ${response.statusText}`);
        }

        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `热温冷正选_${taskName}_${period}期_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=(['"]).+?\1|filename[^;=\\n]*=([^;\\n]*)/);
            if (filenameMatch) {
                filename = decodeURIComponent(filenameMatch[2] || filenameMatch[1].replace(/['"]/g, ''));
            }
        }

        // 下载文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // 关闭加载提示
        loadingModal.style.display = 'none';

        alert(`✅ Excel 文件导出成功！\n文件名: ${filename}`);

    } catch (error) {
        console.error('导出Excel失败:', error);
        const loadingModal = document.getElementById('export-loading-modal');
        if (loadingModal) {
            loadingModal.style.display = 'none';
        }
        alert('导出Excel失败: ' + error.message);
    }
}

// 确保全局可用
if (typeof window !== 'undefined') {
    window.showPeriodExclusionDetails = showPeriodExclusionDetails;
    window.closeExclusionDetailsModal = closeExclusionDetailsModal;
    window.exportPeriodExcel = exportPeriodExcel;
}

// ========== CSS 动画（添加到 index.html 的 <style> 部分） ==========
/*
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
*/
