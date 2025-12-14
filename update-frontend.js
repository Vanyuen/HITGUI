// 脚本：修改admin.html和admin.js
const fs = require('fs');
const path = require('path');

// 修改 admin.html
const adminHtmlPath = path.join(__dirname, 'src/renderer/admin.html');
let htmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

const oldHtml = `                <div class="btn-group">
                    <button class="btn btn-primary" id="updateBtn" onclick="executeUnifiedUpdate()">
                        🚀 一键更新全部数据表
                    </button>
                    <button class="btn btn-success" onclick="updateHwcOptimizedIncremental()">
                        ⚡ 增量更新热温冷优化表
                    </button>
                    <button class="btn btn-danger" onclick="rebuildHwcOptimizedAll()">
                        🔄 全量重建热温冷优化表
                    </button>
                    <button class="btn btn-warning" onclick="clearExpiredCache()">
                        🧹 清理过期缓存
                    </button>
                </div>`;

const newHtml = `                <div class="btn-group">
                    <button class="btn btn-primary" id="updateBtn" onclick="executeUnifiedUpdate()">
                        🚀 一键全量更新数据表
                    </button>
                    <button class="btn btn-success" onclick="executeUnifiedUpdateIncremental()">
                        ⚡ 一键增量更新数据表
                    </button>
                    <button class="btn btn-warning" onclick="clearExpiredCache()">
                        🧹 清理过期缓存
                    </button>
                </div>`;

if (htmlContent.includes(oldHtml)) {
    htmlContent = htmlContent.replace(oldHtml, newHtml);
    fs.writeFileSync(adminHtmlPath, htmlContent, 'utf8');
    console.log('✅ 成功修改 admin.html');
} else {
    console.log('❌ 未找到 admin.html 中的目标内容，尝试备用方案...');
    // 备用方案：只修改关键部分
    if (htmlContent.includes('onclick="updateHwcOptimizedIncremental()"')) {
        htmlContent = htmlContent.replace(
            'onclick="updateHwcOptimizedIncremental()"',
            'onclick="executeUnifiedUpdateIncremental()"'
        );
        htmlContent = htmlContent.replace(
            '⚡ 增量更新热温冷优化表',
            '⚡ 一键增量更新数据表'
        );
        htmlContent = htmlContent.replace(
            '🚀 一键更新全部数据表',
            '🚀 一键全量更新数据表'
        );
        fs.writeFileSync(adminHtmlPath, htmlContent, 'utf8');
        console.log('✅ 使用备用方案修改 admin.html');
    }
}

// 修改 admin.js - 添加新函数
const adminJsPath = path.join(__dirname, 'src/renderer/admin.js');
let jsContent = fs.readFileSync(adminJsPath, 'utf8');

const newFunction = `
// 一键增量更新所有数据表
async function executeUnifiedUpdateIncremental() {
    if (!confirm('确定要一键增量更新所有数据表吗？\\n\\n将按顺序更新：遗漏值表 → statistics → 组合特征表 → 热温冷优化表（含推算期）')) {
        return;
    }

    addLog('🚀 开始一键增量更新所有数据表...', 'info');

    try {
        const response = await fetch(\`\${API_BASE_URL}/api/dlt/unified-update-incremental\`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            addLog(\`✅ 一键增量更新完成，总耗时\${result.totalTime}\`, 'success');
            addLog(\`   遗漏值表: +\${result.results.missingTable.newRecords}条\`, 'info');
            addLog(\`   statistics: +\${result.results.statistics.newRecords}条\`, 'info');
            addLog(\`   组合特征表: +\${result.results.comboFeatures.newRecords}条\`, 'info');
            addLog(\`   热温冷优化表: +\${result.results.hwcOptimized.createdCount}条\`, 'info');
            await refreshDataStatus();
        } else {
            addLog(\`❌ 更新失败: \${result.message}\`, 'error');
        }
    } catch (error) {
        addLog(\`❌ 请求失败: \${error.message}\`, 'error');
    }
}

`;

// 在 updateHwcOptimizedIncremental 函数之前插入新函数
if (jsContent.includes('// 增量更新热温冷优化表')) {
    jsContent = jsContent.replace(
        '// 增量更新热温冷优化表',
        newFunction + '// 增量更新热温冷优化表（保留兼容）'
    );
    fs.writeFileSync(adminJsPath, jsContent, 'utf8');
    console.log('✅ 成功修改 admin.js，添加新函数');
} else {
    console.log('❌ 未找到 admin.js 中的插入位置');
}
