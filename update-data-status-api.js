/**
 * 更新 data-status API，添加 statistics字段 和 热温冷优化表 监控
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 查找并替换 data-status API
const oldPattern = /\/\*\*\s*\n\s*\*\s*获取数据状态\s*\n\s*\*\/\s*\napp\.get\('\/api\/dlt\/data-status'/;

if (!oldPattern.test(content)) {
    console.log('❌ 未找到 data-status API');
    process.exit(1);
}

// 找到API开始位置
const apiStartMatch = content.match(/\/\*\*\s*\n\s*\*\s*获取数据状态\s*\n\s*\*\/\s*\napp\.get\('\/api\/dlt\/data-status', async \(req, res\) => \{/);
if (!apiStartMatch) {
    console.log('❌ 未找到API定义');
    process.exit(1);
}

const startIndex = content.indexOf(apiStartMatch[0]);

// 找到这个API的结束位置 (下一个 app.get 或 app.post 之前)
let endIndex = startIndex + apiStartMatch[0].length;
let braceCount = 1;
let inString = false;
let stringChar = '';

while (braceCount > 0 && endIndex < content.length) {
    const char = content[endIndex];

    if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
        } else if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
        }
    } else {
        if (char === stringChar && content[endIndex - 1] !== '\\') {
            inString = false;
        }
    }
    endIndex++;
}

// 包含结束的 }); 和分号
endIndex += 2;

const oldApiCode = content.substring(startIndex, endIndex);

const newApiCode = `/**
 * 获取数据状态
 */
app.get('/api/dlt/data-status', async (req, res) => {
    try {
        const mainLatest = await hit_dlts.findOne({}).sort({ ID: -1 });  // 修复: ID排序
        const mainCount = await hit_dlts.countDocuments();

        const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const redMissingLatest = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories')
            .findOne({}, { sort: { ID: -1 } });

        const blueMissingCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();

        // 检查组合特征表
        const comboFeaturesCount = await DLTComboFeatures.countDocuments();
        const comboFeaturesLatest = await DLTComboFeatures.findOne({}).sort({ ID: -1 });

        // 检查statistics字段
        const statisticsCount = await hit_dlts.countDocuments({ 'statistics.frontSum': { $exists: true } });

        // 检查热温冷比优化表
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        const hwcLatest = await DLTRedCombinationsHotWarmColdOptimized
            .findOne({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .select('target_issue')
            .lean();
        const hwcLatestIssue = hwcLatest ? parseInt(hwcLatest.target_issue) : 0;

        const mainLatestIssue = parseInt(mainLatest?.Issue || 0);
        const redLatestIssue = parseInt(redMissingLatest?.Issue || 0);
        const comboLatestIssue = parseInt(comboFeaturesLatest?.Issue || 0);

        const tables = [
            {
                name: 'hit_dlts',
                displayName: '主数据表',
                count: mainCount,
                latestIssue: mainLatestIssue,
                status: 'ok'
            },
            {
                name: 'DLTRedMissing',
                displayName: '红球遗漏值',
                count: redMissingCount,
                latestIssue: redLatestIssue,
                status: redLatestIssue === mainLatestIssue ? 'ok' : 'outdated',
                lag: mainLatestIssue - redLatestIssue
            },
            {
                name: 'DLTBlueMissing',
                displayName: '蓝球遗漏值',
                count: blueMissingCount,
                latestIssue: redLatestIssue,
                status: redLatestIssue === mainLatestIssue ? 'ok' : 'outdated',
                lag: mainLatestIssue - redLatestIssue
            },
            {
                name: 'DLTComboFeatures',
                displayName: '组合特征表',
                count: comboFeaturesCount,
                latestIssue: comboLatestIssue,
                status: comboLatestIssue === mainLatestIssue ? 'ok' : 'outdated',
                lag: mainLatestIssue - comboLatestIssue
            },
            {
                name: 'statistics',
                displayName: 'statistics字段',
                count: statisticsCount,
                latestIssue: mainLatestIssue,
                status: statisticsCount === mainCount ? 'ok' : 'outdated',
                lag: mainCount - statisticsCount
            },
            {
                name: 'HWCOptimized',
                displayName: '热温冷优化表',
                count: hwcOptimizedCount,
                latestIssue: hwcLatestIssue,
                status: hwcLatestIssue === mainLatestIssue ? 'ok' : 'outdated',
                lag: mainLatestIssue - hwcLatestIssue
            }
        ];

        const issues = tables.filter(t => t.status !== 'ok').map(t => ({
            table: t.displayName || t.name,
            message: \`数据落后 \${t.lag} 期\`
        }));

        res.json({
            success: true,
            data: {
                tables,
                latestIssue: mainLatestIssue,
                totalRecords: mainCount,
                issues,
                needsUpdate: issues.length > 0
            }
        });

    } catch (error) {
        log('获取数据状态失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});`;

content = content.substring(0, startIndex) + newApiCode + content.substring(endIndex);
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ data-status API 已更新');
console.log('   - 添加 statistics字段 监控');
console.log('   - 添加 热温冷优化表 监控');
console.log('   - 添加 displayName 友好名称');
