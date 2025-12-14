const fs = require('fs');
const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `        // 3. 生成缺失数据 (调用现有的热温冷优化表生成逻辑)
        let generatedCount = 0;

        for (const pair of missingPairs) {
            try {
                // 调用现有的生成函数 (这里使用简化版本，实际应调用update-hwc-optimized.js中的逻辑)
                // 为了简化，直接插入空记录标记，实际使用时需要完整计算
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: pair.base_issue,
                    target_issue: pair.target_issue,
                    hwc_map: new Map(), // 实际应该包含完整的热温冷数据
                    created_at: new Date()
                });
                generatedCount++;
            } catch (error) {
                log(\`⚠️  生成期号对 \${pair.base_issue}-\${pair.target_issue} 失败: \${error.message}\`);
            }
        }`;

const newCode = `        // 3. 生成缺失数据 (调用现有的热温冷优化表生成逻辑)
        let generatedCount = 0;

        // 🆕 构建 Issue -> ID 映射
        const issueToIdMap = new Map();
        const allIssueRecords = await hit_dlts.find({ Issue: { $in: issues } }).select('ID Issue').lean();
        allIssueRecords.forEach(r => issueToIdMap.set(r.Issue.toString(), r.ID));

        for (const pair of missingPairs) {
            try {
                // 调用现有的生成函数 (这里使用简化版本，实际应调用update-hwc-optimized.js中的逻辑)
                // 为了简化，直接插入空记录标记，实际使用时需要完整计算
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: pair.base_issue,
                    target_issue: pair.target_issue,
                    base_id: issueToIdMap.get(pair.base_issue) || null,    // 🆕 添加 base_id
                    target_id: issueToIdMap.get(pair.target_issue) || null, // 🆕 添加 target_id
                    hwc_map: new Map(), // 实际应该包含完整的热温冷数据
                    created_at: new Date()
                });
                generatedCount++;
            } catch (error) {
                log(\`⚠️  生成期号对 \${pair.base_issue}-\${pair.target_issue} 失败: \${error.message}\`);
            }
        }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 修改3: generate-missing-hwc API - 已添加 base_id 和 target_id');
} else {
    console.log('❌ 修改3: 未找到目标代码');
}
