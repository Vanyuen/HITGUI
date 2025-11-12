# 热温冷正选批量预测 - 完整功能实施指南

## ✅ 已完成的修改

### 1. Schema 修复（server.js:1014-1103）
✅ **hwcPositivePredictionTaskSchema.exclusion_conditions**
- 支持完整的嵌套结构
- sum.historical, span.historical, hwc.historical, zone.historical
- conflictPairs (全局Top、每号Top、阈值过滤)
- coOccurrence (阈值过滤、历史排除)

### 2. exclusion_summary 扩展（server.js:1187-1197）
✅ **hwcPositivePredictionTaskResultSchema.exclusion_summary**
- zone_exclude_count
- cooccurrence_exclude_count
- final_count

## 🚧 待实施的功能

### 功能 1：排除明细按钮

#### 前端实现（dlt-module.js）

**步骤 1：修改期号结果渲染**

找到 `viewHwcPosTaskDetail` 函数（约17096行），在期号结果卡片中添加按钮。

查找类似这样的代码：
```javascript
// 期号结果渲染部分
periodResults.forEach(result => {
    const periodCard = document.createElement('div');
    periodCard.innerHTML = `
        <h4>第 ${result.period} 期</h4>
        <p>组合数: ${result.combination_count}</p>
        <!-- 在这里添加新按钮 -->
    `;
});
```

**修改为**：
```javascript
periodResults.forEach(result => {
    const periodCard = document.createElement('div');
    periodCard.className = 'period-result-card';

    // 格式化组合数
    const comboCount = result.combination_count?.toLocaleString() || '0';

    // 命中分析信息
    let hitInfo = '';
    if (result.hit_analysis && !result.is_predicted) {
        const hitAnalysis = result.hit_analysis;
        hitInfo = `
            <div style="margin: 8px 0;">
                <p>🎯 红球命中: ${hitAnalysis.max_red_hit || 0} | 蓝球命中: ${hitAnalysis.max_blue_hit || 0}</p>
                <p>💰 命中率: ${hitAnalysis.hit_rate?.toFixed(2) || 0}% | 总奖金: ¥${hitAnalysis.total_prize?.toLocaleString() || 0}</p>
            </div>
        `;
    }

    periodCard.innerHTML = `
        <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 10px 0;">📅 第 ${result.period} 期 ${result.is_predicted ? '(推算期)' : ''}</h4>
            <p style="margin: 5px 0;">📊 保留组合数: <strong>${comboCount}</strong></p>
            ${hitInfo}
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button class="btn-secondary" onclick="showPeriodExclusionDetails('${taskId}', '${result.period}')">
                    📋 排除明细
                </button>
                <button class="btn-primary" onclick="exportPeriodExcel('${taskId}', '${result.period}', '${task.task_name}')">
                    📥 导出Excel
                </button>
            </div>
        </div>
    `;

    periodResultsContainer.appendChild(periodCard);
});
```

**步骤 2：实现排除明细弹窗函数**

在 dlt-module.js 文件末尾添加：

```javascript
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
                <button class="btn-secondary" onclick="closeModal('exclusionDetailsModal')">关闭</button>
            </div>
        </div>
        `;

        // 显示模态框
        showModal('排除明细', detailsHTML, 'exclusionDetailsModal');

    } catch (error) {
        console.error('显示排除明细失败:', error);
        alert('显示排除明细失败: ' + error.message);
    }
}

/**
 * 导出期号Excel
 */
async function exportPeriodExcel(taskId, period, taskName) {
    try {
        console.log(`📥 导出第 ${period} 期Excel`);

        // 显示加载提示
        const loadingMsg = `正在生成 Excel 文件，请稍候...<br><small>大数据量可能需要较长时间</small>`;
        showModal('导出中', `<div style="text-align: center; padding: 40px;">${loadingMsg}</div>`, 'exportLoadingModal');

        // 请求导出
        const response = await fetch(
            `${API_BASE_URL}/api/dlt/hwc-positive-tasks/${taskId}/period/${period}/export`,
            {
                method: 'GET'
            }
        );

        if (!response.ok) {
            throw new Error(`导出失败: ${response.statusText}`);
        }

        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `热温冷正选_${taskName}_${period}期_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=(['"]).+?\\1|filename[^;=\\n]*=([^;\\n]*)/);
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
        closeModal('exportLoadingModal');

        alert(`✅ Excel 文件导出成功！\\n文件名: ${filename}`);

    } catch (error) {
        console.error('导出Excel失败:', error);
        closeModal('exportLoadingModal');
        alert('导出Excel失败: ' + error.message);
    }
}

// 确保全局可用
window.showPeriodExclusionDetails = showPeriodExclusionDetails;
window.exportPeriodExcel = exportPeriodExcel;
```

---

### 功能 2：导出 Excel API

#### 后端实现（server.js）

在 server.js 中添加新的导出API（建议放在第18000行附近，与其他热温冷正选API一起）：

```javascript
/**
 * 导出单个期号的Excel
 */
app.get('/api/dlt/hwc-positive-tasks/:task_id/period/:period/export', async (req, res) => {
    try {
        const { task_id, period } = req.params;

        log(`📥 导出热温冷正选任务 ${task_id} 的第 ${period} 期Excel`);

        // 1. 获取任务信息
        const task = await HwcPositivePredictionTask.findOne({ task_id }).lean();
        if (!task) {
            return res.status(404).json({ success: false, message: '任务不存在' });
        }

        // 2. 获取期号结果
        const periodResult = await HwcPositivePredictionTaskResult.findOne({
            task_id,
            period: parseInt(period)
        }).lean();

        if (!periodResult) {
            return res.status(404).json({ success: false, message: '期号结果不存在' });
        }

        // 3. 查询保留的红球组合数据
        const redCombinationIds = periodResult.red_combinations || [];
        const redCombinations = await DLTRedCombination.find({
            combination_id: { $in: redCombinationIds }
        }).lean();

        // 4. 查询保留的蓝球组合数据
        const blueCombinationIds = periodResult.blue_combinations || [];
        const blueCombinations = await DLTBlueCombination.find({
            combination_id: { $in: blueCombinationIds }
        }).lean();

        // 5. 创建 Excel 工作簿
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // ===== Sheet 1: 预测组合表 =====
        const sheet1 = workbook.addWorksheet('预测组合表');

        // 设置列
        sheet1.columns = [
            { header: '序号', key: 'index', width: 8 },
            { header: '红球组合', key: 'red_balls', width: 20 },
            { header: '蓝球组合', key: 'blue_balls', width: 12 },
            { header: '和值', key: 'sum', width: 8 },
            { header: '跨度', key: 'span', width: 8 },
            { header: '区间比', key: 'zone_ratio', width: 10 },
            { header: '奇偶比', key: 'odd_even', width: 10 },
            { header: '热温冷比', key: 'hwc_ratio', width: 10 },
            { header: 'AC值', key: 'ac', width: 8 },
            { header: '连号情况', key: 'consecutive', width: 12 }
        ];

        // 如果已开奖，添加命中分析列
        if (!periodResult.is_predicted && periodResult.winning_numbers) {
            sheet1.columns.push(
                { header: '红球命中', key: 'red_hit', width: 10 },
                { header: '蓝球命中', key: 'blue_hit', width: 10 },
                { header: '中奖等级', key: 'prize_level', width: 12 }
            );
        }

        // 设置表头样式
        sheet1.getRow(1).font = { bold: true };
        sheet1.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // 填充数据
        let rowIndex = 1;
        for (const redCombo of redCombinations) {
            for (const blueCombo of blueCombinations) {
                const rowData = {
                    index: rowIndex,
                    red_balls: redCombo.balls.map(b => b.toString().padStart(2, '0')).join(' '),
                    blue_balls: blueCombo.balls.map(b => b.toString().padStart(2, '0')).join(' '),
                    sum: redCombo.sum_value,
                    span: redCombo.span_value,
                    zone_ratio: redCombo.zone_ratio,
                    odd_even: redCombo.odd_even_ratio,
                    hwc_ratio: redCombo.hot_warm_cold_ratio || '-',
                    ac: redCombo.ac_value,
                    consecutive: redCombo.has_consecutive ? `${redCombo.consecutive_count}连号` : '无'
                };

                // 如果已开奖，计算命中
                if (!periodResult.is_predicted && periodResult.winning_numbers) {
                    const winningRed = periodResult.winning_numbers.red || [];
                    const winningBlue = periodResult.winning_numbers.blue || [];

                    const redHit = redCombo.balls.filter(b => winningRed.includes(b)).length;
                    const blueHit = blueCombo.balls.filter(b => winningBlue.includes(b)).length;
                    const prizeLevel = judgePrize(redHit, blueHit);

                    rowData.red_hit = redHit;
                    rowData.blue_hit = blueHit;
                    rowData.prize_level = prizeLevel || '-';
                }

                sheet1.addRow(rowData);
                rowIndex++;
            }
        }

        // ===== Sheet 2: 红球排除详情表 =====
        // 注意：这需要重新运行排除逻辑来获取被排除的组合和原因
        // 由于实现复杂度较高，这里先创建表结构，后续补充数据
        const sheet2 = workbook.addWorksheet('红球排除详情');

        sheet2.columns = [
            { header: '红球组合', key: 'red_balls', width: 20 },
            { header: '和值', key: 'sum', width: 8 },
            { header: '跨度', key: 'span', width: 8 },
            { header: '区间比', key: 'zone_ratio', width: 10 },
            { header: '奇偶比', key: 'odd_even', width: 10 },
            { header: '热温冷比', key: 'hwc_ratio', width: 10 },
            { header: 'AC值', key: 'ac', width: 8 },
            { header: '连号情况', key: 'consecutive', width: 12 },
            { header: '排除原因', key: 'exclude_reason', width: 30 }
        ];

        sheet2.getRow(1).font = { bold: true };
        sheet2.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF9800' }
        };
        sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // TODO: 需要实现排除逻辑重算，获取被排除的组合
        // 这里先添加一行提示
        sheet2.addRow({
            red_balls: '排除详情功能开发中',
            exclude_reason: '需要重新运行排除逻辑来生成此数据'
        });

        // ===== Sheet 3: 排除统计表 =====
        const sheet3 = workbook.addWorksheet('排除统计');

        sheet3.columns = [
            { header: '排除条件', key: 'condition', width: 20 },
            { header: '排除组合数', key: 'count', width: 15 },
            { header: '排除百分比', key: 'percentage', width: 15 }
        ];

        sheet3.getRow(1).font = { bold: true };
        sheet3.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2196F3' }
        };
        sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // 填充统计数据
        const summary = periodResult.exclusion_summary || {};
        const baseCount = summary.positive_selection_count || 1;

        const statsData = [
            { condition: '正选筛选后', count: baseCount, percentage: '-' }
        ];

        if (summary.sum_exclude_count > 0) {
            statsData.push({
                condition: '历史和值排除',
                count: summary.sum_exclude_count,
                percentage: `${((summary.sum_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        if (summary.span_exclude_count > 0) {
            statsData.push({
                condition: '历史跨度排除',
                count: summary.span_exclude_count,
                percentage: `${((summary.span_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        if (summary.hwc_exclude_count > 0) {
            statsData.push({
                condition: '历史热温冷比排除',
                count: summary.hwc_exclude_count,
                percentage: `${((summary.hwc_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        if (summary.zone_exclude_count > 0) {
            statsData.push({
                condition: '历史区间比排除',
                count: summary.zone_exclude_count,
                percentage: `${((summary.zone_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        if (summary.conflict_exclude_count > 0) {
            statsData.push({
                condition: '相克对排除',
                count: summary.conflict_exclude_count,
                percentage: `${((summary.conflict_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        if (summary.cooccurrence_exclude_count > 0) {
            statsData.push({
                condition: '同现比排除',
                count: summary.cooccurrence_exclude_count,
                percentage: `${((summary.cooccurrence_exclude_count / baseCount) * 100).toFixed(2)}%`
            });
        }

        const finalCount = summary.final_count || periodResult.combination_count || 0;
        statsData.push({
            condition: '最终保留',
            count: finalCount,
            percentage: `${((finalCount / baseCount) * 100).toFixed(2)}%`
        });

        statsData.forEach(data => sheet3.addRow(data));

        // 6. 生成文件并返回
        const filename = `热温冷正选_${task.task_name}_${period}期_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        await workbook.xlsx.write(res);
        res.end();

        log(`✅ Excel导出成功: ${filename}`);

    } catch (error) {
        log(`❌ 导出Excel失败: ${error.message}`);
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});
```

---

## 📋 实施步骤总结

### 步骤 1：Schema 修改（✅ 已完成）
- [x] 修改 hwcPositivePredictionTaskSchema.exclusion_conditions
- [x] 扩展 hwcPositivePredictionTaskResultSchema.exclusion_summary

### 步骤 2：前端UI修改
- [ ] 修改 `viewHwcPosTaskDetail` 函数，在期号结果卡片中添加两个按钮
- [ ] 添加 `showPeriodExclusionDetails` 函数
- [ ] 添加 `exportPeriodExcel` 函数

### 步骤 3：后端API添加
- [ ] 添加 `/api/dlt/hwc-positive-tasks/:task_id/period/:period/export` 接口
- [ ] 生成3个Sheet的Excel文件

### 步骤 4：测试验证
- [ ] 重启应用加载新Schema
- [ ] 创建新任务测试排除条件保存
- [ ] 测试"排除明细"按钮功能
- [ ] 测试"导出Excel"功能
- [ ] 验证Excel文件的3个Sheet内容

---

## ⚠️ 注意事项

1. **Sheet 2 的完整实现**：红球排除详情需要重新运行排除逻辑，建议作为第二阶段优化
2. **性能优化**：大数据量导出时可能需要时间，已添加加载提示
3. **文件命名**：使用任务名和期号作为文件名，便于识别
4. **错误处理**：所有API都有完整的try-catch和错误提示

---

## 🎯 下一步行动

请按照上述步骤2和步骤3的代码，复制粘贴到对应文件中，然后重启应用测试！
