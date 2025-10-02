# CSV导出功能问题分析及解决方案

## 1. 问题分析

### 1.1 发现的主要问题

基于对现有代码的分析，CSV导出功能失效的原因包括：

#### 问题1：数据结构不匹配
- **问题描述**: `exportCombinationResults`函数依赖`currentNewPredictionData`变量，但该变量可能未正确设置
- **影响**: 导出时提示"没有可导出的数据"
- **代码位置**: `dlt-module.js:4589-4593`

#### 问题2：数据格式转换错误
- **问题描述**: CSV导出时数据格式化存在问题，特别是中文字符和数字格式化
- **影响**: 生成的CSV文件格式不正确或无法正确打开
- **代码位置**: `dlt-module.js:4660-4694`

#### 问题3：文件下载机制问题
- **问题描述**: 在Electron环境中，文件下载可能受到安全策略限制
- **影响**: 用户点击导出按钮后无响应或下载失败
- **代码位置**: `dlt-module.js:4813-4847`

#### 问题4：大数据量处理性能问题
- **问题描述**: 当数据量过大时，前端处理CSV格式化会导致页面卡顿
- **影响**: 大批量组合导出时系统假死
- **代码位置**: `dlt-module.js:4700-4708`

### 1.2 具体错误场景

```javascript
// 问题场景1：数据未正确保存
function exportCombinationResults(format = 'csv') {
    if (!currentNewPredictionData) {  // 这里可能为null或undefined
        alert('没有可导出的数据');
        return;
    }
    // ...
}

// 问题场景2：数据结构不匹配
const { combinations, filters, pagination } = currentNewPredictionData;
if (!combinations || combinations.length === 0) {  // combinations可能不存在
    alert('没有可导出的组合数据');
    return;
}
```

## 2. 完整解决方案

### 2.1 增强的前端CSV导出实现

```javascript
/**
 * 增强版CSV导出功能
 * 解决数据格式、编码、性能等问题
 */
class EnhancedCSVExporter {
    constructor() {
        this.chunkSize = 1000; // 分块处理大数据
        this.exportQueue = []; // 导出队列
        this.isExporting = false;
    }

    /**
     * 主导出函数 - 支持多种数据源
     */
    async exportCombinationResults(format = 'csv', options = {}) {
        try {
            // 1. 获取导出数据
            const exportData = await this.getExportData(options);
            if (!exportData || exportData.length === 0) {
                this.showError('没有可导出的数据');
                return false;
            }

            // 2. 显示导出进度
            this.showExportProgress('开始导出数据...');

            // 3. 根据格式执行导出
            switch (format.toLowerCase()) {
                case 'csv':
                    await this.exportAsCSV(exportData, options);
                    break;
                case 'excel':
                    await this.exportAsExcel(exportData, options);
                    break;
                case 'json':
                    await this.exportAsJSON(exportData, options);
                    break;
                case 'txt':
                    await this.exportAsTXT(exportData, options);
                    break;
                default:
                    await this.exportAsCSV(exportData, options);
            }

            this.hideExportProgress();
            this.showSuccess(`成功导出 ${exportData.length} 条数据`);
            return true;

        } catch (error) {
            console.error('导出失败:', error);
            this.hideExportProgress();
            this.showError(`导出失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 获取导出数据 - 支持多种数据源
     */
    async getExportData(options = {}) {
        // 优先级：传入的数据 > 当前预测数据 > API获取
        if (options.customData && Array.isArray(options.customData)) {
            return options.customData;
        }

        if (window.currentNewPredictionData && window.currentNewPredictionData.combinations) {
            return this.formatCombinationData(window.currentNewPredictionData.combinations, options);
        }

        // 从DOM中提取数据（备用方案）
        const domData = this.extractDataFromDOM();
        if (domData && domData.length > 0) {
            return domData;
        }

        throw new Error('未找到可导出的数据源');
    }

    /**
     * 格式化组合数据
     */
    formatCombinationData(combinations, options = {}) {
        const { includeAnalysis = true, includeScore = true } = options;

        return combinations.map((combo, index) => {
            const baseData = {
                序号: index + 1,
                红球1: combo.redBalls ? combo.redBalls[0]?.toString().padStart(2, '0') : '--',
                红球2: combo.redBalls ? combo.redBalls[1]?.toString().padStart(2, '0') : '--',
                红球3: combo.redBalls ? combo.redBalls[2]?.toString().padStart(2, '0') : '--',
                红球4: combo.redBalls ? combo.redBalls[3]?.toString().padStart(2, '0') : '--',
                红球5: combo.redBalls ? combo.redBalls[4]?.toString().padStart(2, '0') : '--',
                蓝球1: combo.blueBalls ? combo.blueBalls[0]?.toString().padStart(2, '0') : '--',
                蓝球2: combo.blueBalls ? combo.blueBalls[1]?.toString().padStart(2, '0') : '--',
                前区和值: combo.frontSum || '--',
                后区和值: combo.backSum || '--'
            };

            if (includeAnalysis && combo.analysis) {
                Object.assign(baseData, {
                    区间比: combo.analysis.zoneRatio || '--',
                    奇偶比: combo.analysis.oddEvenRatio || '--',
                    大小比: combo.analysis.sizeRatio || '--',
                    连号数: combo.analysis.consecutiveCount || 0,
                    跨度: combo.analysis.span || '--',
                    AC值: combo.analysis.acValue || '--'
                });
            }

            if (includeScore && combo.scores) {
                Object.assign(baseData, {
                    总分: combo.scores.overall?.toFixed(1) || '--',
                    热温冷分: combo.scores.htc_score?.toFixed(1) || '--',
                    频率分: combo.scores.frequency_score?.toFixed(1) || '--',
                    模式分: combo.scores.pattern_score?.toFixed(1) || '--'
                });
            }

            // 添加命中分析（如果有开奖数据）
            if (combo.hitAnalysis) {
                Object.assign(baseData, {
                    命中个数: combo.hitAnalysis.hitCount || 0,
                    命中号码: combo.hitAnalysis.hitNumbers?.join(',') || '--'
                });
            }

            return baseData;
        });
    }

    /**
     * 增强版CSV导出 - 分块处理大数据
     */
    async exportAsCSV(data, options = {}) {
        const {
            filename = `大乐透组合预测_${new Date().getTime()}.csv`,
            chunkProcessing = true
        } = options;

        // 获取表头
        const headers = Object.keys(data[0] || {});
        let csvContent = headers.join(',') + '\n';

        if (chunkProcessing && data.length > this.chunkSize) {
            // 分块处理大数据
            for (let i = 0; i < data.length; i += this.chunkSize) {
                const chunk = data.slice(i, i + this.chunkSize);
                const chunkCsv = this.processDataChunk(chunk);
                csvContent += chunkCsv;

                // 更新进度
                const progress = Math.round((i + chunk.length) / data.length * 100);
                this.updateExportProgress(`正在处理数据... ${progress}%`);

                // 让出执行权，避免界面卡顿
                await this.sleep(10);
            }
        } else {
            // 小数据量直接处理
            csvContent += this.processDataChunk(data);
        }

        // 下载文件
        await this.downloadCSVFile(csvContent, filename);
    }

    /**
     * 处理数据块
     */
    processDataChunk(dataChunk) {
        let chunkCsv = '';
        for (const row of dataChunk) {
            const csvRow = Object.values(row).map(value => {
                // 处理特殊字符
                let processedValue = String(value || '');
                // 如果包含逗号、双引号或换行符，需要用双引号包围
                if (processedValue.includes(',') || processedValue.includes('"') || processedValue.includes('\n')) {
                    processedValue = '"' + processedValue.replace(/"/g, '""') + '"';
                }
                return processedValue;
            });
            chunkCsv += csvRow.join(',') + '\n';
        }
        return chunkCsv;
    }

    /**
     * 增强版文件下载 - 支持大文件和错误处理
     */
    async downloadCSVFile(csvContent, filename) {
        const bomContent = '\uFEFF' + csvContent; // 添加BOM确保中文正确显示

        try {
            // 方法1: 使用Blob API（推荐）
            const blob = new Blob([bomContent], {
                type: 'text/csv;charset=utf-8'
            });

            // 检查文件大小
            if (blob.size > 50 * 1024 * 1024) { // 50MB
                const confirm = await this.showConfirm('文件较大(>50MB)，可能影响性能，是否继续？');
                if (!confirm) return;
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 延迟释放URL，确保下载完成
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);

        } catch (error) {
            console.warn('Blob下载失败，尝试备用方案:', error);

            // 方法2: 使用data URI（备用方案）
            try {
                const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(bomContent);
                const link = document.createElement('a');
                link.href = dataUri;
                link.download = filename;
                link.click();
            } catch (fallbackError) {
                console.error('备用下载方案也失败:', fallbackError);
                throw new Error('文件下载失败，请尝试减少数据量或联系技术支持');
            }
        }
    }

    /**
     * 从DOM中提取数据（备用方案）
     */
    extractDataFromDOM() {
        const tableBody = document.querySelector('#combinationTableBody');
        if (!tableBody) return [];

        const rows = Array.from(tableBody.querySelectorAll('tr'));
        return rows.map((row, index) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 10) return null;

            return {
                序号: index + 1,
                红球1: cells[1]?.textContent?.trim() || '--',
                红球2: cells[2]?.textContent?.trim() || '--',
                红球3: cells[3]?.textContent?.trim() || '--',
                红球4: cells[4]?.textContent?.trim() || '--',
                红球5: cells[5]?.textContent?.trim() || '--',
                蓝球1: cells[6]?.textContent?.trim() || '--',
                蓝球2: cells[7]?.textContent?.trim() || '--',
                前区和值: cells[8]?.textContent?.trim() || '--',
                后区和值: cells[9]?.textContent?.trim() || '--',
                总分: cells[10]?.textContent?.trim() || '--'
            };
        }).filter(row => row !== null);
    }

    /**
     * 工具函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showExportProgress(message) {
        this.hideExportProgress(); // 先清除旧的
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
                <div id="progress-message">${message}</div>
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

    updateExportProgress(message) {
        const messageEl = document.getElementById('progress-message');
        if (messageEl) messageEl.textContent = message;
    }

    hideExportProgress() {
        const progressDiv = document.getElementById('csv-export-progress');
        if (progressDiv) progressDiv.remove();
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3';

        toast.innerHTML = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    showConfirm(message) {
        return new Promise(resolve => {
            const result = confirm(message);
            resolve(result);
        });
    }
}

// 创建全局实例
window.csvExporter = new EnhancedCSVExporter();
```

### 2.2 修复现有导出函数

```javascript
/**
 * 修复后的exportCombinationResults函数
 * 兼容现有代码，增强错误处理
 */
function exportCombinationResults(format = 'csv') {
    // 使用增强版导出器
    if (window.csvExporter) {
        return window.csvExporter.exportCombinationResults(format, {
            includeAnalysis: true,
            includeScore: true,
            chunkProcessing: true
        });
    }

    // 备用方案：使用原有逻辑但增强错误处理
    try {
        // 1. 数据源检查（多重备用）
        let exportData = null;
        let targetIssue = '未知';
        let timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

        // 尝试从全局变量获取
        if (window.currentNewPredictionData && window.currentNewPredictionData.combinations) {
            const { combinations, filters } = window.currentNewPredictionData;
            exportData = combinations;
            targetIssue = filters?.targetIssue || '未知';
        }
        // 尝试从DOM获取
        else {
            exportData = extractDataFromCurrentTable();
            if (!exportData || exportData.length === 0) {
                throw new Error('未找到可导出的数据，请确保已生成预测结果');
            }
        }

        // 2. 数据验证
        if (!exportData || !Array.isArray(exportData) || exportData.length === 0) {
            throw new Error('导出数据为空或格式不正确');
        }

        console.log(`准备导出${format}格式，数据量: ${exportData.length}条`);

        // 3. 格式化数据
        const formattedData = formatExportData(exportData);

        // 4. 执行导出
        switch (format.toLowerCase()) {
            case 'csv':
                return exportAsEnhancedCSV(formattedData, targetIssue, timestamp);
            case 'excel':
                return exportAsEnhancedExcel(formattedData, targetIssue, timestamp);
            case 'json':
                return exportAsEnhancedJSON(formattedData, targetIssue, timestamp);
            case 'txt':
                return exportAsEnhancedTXT(formattedData, targetIssue, timestamp);
            default:
                return exportAsEnhancedCSV(formattedData, targetIssue, timestamp);
        }

    } catch (error) {
        console.error('导出失败:', error);
        alert(`导出失败: ${error.message}`);
        return false;
    }
}

/**
 * 从当前表格提取数据（备用方案）
 */
function extractDataFromCurrentTable() {
    const tableBody = document.querySelector('#combinationTableBody');
    if (!tableBody) return null;

    const rows = Array.from(tableBody.querySelectorAll('tr'));
    return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        // 根据实际表格结构调整
        return {
            redBalls: [
                cells[1]?.textContent?.trim(),
                cells[2]?.textContent?.trim(),
                cells[3]?.textContent?.trim(),
                cells[4]?.textContent?.trim(),
                cells[5]?.textContent?.trim()
            ].filter(n => n && n !== '--'),
            blueBalls: [
                cells[6]?.textContent?.trim(),
                cells[7]?.textContent?.trim()
            ].filter(n => n && n !== '--'),
            frontSum: cells[8]?.textContent?.trim(),
            backSum: cells[9]?.textContent?.trim(),
            scores: {
                overall: parseFloat(cells[10]?.textContent?.trim()) || 0
            }
        };
    }).filter(row => row.redBalls.length > 0);
}

/**
 * 格式化导出数据
 */
function formatExportData(rawData) {
    return rawData.map((item, index) => {
        return {
            序号: index + 1,
            红球组合: item.redBalls ? item.redBalls.map(n => n.toString().padStart(2, '0')).join(' ') : '',
            蓝球组合: item.blueBalls ? item.blueBalls.map(n => n.toString().padStart(2, '0')).join(' ') : '',
            红球1: item.redBalls ? item.redBalls[0]?.toString().padStart(2, '0') : '',
            红球2: item.redBalls ? item.redBalls[1]?.toString().padStart(2, '0') : '',
            红球3: item.redBalls ? item.redBalls[2]?.toString().padStart(2, '0') : '',
            红球4: item.redBalls ? item.redBalls[3]?.toString().padStart(2, '0') : '',
            红球5: item.redBalls ? item.redBalls[4]?.toString().padStart(2, '0') : '',
            蓝球1: item.blueBalls ? item.blueBalls[0]?.toString().padStart(2, '0') : '',
            蓝球2: item.blueBalls ? item.blueBalls[1]?.toString().padStart(2, '0') : '',
            前区和值: item.frontSum || '',
            后区和值: item.backSum || '',
            总分: item.scores?.overall?.toFixed(1) || '',
            区间比: item.analysis?.zoneRatio || '',
            奇偶比: item.analysis?.oddEvenRatio || '',
            热温冷: item.analysis?.htcType || '',
            跨度: item.analysis?.span || '',
            AC值: item.analysis?.acValue || ''
        };
    });
}
```

### 2.3 后端API支持（可选）

```javascript
/**
 * 后端CSV导出API - 处理大数据量
 */
app.get('/api/dlt/export-combinations-csv', async (req, res) => {
    try {
        const {
            sessionId,
            format = 'csv',
            includeAnalysis = 'true',
            maxRecords = 100000
        } = req.query;

        // 获取预测数据
        const predictionData = await getCombinationPredictionData(sessionId, maxRecords);

        if (!predictionData || predictionData.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到导出数据'
            });
        }

        // 根据格式生成内容
        let content, contentType, filename;

        switch (format.toLowerCase()) {
            case 'csv':
                content = generateCSVContent(predictionData, includeAnalysis === 'true');
                contentType = 'text/csv;charset=utf-8';
                filename = `大乐透组合预测_${sessionId}_${predictionData.length}条.csv`;
                break;
            case 'json':
                content = JSON.stringify({
                    exportTime: new Date().toISOString(),
                    totalRecords: predictionData.length,
                    data: predictionData
                }, null, 2);
                contentType = 'application/json;charset=utf-8';
                filename = `大乐透组合预测_${sessionId}.json`;
                break;
            default:
                content = generateCSVContent(predictionData, includeAnalysis === 'true');
                contentType = 'text/csv;charset=utf-8';
                filename = `大乐透组合预测_${sessionId}.csv`;
        }

        // 设置响应头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Cache-Control', 'no-cache');

        // 发送内容
        res.send('\uFEFF' + content); // 添加BOM

    } catch (error) {
        console.error('CSV导出错误:', error);
        res.status(500).json({
            success: false,
            message: '导出失败',
            error: error.message
        });
    }
});

/**
 * 生成CSV内容
 */
function generateCSVContent(data, includeAnalysis = true) {
    const headers = [
        '序号', '红球1', '红球2', '红球3', '红球4', '红球5',
        '蓝球1', '蓝球2', '前区和值', '后区和值'
    ];

    if (includeAnalysis) {
        headers.push('总分', '区间比', '奇偶比', '热温冷类型', '跨度', 'AC值');
    }

    let csvContent = headers.join(',') + '\n';

    data.forEach((item, index) => {
        const row = [
            index + 1,
            ...(item.redBalls || []).map(n => n.toString().padStart(2, '0')),
            ...(item.blueBalls || []).map(n => n.toString().padStart(2, '0')),
            item.frontSum || '',
            item.backSum || ''
        ];

        if (includeAnalysis) {
            row.push(
                item.scores?.overall?.toFixed(1) || '',
                item.analysis?.zoneRatio || '',
                item.analysis?.oddEvenRatio || '',
                item.analysis?.htcType || '',
                item.analysis?.span || '',
                item.analysis?.acValue || ''
            );
        }

        // 处理CSV特殊字符
        const csvRow = row.map(value => {
            const str = String(value || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        });

        csvContent += csvRow.join(',') + '\n';
    });

    return csvContent;
}
```

## 3. 实施建议

### 3.1 立即修复步骤

1. **替换现有导出函数**: 用增强版替换`exportCombinationResults`函数
2. **增加错误处理**: 添加数据验证和用户友好的错误提示
3. **测试不同数据量**: 测试小数据(<100)、中等数据(100-10000)、大数据(>10000)的导出
4. **验证文件格式**: 确保生成的CSV能在Excel、WPS等软件中正确打开

### 3.2 长期优化方向

1. **后端导出**: 对于超大数据量，考虑后端生成文件
2. **增量导出**: 支持分页或分批导出
3. **多格式支持**: 完善Excel、JSON、TXT格式导出
4. **用户配置**: 允许用户自定义导出字段和格式

这个解决方案能够解决当前CSV导出功能的所有已知问题，并为未来扩展提供了良好的基础。