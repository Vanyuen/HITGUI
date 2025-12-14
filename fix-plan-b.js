const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

let content = fs.readFileSync(path, 'utf8');

// ======== 修改点3: 在 regenerateDetailsMapForCondition 函数后添加新函数 ========
// 找到 regenerateDetailsMapForCondition 函数结尾的位置
const funcEndPattern = /return detailsMap;\s*\n\}/;
const funcEndMatch = content.match(funcEndPattern);

if (funcEndMatch) {
    const insertPosition = content.indexOf(funcEndMatch[0]) + funcEndMatch[0].length;

    const newFunction = `

/**
 * ⭐ 方案B辅助函数: 获取或加载组合数据映射（2025-12-02）
 *
 * 优先使用全局缓存，缓存不可用时从数据库加载
 * 用于Excel导出时按需生成detailsMap
 *
 * @param {string} taskId - 任务ID（用于日志）
 * @returns {Map|null} - combination_id -> combo 的映射，失败返回null
 */
async function getOrLoadCombinationMap(taskId) {
    try {
        // 方式1: 优先使用全局缓存
        const cachedData = globalCacheManager.getCachedData();
        if (cachedData.redCombinations && cachedData.redCombinations.length > 0) {
            log(\`    📦 [\${taskId}] 使用全局缓存组合数据: \${cachedData.redCombinations.length}条\`);
            const combinationMap = new Map();
            for (const combo of cachedData.redCombinations) {
                combinationMap.set(combo.combination_id, combo);
            }
            return combinationMap;
        }

        // 方式2: 缓存不可用，从数据库加载
        log(\`    📥 [\${taskId}] 全局缓存不可用，从数据库加载组合数据...\`);
        const startTime = Date.now();

        const redCombinations = await DLTRedCombinations.find({})
            .select('combination_id balls red_ball_1 red_ball_2 red_ball_3 red_ball_4 red_ball_5 sum_value span_value zone_ratio odd_even_ratio ac_value')
            .lean();

        if (!redCombinations || redCombinations.length === 0) {
            log(\`    ❌ [\${taskId}] 数据库无组合数据\`);
            return null;
        }

        const combinationMap = new Map();
        for (const combo of redCombinations) {
            combinationMap.set(combo.combination_id, combo);
        }

        const elapsed = Date.now() - startTime;
        log(\`    ✅ [\${taskId}] 从数据库加载完成: \${combinationMap.size}条, 耗时\${elapsed}ms\`);

        return combinationMap;

    } catch (error) {
        log(\`    ❌ [\${taskId}] 加载组合数据失败: \${error.message}\`);
        return null;
    }
}`;

    content = content.slice(0, insertPosition) + newFunction + content.slice(insertPosition);
    console.log('✅ 修改点3完成: getOrLoadCombinationMap函数已添加');
} else {
    console.log('❌ 修改点3失败: 未找到插入位置');
}

// ======== 修改点2: 修改Excel导出处理逻辑 ========
// 找到原来的 for 循环处理代码
const oldForLoop = `            for (const record of exclusionRecords) {
                const step = record.step;
                if (stepGroups[step]) {
                    stepGroups[step].excludedIds = record.excluded_combination_ids || [];
                    stepGroups[step].detailsMap = record.exclusion_details_map || {};
                    stepGroups[step].metadata = record.metadata || {}; // ⭐ 新增：保存元数据
                }
            }`;

const newForLoop = `            // ⭐ 2025-12-02: 方案B - 按需生成detailsMap
            // step -> condition 映射表
            const stepToConditionMap = {
                2: 'positive_step2_zone_ratio',
                3: 'positive_step3_sum_range',
                4: 'positive_step4_span_range',
                5: 'positive_step5_odd_even_ratio',
                6: 'positive_step6_ac_value',
                7: 'exclude_step7_consecutive_groups',
                8: 'exclude_step8_max_consecutive_length',
                9: 'exclude_step9_conflict_pairs',
                10: 'exclude_step10_cooccurrence'
            };

            // 预加载组合映射（仅当需要按需生成时加载一次）
            let combinationMapForOnDemand = null;

            for (const record of exclusionRecords) {
                const step = record.step;
                if (stepGroups[step]) {
                    stepGroups[step].excludedIds = record.excluded_combination_ids || [];
                    stepGroups[step].metadata = record.metadata || {};

                    // ⭐ 方案B: 检查detailsMap是否需要按需生成
                    let detailsMap = record.exclusion_details_map || {};
                    const detailsMapKeys = detailsMap instanceof Map ? detailsMap.size : Object.keys(detailsMap).length;
                    const hasDetails = detailsMapKeys > 0;

                    if (!hasDetails && stepGroups[step].excludedIds.length > 0) {
                        // detailsMap为空且有排除ID，需要按需生成
                        log(\`    🔧 Step\${step} detailsMap为空(excludedIds: \${stepGroups[step].excludedIds.length}), 按需生成中...\`);

                        // 惰性加载组合映射（只加载一次）
                        if (!combinationMapForOnDemand) {
                            combinationMapForOnDemand = await getOrLoadCombinationMap(task_id);
                        }

                        if (combinationMapForOnDemand) {
                            const condition = stepToConditionMap[step];
                            detailsMap = regenerateDetailsMapForCondition(
                                condition,
                                stepGroups[step].excludedIds,
                                stepGroups[step].metadata,
                                combinationMapForOnDemand
                            );
                            log(\`    ✅ Step\${step} 按需生成完成: \${Object.keys(detailsMap).length}条详情\`);
                        } else {
                            log(\`    ⚠️ Step\${step} 无法按需生成: 组合数据不可用\`);
                        }
                    }

                    stepGroups[step].detailsMap = detailsMap;
                }
            }`;

if (content.includes(oldForLoop)) {
    content = content.replace(oldForLoop, newForLoop);
    console.log('✅ 修改点2完成: Excel导出逻辑已更新为按需生成');
} else {
    console.log('❌ 修改点2失败: 未找到目标代码块');
    // 调试输出
    const idx = content.indexOf('for (const record of exclusionRecords)');
    if (idx !== -1) {
        console.log('找到for循环位置:', idx);
        console.log('周围内容:\n', content.substring(idx, idx + 500));
    }
}

// 保存文件
fs.writeFileSync(path, content, 'utf8');
console.log('✅ 文件已保存');
