/**
 * V5优化脚本 - 预加载+延迟保存优化
 *
 * 方案A: 相克对预构建（任务开始时构建一次）
 * 方案B: 排除详情延迟保存（收集后统一保存）
 * 方案C: 批量预加载（热温冷/开奖号码/遗漏值）
 */
const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

let content = fs.readFileSync(path, 'utf8');
let changeCount = 0;

// ========== 方案A: 相克对预构建 ==========
console.log('\n📦 方案A: 相克对预构建...');

// 找到函数开头，在 latestIssue 获取后添加预加载代码
const oldLatestIssue = `        // 获取最新开奖期号，用于判断是否为推算期
        const latestIssue = await getLatestIssue();`;

const newLatestIssue = `        // 获取最新开奖期号，用于判断是否为推算期
        const latestIssue = await getLatestIssue();

        // ⚡ V5优化-方案A: 相克对预构建（避免每期重复查询50条历史数据）
        let prebuiltConflictPairsSet = null;
        if (exclusion_conditions?.conflictPairs?.enabled) {
            log(\`⚡ [V5预加载] 构建相克对集合...\`);
            const preloadStart = Date.now();
            const recentIssues = await hit_dlts.find({}).sort({ Issue: -1 }).limit(50).lean();

            const pairCounts = new Map();
            for (const issue of recentIssues) {
                const reds = issue.Red || [];
                for (let i = 0; i < reds.length - 1; i++) {
                    for (let j = i + 1; j < reds.length; j++) {
                        const key = reds[i] < reds[j] ? \`\${reds[i]}-\${reds[j]}\` : \`\${reds[j]}-\${reds[i]}\`;
                        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
                    }
                }
            }

            prebuiltConflictPairsSet = new Set();
            const threshold = 2;
            for (const [pair, count] of pairCounts) {
                if (count <= threshold) {
                    prebuiltConflictPairsSet.add(pair);
                }
            }
            log(\`⚡ [V5预加载] 相克对集合构建完成: \${prebuiltConflictPairsSet.size}对, 耗时\${Date.now() - preloadStart}ms\`);
        }

        // ⚡ V5优化-方案C: 批量预加载热温冷数据
        log(\`⚡ [V5预加载] 批量加载热温冷数据...\`);
        const hwcPreloadStart = Date.now();
        const hwcDataMap = new Map();
        const issuePairs = [];
        for (let i = 0; i < issues.length - 1; i++) {
            issuePairs.push({ base_issue: issues[i], target_issue: issues[i + 1] });
        }
        const hwcRecords = await DLTRedCombinationsHotWarmColdOptimized.find({
            $or: issuePairs
        }).lean();
        hwcRecords.forEach(r => hwcDataMap.set(\`\${r.base_issue}-\${r.target_issue}\`, r));
        log(\`⚡ [V5预加载] 热温冷数据加载完成: \${hwcDataMap.size}条, 耗时\${Date.now() - hwcPreloadStart}ms\`);

        // ⚡ V5优化-方案C: 批量预加载开奖号码
        log(\`⚡ [V5预加载] 批量加载开奖号码...\`);
        const winningPreloadStart = Date.now();
        const winningDataMap = new Map();
        const targetIssuesInt = issues.slice(1).map(i => parseInt(i)).filter(i => i <= latestIssue);
        if (targetIssuesInt.length > 0) {
            const winningRecords = await hit_dlts.find({ Issue: { $in: targetIssuesInt } }).lean();
            winningRecords.forEach(r => winningDataMap.set(r.Issue, r));
        }
        log(\`⚡ [V5预加载] 开奖号码加载完成: \${winningDataMap.size}条, 耗时\${Date.now() - winningPreloadStart}ms\`);

        // ⚡ V5优化-方案B: 排除详情收集数组（延迟保存）
        const allExclusionsToSaveDeferred = [];`;

if (content.includes(oldLatestIssue)) {
    content = content.replace(oldLatestIssue, newLatestIssue);
    console.log('✅ 方案A+C: 预加载代码已添加');
    changeCount++;
} else {
    console.log('⚠️ 方案A+C: 未找到匹配位置，可能已修改');
}

// ========== 方案A: 修改相克对排除使用预构建的Set ==========
console.log('\n📦 方案A: 修改相克对排除使用预构建Set...');

const oldConflictPairs = `                // ⭐ 5.3 相克对排除（带详细原因记录）
                if (exclusion_conditions?.conflictPairs?.enabled) {
                    log(\`  ⚔️ 应用相克对排除...\`);

                    const beforeIds = combinations.map(c => c.combination_id);
                    const beforeCount = combinations.length;
                    const detailsMap = {};

                    // 构建相克对Set（分析最近50期）
                    const conflictPairsSet = new Set();
                    const recentIssues = await hit_dlts.find({}).sort({ Issue: -1 }).limit(50).lean();

                    const pairCounts = new Map();
                    for (const issue of recentIssues) {
                        const reds = issue.Red || [];
                        for (let i = 0; i < reds.length - 1; i++) {
                            for (let j = i + 1; j < reds.length; j++) {
                                const key = reds[i] < reds[j] ? \`\${reds[i]}-\${reds[j]}\` : \`\${reds[j]}-\${reds[i]}\`;
                                pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
                            }
                        }
                    }

                    // 找出相克对（同现次数 <= 2次）
                    const threshold = 2;
                    for (const [pair, count] of pairCounts) {
                        if (count <= threshold) {
                            conflictPairsSet.add(pair);
                        }
                    }

                    log(\`  ⚔️ 识别到 \${conflictPairsSet.size} 对相克号码\`);`;

const newConflictPairs = `                // ⭐ 5.3 相克对排除（带详细原因记录）
                if (exclusion_conditions?.conflictPairs?.enabled) {
                    log(\`  ⚔️ 应用相克对排除...\`);

                    const beforeIds = combinations.map(c => c.combination_id);
                    const beforeCount = combinations.length;
                    const detailsMap = {};

                    // ⚡ V5优化: 使用预构建的相克对Set（避免每期重复查询）
                    const conflictPairsSet = prebuiltConflictPairsSet;
                    log(\`  ⚔️ 使用预构建相克对: \${conflictPairsSet.size} 对\`);`;

if (content.includes(oldConflictPairs)) {
    content = content.replace(oldConflictPairs, newConflictPairs);
    console.log('✅ 方案A: 相克对排除已改为使用预构建Set');
    changeCount++;
} else {
    console.log('⚠️ 方案A: 未找到相克对排除代码块');
}

// ========== 方案C: 修改热温冷数据查询使用预加载Map ==========
console.log('\n📦 方案C: 修改热温冷数据查询使用预加载Map...');

const oldHwcQuery = `                // Step 1: 从热温冷优化表获取基础数据
                const hwcRecord = await DLTRedCombinationsHotWarmColdOptimized.findOne({
                    base_issue: baseIssue,
                    target_issue: targetIssue
                }).lean();`;

const newHwcQuery = `                // Step 1: 从热温冷优化表获取基础数据（⚡ V5优化: 使用预加载Map）
                const hwcRecord = hwcDataMap.get(\`\${baseIssue}-\${targetIssue}\`);`;

if (content.includes(oldHwcQuery)) {
    content = content.replace(oldHwcQuery, newHwcQuery);
    console.log('✅ 方案C: 热温冷数据查询已改为使用预加载Map');
    changeCount++;
} else {
    console.log('⚠️ 方案C: 未找到热温冷数据查询代码块');
}

// ========== 方案C: 修改开奖号码查询使用预加载Map ==========
console.log('\n📦 方案C: 修改开奖号码查询使用预加载Map...');

const oldWinningQuery = `                if (!isPredicted) {
                    // 获取开奖号码
                    winningRecord = await hit_dlts.findOne({ Issue: parseInt(targetIssue) }).lean();`;

const newWinningQuery = `                if (!isPredicted) {
                    // 获取开奖号码（⚡ V5优化: 使用预加载Map）
                    winningRecord = winningDataMap.get(parseInt(targetIssue));`;

if (content.includes(oldWinningQuery)) {
    content = content.replace(oldWinningQuery, newWinningQuery);
    console.log('✅ 方案C: 开奖号码查询已改为使用预加载Map');
    changeCount++;
} else {
    console.log('⚠️ 方案C: 未找到开奖号码查询代码块');
}

// ========== 方案B: 排除详情延迟保存 ==========
console.log('\n📦 方案B: 排除详情延迟保存...');

const oldExclusionSave = `                // ⭐ 同步保存Step 2-10的排除详情（带详细原因）- 修复时序问题
                if (exclusionsToSave.length > 0) {
                    log(\`    💾 正在保存排除详情 (\${exclusionsToSave.length}个步骤)...\`);
                    try {
                        await Promise.all(
                            exclusionsToSave.map(exclusion =>
                                saveExclusionDetails(
                                    task_id,
                                    result_id,
                                    targetIssue,
                                    exclusion.step,
                                    exclusion.condition,
                                    exclusion.excludedIds,
                                    exclusion.detailsMap || {}  // ⭐ 传递详细原因映射
                                )
                            )
                        );
                        log(\`    ✅ 排除详情保存完成（共 \${exclusionsToSave.length} 个步骤）\`);
                    } catch (error) {
                        log(\`    ⚠️ 排除详情保存失败: \${error.message}\`);
                        // 不阻断主流程，继续执行
                    }
                }`;

const newExclusionSave = `                // ⚡ V5优化-方案B: 收集排除详情，延迟保存（不阻塞主循环）
                if (exclusionsToSave.length > 0) {
                    allExclusionsToSaveDeferred.push({
                        result_id,
                        targetIssue,
                        exclusions: exclusionsToSave.map(e => ({
                            step: e.step,
                            condition: e.condition,
                            excludedIds: e.excludedIds,
                            detailsMap: e.detailsMap || {}
                        }))
                    });
                    log(\`    📝 排除详情已收集 (\${exclusionsToSave.length}个步骤，稍后统一保存)\`);
                }`;

if (content.includes(oldExclusionSave)) {
    content = content.replace(oldExclusionSave, newExclusionSave);
    console.log('✅ 方案B: 排除详情已改为延迟保存');
    changeCount++;
} else {
    console.log('⚠️ 方案B: 未找到排除详情保存代码块');
}

// ========== 方案B: 在任务完成后添加统一保存逻辑 ==========
console.log('\n📦 方案B: 添加任务完成后统一保存逻辑...');

const oldTaskComplete = `        log(\`✅ 热温冷正选批量预测任务完成: \${task_id}\`);

    } catch (error) {`;

const newTaskComplete = `        log(\`✅ 热温冷正选批量预测任务完成: \${task_id}\`);

        // ⚡ V5优化-方案B: 任务完成后统一保存所有排除详情
        if (allExclusionsToSaveDeferred.length > 0) {
            log(\`⚡ [V5延迟保存] 开始保存 \${allExclusionsToSaveDeferred.length} 期的排除详情...\`);
            const saveStart = Date.now();

            // 异步保存，不阻塞任务完成通知
            (async () => {
                try {
                    for (const item of allExclusionsToSaveDeferred) {
                        await Promise.all(
                            item.exclusions.map(exclusion =>
                                saveExclusionDetails(
                                    task_id,
                                    item.result_id,
                                    item.targetIssue,
                                    exclusion.step,
                                    exclusion.condition,
                                    exclusion.excludedIds,
                                    exclusion.detailsMap
                                )
                            )
                        );
                    }
                    log(\`⚡ [V5延迟保存] 排除详情保存完成，耗时\${Date.now() - saveStart}ms\`);
                } catch (error) {
                    log(\`⚠️ [V5延迟保存] 排除详情保存失败: \${error.message}\`);
                }
            })();
        }

    } catch (error) {`;

if (content.includes(oldTaskComplete)) {
    content = content.replace(oldTaskComplete, newTaskComplete);
    console.log('✅ 方案B: 统一保存逻辑已添加');
    changeCount++;
} else {
    console.log('⚠️ 方案B: 未找到任务完成位置');
}

// 写回文件
fs.writeFileSync(path, content);

console.log('\n========================================');
console.log(`✅ V5优化脚本执行完成，共修改 ${changeCount} 处`);
console.log('========================================');

if (changeCount < 6) {
    console.log('\n⚠️ 部分修改未成功，请检查代码是否已被修改过');
}
