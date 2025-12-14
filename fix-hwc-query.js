const fs = require('fs');
const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    async preloadHwcOptimizedData(issuePairs) {
        const startTime = Date.now();
        log(\`📥 [\${this.sessionId}] 预加载热温冷优化表: \${issuePairs.length}个期号对...\`);

        try {
            // 批量查询所有期号对的热温冷数据
            const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
                $or: issuePairs.map(p => ({
                    base_issue: p.base_issue,
                    target_issue: p.target_issue
                }))
            }).lean();`;

const newCode = `    async preloadHwcOptimizedData(issuePairs) {
        const startTime = Date.now();
        log(\`📥 [\${this.sessionId}] 预加载热温冷优化表: \${issuePairs.length}个期号对...\`);

        try {
            // 🆕 优化: 使用 target_id 范围查询（性能更好）
            const targetIds = issuePairs
                .map(p => this.issueToIdMap?.get(p.target_issue))
                .filter(id => id !== undefined);

            let hwcDataList;
            if (targetIds.length > 0 && this.issueToIdMap) {
                // 使用 target_id 范围查询
                const minId = Math.min(...targetIds);
                const maxId = Math.max(...targetIds);
                log(\`  📊 使用 target_id 范围查询: \${minId} - \${maxId}\`);
                hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
                    target_id: { $gte: minId, $lte: maxId }
                }).lean();
            } else {
                // 回退: 使用 base_issue/target_issue 字符串查询
                hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
                    $or: issuePairs.map(p => ({
                        base_issue: p.base_issue,
                        target_issue: p.target_issue
                    }))
                }).lean();
            }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ preloadHwcOptimizedData 已修改为使用 target_id 查询');
} else {
    console.log('❌ 未找到目标代码');
}
