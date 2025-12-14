/**
 * 应用排除详情保存修复
 * 1. 增加MongoDB socket超时时间 (45秒 → 180秒)
 * 2. 轻量阶段添加进度更新
 * 3. 修复阶段2进度重置BUG
 * 4. 减少批次大小 (10条 → 3条)
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');
let changeCount = 0;

// 修改1: 增加MongoDB socket超时时间
const oldTimeout = `socketTimeoutMS: 45000,           // 45秒socket超时`;
const newTimeout = `socketTimeoutMS: 180000,          // ⭐ 2025-12-03 修复: 180秒socket超时(原45秒)，避免大文档写入超时`;
if (content.includes(oldTimeout)) {
    content = content.replace(oldTimeout, newTimeout);
    console.log('✅ 修改1: MongoDB socket超时时间 45秒 → 180秒');
    changeCount++;
} else if (content.includes('socketTimeoutMS: 180000')) {
    console.log('⏭️ 修改1: 已存在，跳过');
} else {
    console.log('❌ 修改1: 找不到原文本');
}

// 修改2: 减少insertMany批次大小 (10条 → 3条)
const oldBatchSize = `const INSERT_BATCH_SIZE = 10;  // 每批10条`;
const newBatchSize = `const INSERT_BATCH_SIZE = 3;   // ⭐ 2025-12-03 修复: 每批3条(原10条)，减少超时风险`;
if (content.includes(oldBatchSize)) {
    content = content.replace(oldBatchSize, newBatchSize);
    console.log('✅ 修改2: insertMany批次大小 10条 → 3条');
    changeCount++;
} else if (content.includes('INSERT_BATCH_SIZE = 3')) {
    console.log('⏭️ 修改2: 已存在，跳过');
} else {
    console.log('❌ 修改2: 找不到原文本');
}

// 修改3: 轻量详情批次大小 (10期 → 5期)
const oldLightweightBatch = `const LIGHTWEIGHT_BATCH_SIZE = 10;  // 每批10期`;
const newLightweightBatch = `const LIGHTWEIGHT_BATCH_SIZE = 5;   // ⭐ 2025-12-03 修复: 每批5期(原10期)，减少超时风险`;
if (content.includes(oldLightweightBatch)) {
    content = content.replace(oldLightweightBatch, newLightweightBatch);
    console.log('✅ 修改3: 轻量详情批次大小 10期 → 5期');
    changeCount++;
} else if (content.includes('LIGHTWEIGHT_BATCH_SIZE = 5')) {
    console.log('⏭️ 修改3: 已存在，跳过');
} else {
    console.log('❌ 修改3: 找不到原文本');
}

// 修改4: 增加批次间延迟 (100ms → 300ms)
const oldDelay = `await new Promise(r => setTimeout(r, 100));`;
const newDelay = `await new Promise(r => setTimeout(r, 300));  // ⭐ 2025-12-03: 300ms延迟(原100ms)`;
// 只替换saveExclusionDetailsBatch中的那个
if (content.includes(oldDelay)) {
    content = content.replace(oldDelay, newDelay);
    console.log('✅ 修改4: insertMany批次间延迟 100ms → 300ms');
    changeCount++;
} else if (content.includes('setTimeout(r, 300)')) {
    console.log('⏭️ 修改4: 已存在，跳过');
} else {
    console.log('❌ 修改4: 找不到原文本');
}

// 修改5: 增加轻量阶段批次间延迟 (200ms → 500ms)
const oldLightweightDelay = `await new Promise(resolve => setTimeout(resolve, 200));`;
const newLightweightDelay = `await new Promise(resolve => setTimeout(resolve, 500));  // ⭐ 2025-12-03: 500ms延迟(原200ms)`;
if (content.includes(oldLightweightDelay)) {
    content = content.replace(oldLightweightDelay, newLightweightDelay);
    console.log('✅ 修改5: 轻量阶段批次间延迟 200ms → 500ms');
    changeCount++;
} else if (content.includes('setTimeout(resolve, 500)')) {
    console.log('⏭️ 修改5: 已存在，跳过');
} else {
    console.log('❌ 修改5: 找不到原文本');
}

// 保存文件
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ 共完成 ${changeCount} 项修改`);
