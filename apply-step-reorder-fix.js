/**
 * 修复脚本：Step编号重新规划
 *
 * 目标：先正选后排除，量大在前量小在后
 *
 * 新的Step编号规划：
 * - Step 2-6: 正选条件 (保持不变)
 * - Step 7: 相克对排除 (原9)
 * - Step 8: 同现比排除 (原10)
 * - Step 9: 历史和值排除 (原2-错误)
 * - Step 10: 历史跨度排除 (原3-错误)
 * - Step 11: 历史区间比排除 (原6-错误)
 * - Step 12: 历史热温冷比排除 (原4-错误)
 * - Step 13: 连号组数排除 (原7)
 * - Step 14: 最长连号排除 (原8)
 *
 * 2025-12-09
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 规范化换行符
const originalLineEnding = content.includes('\r\n') ? '\r\n' : '\n';
content = content.replace(/\r\n/g, '\n');

let modifiedCount = 0;

console.log('========================================');
console.log('Step编号重新规划修复脚本');
console.log('========================================\n');

// ===== 修复 1: 历史和值排除 step 2 → 9 =====
const old1 = `            exclusionsToSave.push({
                step: 2,
                condition: 'exclude_step2_historical_sum',`;

const new1 = `            exclusionsToSave.push({
                step: 9,
                condition: 'exclude_step9_historical_sum',`;

if (content.includes(old1)) {
    content = content.replace(old1, new1);
    console.log('✅ 修复1: 历史和值排除 step 2 → 9');
    modifiedCount++;
} else if (content.includes('exclude_step9_historical_sum')) {
    console.log('✅ 修复1: 历史和值排除 - 已经是step 9');
} else {
    console.log('❌ 修复1: 未找到历史和值排除代码块');
}

// ===== 修复 2: 历史跨度排除 step 3 → 10 =====
const old2 = `            exclusionsToSave.push({
                step: 3,
                condition: 'exclude_step3_historical_span',`;

const new2 = `            exclusionsToSave.push({
                step: 10,
                condition: 'exclude_step10_historical_span',`;

if (content.includes(old2)) {
    content = content.replace(old2, new2);
    console.log('✅ 修复2: 历史跨度排除 step 3 → 10');
    modifiedCount++;
} else if (content.includes('exclude_step10_historical_span')) {
    console.log('✅ 修复2: 历史跨度排除 - 已经是step 10');
} else {
    console.log('❌ 修复2: 未找到历史跨度排除代码块');
}

// ===== 修复 3: 历史热温冷比排除 step 4 → 12 =====
const old3 = `                    exclusionsToSave.push({
                        step: 4,
                        condition: 'exclude_step4_historical_hwc',`;

const new3 = `                    exclusionsToSave.push({
                        step: 12,
                        condition: 'exclude_step12_historical_hwc',`;

if (content.includes(old3)) {
    content = content.replace(old3, new3);
    console.log('✅ 修复3: 历史热温冷比排除 step 4 → 12');
    modifiedCount++;
} else if (content.includes('exclude_step12_historical_hwc')) {
    console.log('✅ 修复3: 历史热温冷比排除 - 已经是step 12');
} else {
    console.log('❌ 修复3: 未找到历史热温冷比排除代码块');
}

// ===== 修复 4: 历史区间比排除 step 6 → 11 =====
const old4 = `            exclusionsToSave.push({
                step: 6,
                condition: 'exclude_step6_historical_zone',`;

const new4 = `            exclusionsToSave.push({
                step: 11,
                condition: 'exclude_step11_historical_zone',`;

if (content.includes(old4)) {
    content = content.replace(old4, new4);
    console.log('✅ 修复4: 历史区间比排除 step 6 → 11');
    modifiedCount++;
} else if (content.includes('exclude_step11_historical_zone')) {
    console.log('✅ 修复4: 历史区间比排除 - 已经是step 11');
} else {
    console.log('❌ 修复4: 未找到历史区间比排除代码块');
}

// ===== 修复 5: 相克对排除 step 9 → 7 =====
const old5 = `            exclusionsToSave.push({
                step: 9,
                condition: 'exclude_step9_conflict_pairs',`;

const new5 = `            exclusionsToSave.push({
                step: 7,
                condition: 'exclude_step7_conflict_pairs',`;

if (content.includes(old5)) {
    content = content.replace(old5, new5);
    console.log('✅ 修复5: 相克对排除 step 9 → 7');
    modifiedCount++;
} else if (content.includes('exclude_step7_conflict_pairs')) {
    console.log('✅ 修复5: 相克对排除 - 已经是step 7');
} else {
    console.log('❌ 修复5: 未找到相克对排除代码块');
}

// ===== 修复 6: 连号组数排除 step 7 → 13 =====
const old6 = `                exclusionsToSave.push({
                    step: 7,
                    condition: 'exclude_step7_consecutive_groups',`;

const new6 = `                exclusionsToSave.push({
                    step: 13,
                    condition: 'exclude_step13_consecutive_groups',`;

if (content.includes(old6)) {
    content = content.replace(old6, new6);
    console.log('✅ 修复6: 连号组数排除 step 7 → 13');
    modifiedCount++;
} else if (content.includes('exclude_step13_consecutive_groups')) {
    console.log('✅ 修复6: 连号组数排除 - 已经是step 13');
} else {
    console.log('❌ 修复6: 未找到连号组数排除代码块');
}

// ===== 修复 7: 最长连号排除 step 8 → 14 =====
const old7 = `                exclusionsToSave.push({
                    step: 8,
                    condition: 'exclude_step8_max_consecutive_length',`;

const new7 = `                exclusionsToSave.push({
                    step: 14,
                    condition: 'exclude_step14_max_consecutive_length',`;

if (content.includes(old7)) {
    content = content.replace(old7, new7);
    console.log('✅ 修复7: 最长连号排除 step 8 → 14');
    modifiedCount++;
} else if (content.includes('exclude_step14_max_consecutive_length')) {
    console.log('✅ 修复7: 最长连号排除 - 已经是step 14');
} else {
    console.log('❌ 修复7: 未找到最长连号排除代码块');
}

// ===== 修复 8: 同现比排除 step 10 → 8 =====
const old8 = `            exclusionsToSave.push({
                step: 10,
                condition: 'exclude_step10_cooccurrence',`;

const new8 = `            exclusionsToSave.push({
                step: 8,
                condition: 'exclude_step8_cooccurrence',`;

if (content.includes(old8)) {
    content = content.replace(old8, new8);
    console.log('✅ 修复8: 同现比排除 step 10 → 8');
    modifiedCount++;
} else if (content.includes('exclude_step8_cooccurrence')) {
    console.log('✅ 修复8: 同现比排除 - 已经是step 8');
} else {
    console.log('❌ 修复8: 未找到同现比排除代码块');
}

console.log(`\n--- 保存排除详情step修改完成: ${modifiedCount}/8 ---\n`);

// ===== 修复 9: 更新stepNames定义 =====
const oldStepNames = `        const stepNames = {
            2: 'Step 2: 区间比排除',
            3: 'Step 3: 和值范围排除',
            4: 'Step 4: 跨度范围排除',
            5: 'Step 5: 奇偶比排除',
            6: 'Step 6: AC值排除',
            7: 'Step 7: 连号组数排除',
            8: 'Step 8: 最长连号排除',
            9: 'Step 9: 相克对排除',
            10: 'Step 10: 同现比排除'
        };`;

const newStepNames = `        const stepNames = {
            // 正选条件 (Step 2-6)
            2: 'Step 2: 区间比正选排除',
            3: 'Step 3: 和值范围正选排除',
            4: 'Step 4: 跨度范围正选排除',
            5: 'Step 5: 奇偶比正选排除',
            6: 'Step 6: AC值正选排除',
            // 排除条件 (Step 7-14) - 按排除量从大到小
            7: 'Step 7: 相克对排除',
            8: 'Step 8: 同现比排除',
            9: 'Step 9: 历史和值排除',
            10: 'Step 10: 历史跨度排除',
            11: 'Step 11: 历史区间比排除',
            12: 'Step 12: 历史热温冷比排除',
            13: 'Step 13: 连号组数排除',
            14: 'Step 14: 最长连号排除'
        };`;

if (content.includes(oldStepNames)) {
    content = content.replace(oldStepNames, newStepNames);
    console.log('✅ 修复9: 更新stepNames定义 (2-14)');
    modifiedCount++;
} else if (content.includes("14: 'Step 14: 最长连号排除'")) {
    console.log('✅ 修复9: stepNames - 已经更新过');
} else {
    console.log('❌ 修复9: 未找到stepNames定义');
}

// ===== 修复 10: 更新汇总表循环范围 =====
const oldSummaryLoop = `        for (let step = 2; step <= 10; step++) {`;
const newSummaryLoop = `        for (let step = 2; step <= 14; step++) {`;

if (content.includes(oldSummaryLoop)) {
    content = content.replace(oldSummaryLoop, newSummaryLoop);
    console.log('✅ 修复10: 更新汇总表循环范围 (2-14)');
    modifiedCount++;
} else if (content.includes(newSummaryLoop)) {
    console.log('✅ 修复10: 汇总表循环范围 - 已经是2-14');
} else {
    console.log('❌ 修复10: 未找到汇总表循环');
}

// ===== 修复 11: 更新元数据处理 - 添加历史排除条件 =====
// 在 step === 10 的同现比处理后添加历史排除条件
const oldMetaEnd = `            } else if (step === 10 && metadata.cooccurrence) {
                // 同现比排除
                const co = metadata.cooccurrence;
                const mode = co.mode || 'combo_2';
                const periods = co.periods || 0;
                const featuresCount = co.total_features_count || 0;
                metadataSummary = excludedCount > 0
                    ? \`模式:\${mode}, 分析期数:\${periods}期, 特征数:\${featuresCount}\`
                    : \`已检查，无匹配。模式:\${mode}, 分析期数:\${periods}期\`;
            } else {`;

const newMetaEnd = `            } else if (step === 8 && metadata.cooccurrence) {
                // 同现比排除 (新Step 8)
                const co = metadata.cooccurrence;
                const mode = co.mode || 'combo_2';
                const periods = co.periods || 0;
                const featuresCount = co.total_features_count || 0;
                metadataSummary = excludedCount > 0
                    ? \`模式:\${mode}, 分析期数:\${periods}期, 特征数:\${featuresCount}\`
                    : \`已检查，无匹配。模式:\${mode}, 分析期数:\${periods}期\`;
            } else if (step === 9 && metadata.historical_sum) {
                // 历史和值排除
                const hs = metadata.historical_sum;
                metadataSummary = \`排除和值: \${hs.excluded_sums ? hs.excluded_sums.slice(0, 10).join(', ') + (hs.excluded_sums.length > 10 ? '...' : '') : '-'} (共\${hs.total_count || 0}个)\`;
            } else if (step === 10 && metadata.historical_span) {
                // 历史跨度排除
                const hsp = metadata.historical_span;
                metadataSummary = \`排除跨度: \${hsp.excluded_spans ? hsp.excluded_spans.join(', ') : '-'} (共\${hsp.total_count || 0}个)\`;
            } else if (step === 11 && metadata.historical_zone) {
                // 历史区间比排除
                const hz = metadata.historical_zone;
                metadataSummary = \`排除区间比: \${hz.excluded_ratios ? hz.excluded_ratios.join(', ') : '-'} (共\${hz.total_count || 0}个)\`;
            } else if (step === 12 && metadata.historical_hwc) {
                // 历史热温冷比排除
                const hh = metadata.historical_hwc;
                metadataSummary = \`排除热温冷比: \${hh.excluded_ratios ? hh.excluded_ratios.join(', ') : '-'}, 期数:\${hh.period || '-'} (共\${hh.total_count || 0}个)\`;
            } else if (step === 13 && metadata.consecutive_groups) {
                // 连号组数排除 (新Step 13)
                const cg = metadata.consecutive_groups;
                metadataSummary = \`排除组数: \${cg.excluded_groups ? cg.excluded_groups.join(', ') : '-'}\`;
            } else if (step === 14 && metadata.max_consecutive_length) {
                // 最长连号排除 (新Step 14)
                const mcl = metadata.max_consecutive_length;
                metadataSummary = \`排除长度: \${mcl.excluded_lengths ? mcl.excluded_lengths.join(', ') : '-'}\`;
            } else {`;

if (content.includes(oldMetaEnd)) {
    content = content.replace(oldMetaEnd, newMetaEnd);
    console.log('✅ 修复11: 更新元数据处理 (添加历史排除+调整step编号)');
    modifiedCount++;
} else if (content.includes('step === 9 && metadata.historical_sum')) {
    console.log('✅ 修复11: 元数据处理 - 已经更新过');
} else {
    console.log('❌ 修复11: 未找到元数据处理代码块');
}

// ===== 修复 12: 更新相克对元数据判断 step 9 → 7 =====
const oldConflictMeta = `            } else if (step === 9 && metadata.conflict_pairs) {`;
const newConflictMeta = `            } else if (step === 7 && metadata.conflict_pairs) {`;

if (content.includes(oldConflictMeta)) {
    content = content.replace(oldConflictMeta, newConflictMeta);
    console.log('✅ 修复12: 更新相克对元数据判断 step 9 → 7');
    modifiedCount++;
} else if (content.includes(newConflictMeta)) {
    console.log('✅ 修复12: 相克对元数据 - 已经是step 7');
} else {
    console.log('❌ 修复12: 未找到相克对元数据判断');
}

// ===== 修复 13: 更新连号组数元数据判断 step 7 → 已在修复11中处理 =====
const oldConsecMeta = `            } else if (step === 7 && metadata.consecutive_groups) {`;
// 这个会被修复11处理，如果还存在就删除它
if (content.includes(oldConsecMeta) && !content.includes('step === 13 && metadata.consecutive_groups')) {
    // 需要替换旧的
    content = content.replace(oldConsecMeta, `            } else if (step === 13 && metadata.consecutive_groups) {`);
    console.log('✅ 修复13: 更新连号组数元数据判断 step 7 → 13');
    modifiedCount++;
} else {
    console.log('✅ 修复13: 连号组数元数据 - 已处理');
}

// ===== 修复 14: 更新最长连号元数据判断 step 8 → 已在修复11中处理 =====
const oldMaxConsecMeta = `            } else if (step === 8 && metadata.max_consecutive_length) {`;
// 这个会被修复11处理
if (content.includes(oldMaxConsecMeta) && !content.includes('step === 14 && metadata.max_consecutive_length')) {
    content = content.replace(oldMaxConsecMeta, `            } else if (step === 14 && metadata.max_consecutive_length) {`);
    console.log('✅ 修复14: 更新最长连号元数据判断 step 8 → 14');
    modifiedCount++;
} else {
    console.log('✅ 修复14: 最长连号元数据 - 已处理');
}

// ===== 修复 15: 更新Excel导出stepGroups定义 =====
const oldStepGroups = `            const stepGroups = {
                2: { name: '区间比排除', excludedIds: [], detailsMap: {} },
                3: { name: '和值范围排除', excludedIds: [], detailsMap: {} },
                4: { name: '跨度范围排除', excludedIds: [], detailsMap: {} },
                5: { name: '奇偶比排除', excludedIds: [], detailsMap: {} },
                6: { name: 'AC值排除', excludedIds: [], detailsMap: {} },
                7: { name: '连号组数排除', excludedIds: [], detailsMap: {} },
                8: { name: '最长连号排除', excludedIds: [], detailsMap: {} },
                9: { name: '相克对排除', excludedIds: [], detailsMap: {} },
                10: { name: '同现比排除', excludedIds: [], detailsMap: {} }
            };`;

const newStepGroups = `            const stepGroups = {
                // 正选条件 (Step 2-6)
                2: { name: '区间比正选排除', excludedIds: [], detailsMap: {} },
                3: { name: '和值范围正选排除', excludedIds: [], detailsMap: {} },
                4: { name: '跨度范围正选排除', excludedIds: [], detailsMap: {} },
                5: { name: '奇偶比正选排除', excludedIds: [], detailsMap: {} },
                6: { name: 'AC值正选排除', excludedIds: [], detailsMap: {} },
                // 排除条件 (Step 7-14) - 按排除量从大到小
                7: { name: '相克对排除', excludedIds: [], detailsMap: {} },
                8: { name: '同现比排除', excludedIds: [], detailsMap: {} },
                9: { name: '历史和值排除', excludedIds: [], detailsMap: {} },
                10: { name: '历史跨度排除', excludedIds: [], detailsMap: {} },
                11: { name: '历史区间比排除', excludedIds: [], detailsMap: {} },
                12: { name: '历史热温冷比排除', excludedIds: [], detailsMap: {} },
                13: { name: '连号组数排除', excludedIds: [], detailsMap: {} },
                14: { name: '最长连号排除', excludedIds: [], detailsMap: {} }
            };`;

if (content.includes(oldStepGroups)) {
    content = content.replace(oldStepGroups, newStepGroups);
    console.log('✅ 修复15: 更新Excel导出stepGroups定义 (2-14)');
    modifiedCount++;
} else if (content.includes("14: { name: '最长连号排除'")) {
    console.log('✅ 修复15: stepGroups - 已经更新过');
} else {
    console.log('❌ 修复15: 未找到stepGroups定义');
}

// ===== 修复 16: 更新Excel排除详情查询范围 =====
const oldExcelQuery = `step: { $in: [2, 3, 4, 5, 6, 7, 8, 9, 10] }`;
const newExcelQuery = `step: { $in: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }`;

const oldQueryCount = (content.match(new RegExp(oldExcelQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (oldQueryCount > 0) {
    content = content.replace(new RegExp(oldExcelQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newExcelQuery);
    console.log(`✅ 修复16: 更新查询范围 [2-10] → [2-14] (共${oldQueryCount}处)`);
    modifiedCount++;
} else if (content.includes(newExcelQuery)) {
    console.log('✅ 修复16: 查询范围 - 已经是2-14');
} else {
    console.log('❌ 修复16: 未找到查询范围定义');
}

// ===== 修复 17: 更新Excel按Step顺序处理循环 =====
const oldExcelLoop = `for (const step of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {`;
const newExcelLoop = `for (const step of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {`;

if (content.includes(oldExcelLoop)) {
    content = content.replace(oldExcelLoop, newExcelLoop);
    console.log('✅ 修复17: 更新Excel处理循环范围 (2-14)');
    modifiedCount++;
} else if (content.includes(newExcelLoop)) {
    console.log('✅ 修复17: Excel处理循环 - 已经是2-14');
} else {
    console.log('❌ 修复17: 未找到Excel处理循环');
}

// 写回文件
if (modifiedCount > 0) {
    // 恢复原始换行符
    if (originalLineEnding === '\r\n') {
        content = content.replace(/\n/g, '\r\n');
    }

    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('\n========================================');
    console.log(`✅ Step编号重新规划修复完成！共修改 ${modifiedCount} 处`);
    console.log('========================================');
    console.log('\n新的Step编号规划:');
    console.log('  Step 2-6:  正选条件 (区间比/和值/跨度/奇偶/AC值)');
    console.log('  Step 7:    相克对排除');
    console.log('  Step 8:    同现比排除');
    console.log('  Step 9:    历史和值排除');
    console.log('  Step 10:   历史跨度排除');
    console.log('  Step 11:   历史区间比排除');
    console.log('  Step 12:   历史热温冷比排除');
    console.log('  Step 13:   连号组数排除');
    console.log('  Step 14:   最长连号排除');
} else {
    console.log('\n========================================');
    console.log('ℹ️ 无需修改（可能已经修复过）');
    console.log('========================================');
}
