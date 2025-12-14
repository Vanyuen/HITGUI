/**
 * 应用调试日志到server.js
 * 用于追踪批次边界Bug的根本原因
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 1. 在preloadData结束处添加调试日志
const preloadEndMarker = `        // ⭐ 2025-12-13调试: 验证缓存加载后的状态
        log(\`  📍 DEBUG: hwcOptimizedCache加载后大小=\${this.hwcOptimizedCache?.size || 0}\`);
        const lastKeys = Array.from(this.hwcOptimizedCache?.keys() || []).slice(-5);
        log(\`  📍 DEBUG: hwcOptimizedCache最后5个key: \${lastKeys.join(', ')}\`);

        // 4. ⭐ 2025-11-14修改: 移除全局历史统计预加载`;

const preloadEndReplacement = `        // ⭐ 2025-12-13调试: 验证缓存加载后的状态
        log(\`  📍 DEBUG: hwcOptimizedCache加载后大小=\${this.hwcOptimizedCache?.size || 0}\`);
        const lastKeys = Array.from(this.hwcOptimizedCache?.keys() || []).slice(-5);
        log(\`  📍 DEBUG: hwcOptimizedCache最后5个key: \${lastKeys.join(', ')}\`);

        // 🔍 2025-12-13调试增强: 验证idToRecordMap和issueToIdMap状态
        log(\`  📍 DEBUG-PRELOAD-END: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
        if (this.idToRecordMap && this.idToRecordMap.size > 0) {
            const idKeysForDebug = Array.from(this.idToRecordMap.keys()).sort((a, b) => a - b);
            log(\`  📍 DEBUG-PRELOAD-END: idToRecordMap ID范围: \${idKeysForDebug[0]} - \${idKeysForDebug[idKeysForDebug.length - 1]}\`);
            // 检查关键ID是否存在(25091和25141对应的ID-1)
            for (const critId of [2758, 2808]) {
                const rec = this.idToRecordMap.get(critId);
                log(\`  📍 DEBUG-PRELOAD-END: idToRecordMap.get(\${critId})=\${rec ? \`Issue \${rec.Issue}\` : '不存在!'}\`);
            }
        }
        log(\`  📍 DEBUG-PRELOAD-END: issueToIdMap大小=\${this.issueToIdMap?.size || 0}\`);
        // 验证关键期号对的缓存状态
        for (const ck of ['25090-25091', '25140-25141', '25141-25142']) {
            const hwcMapForKey = this.hwcOptimizedCache?.get(ck);
            log(\`  📍 DEBUG-PRELOAD-END: hwcCache["\${ck}"]=\${hwcMapForKey ? \`存在(\${hwcMapForKey.size}个比例)\` : '不存在'}\`);
        }

        // 4. ⭐ 2025-11-14修改: 移除全局历史统计预加载`;

if (content.includes(preloadEndMarker)) {
  content = content.replace(preloadEndMarker, preloadEndReplacement);
  console.log('✅ 已添加preloadData结束时的调试日志');
} else {
  console.log('⚠️ 未找到preloadData结束标记，可能已添加');
}

// 2. 在processBatch开始处添加调试日志
const processBatchStartMarker = `        // 🐛 BUG修复 2025-11-29: 验证关键缓存是否已初始化
        // 如果缓存未初始化，记录错误并尝试重新构建
        if (!this.hwcOptimizedCache || this.hwcOptimizedCache.size === 0) {`;

const processBatchStartReplacement = `        // 🔍 2025-12-13调试: processBatch开始时验证缓存状态
        log(\`  📍 DEBUG-BATCH-START: 批次[\${issuesBatch[0]}-\${issuesBatch[issuesBatch.length-1]}] 开始处理\`);
        log(\`  📍 DEBUG-BATCH-START: hwcOptimizedCache大小=\${this.hwcOptimizedCache?.size || 0}\`);
        log(\`  📍 DEBUG-BATCH-START: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
        log(\`  📍 DEBUG-BATCH-START: issueToIdMap大小=\${this.issueToIdMap?.size || 0}\`);
        // 检查当前批次最后一期的关键信息
        const lastIssueInBatch = issuesBatch[issuesBatch.length - 1].toString();
        const lastIssueId = this.issueToIdMap?.get(lastIssueInBatch);
        log(\`  📍 DEBUG-BATCH-START: 批次最后期号=\${lastIssueInBatch}, ID=\${lastIssueId}\`);
        if (lastIssueId) {
            const baseRecordForLast = this.idToRecordMap?.get(lastIssueId - 1);
            log(\`  📍 DEBUG-BATCH-START: 最后期号的ID-1(\${lastIssueId - 1})对应记录: \${baseRecordForLast ? \`Issue \${baseRecordForLast.Issue}\` : '不存在!'}\`);
        }

        // 🐛 BUG修复 2025-11-29: 验证关键缓存是否已初始化
        // 如果缓存未初始化，记录错误并尝试重新构建
        if (!this.hwcOptimizedCache || this.hwcOptimizedCache.size === 0) {
            log(\`  🚨 DEBUG-BATCH-START: ⚠️ 缓存重建逻辑被触发!\`);`;

if (content.includes(processBatchStartMarker)) {
  content = content.replace(processBatchStartMarker, processBatchStartReplacement);
  console.log('✅ 已添加processBatch开始时的调试日志');
} else {
  console.log('⚠️ 未找到processBatch开始标记，可能已修改');
}

// 3. 在applyPositiveSelection的hwcKey查找处添加调试日志
const applyPositiveMarker = `        const hwcKey = \`\${baseIssue}-\${targetIssue}\`;
        let hwcMap = this.hwcOptimizedCache?.get(hwcKey);

        // ⭐ 2025-12-13调试: 记录hwcKey和缓存状态`;

const applyPositiveReplacement = `        const hwcKey = \`\${baseIssue}-\${targetIssue}\`;
        let hwcMap = this.hwcOptimizedCache?.get(hwcKey);

        // 🔍 2025-12-13调试增强: 记录详细的hwcKey查找过程
        log(\`  📍 DEBUG-APPLY-POSITIVE: targetIssue=\${targetIssue}, baseIssue=\${baseIssue}, hwcKey="\${hwcKey}"\`);
        log(\`  📍 DEBUG-APPLY-POSITIVE: hwcOptimizedCache大小=\${this.hwcOptimizedCache?.size || 0}, hwcMap存在=\${!!hwcMap}\`);
        if (!hwcMap && this.hwcOptimizedCache && this.hwcOptimizedCache.size > 0) {
            // 缓存不为空但没找到key，详细输出调试信息
            const allCacheKeys = Array.from(this.hwcOptimizedCache.keys());
            const matchingKeys = allCacheKeys.filter(k => k.includes(targetIssue) || k.includes(baseIssue));
            log(\`  📍 DEBUG-APPLY-POSITIVE: 未找到hwcKey! 相关key: \${matchingKeys.slice(0, 5).join(', ')}\`);
        }
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1');
            log(\`  📍 DEBUG-APPLY-POSITIVE: hwcMap.get('3:1:1')=\${ratio311 ? \`\${ratio311.length}个组合\` : '不存在'}\`);
        }
        // ⭐ 2025-12-13调试: 记录hwcKey和缓存状态`;

if (content.includes(applyPositiveMarker)) {
  content = content.replace(applyPositiveMarker, applyPositiveReplacement);
  console.log('✅ 已添加applyPositiveSelection的调试日志');
} else {
  console.log('⚠️ 未找到applyPositiveSelection标记，可能已修改');
}

// 4. 在processBatch的for循环中，为最后一期添加特殊调试日志
const forLoopMarker = `        for (let i = 0; i < issueToIDArray.length; i++) {
            const { issue: targetIssue, id: targetID } = issueToIDArray[i];`;

const forLoopReplacement = `        for (let i = 0; i < issueToIDArray.length; i++) {
            const { issue: targetIssue, id: targetID } = issueToIDArray[i];

            // 🔍 2025-12-13调试: 为批次最后一期添加详细日志
            const isLastInBatch = (i === issueToIDArray.length - 1);
            if (isLastInBatch) {
                log(\`  📍 DEBUG-LAST-ISSUE: ⚡ 处理批次最后一期 index=\${i}, targetIssue=\${targetIssue}, targetID=\${targetID}\`);
                log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
                if (targetID !== null) {
                    const baseRecCheck = this.idToRecordMap?.get(targetID - 1);
                    log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap.get(\${targetID - 1})=\${baseRecCheck ? \`Issue \${baseRecCheck.Issue}\` : '不存在!'}\`);
                }
            }`;

if (content.includes(forLoopMarker)) {
  content = content.replace(forLoopMarker, forLoopReplacement);
  console.log('✅ 已添加for循环最后一期的调试日志');
} else {
  console.log('⚠️ 未找到for循环标记，可能已修改');
}

// 写回文件
fs.writeFileSync(serverPath, content, 'utf8');
console.log('\n✅ 调试日志已应用到 server.js');
console.log('\n📌 添加的调试日志标签:');
console.log('  - DEBUG-PRELOAD-END: preloadData结束时的缓存状态');
console.log('  - DEBUG-BATCH-START: processBatch开始时的缓存状态');
console.log('  - DEBUG-APPLY-POSITIVE: applyPositiveSelection中hwcKey的查找过程');
console.log('  - DEBUG-LAST-ISSUE: 批次最后一期的处理详情');
console.log('\n运行任务后，在控制台搜索这些标签可以追踪问题。');
