/**
 * 验证排除组合Excel导出修改
 *
 * 验证内容：
 * 1. excludedColumns 列定义是否正确（17列）
 * 2. 列定义包含：序号、组合ID、5个红球、7个特征、红球命中、排除原因、排除详情
 * 3. 数据生成逻辑包含序号和红球命中计算
 */

const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, 'src', 'server', 'server.js');
const content = fs.readFileSync(serverJsPath, 'utf-8');

console.log('📋 验证排除组合Excel导出修改...\n');

// 验证1: excludedColumns 定义是否存在
const excludedColumnsMatch = content.match(/const excludedColumns = \[([\s\S]*?)\];/);
if (excludedColumnsMatch) {
    console.log('✅ 验证1: excludedColumns 定义已找到');

    // 计算列数
    const columns = excludedColumnsMatch[1].match(/\{ header:/g);
    const columnCount = columns ? columns.length : 0;
    console.log(`   列数: ${columnCount}`);

    if (columnCount === 17) {
        console.log('   ✅ 列数正确（期望17列）');
    } else {
        console.log(`   ❌ 列数错误（期望17列，实际${columnCount}列）`);
    }

    // 验证必要的列
    const requiredColumns = ['序号', '红球命中', '排除原因', '排除详情'];
    const missingColumns = [];

    for (const col of requiredColumns) {
        if (excludedColumnsMatch[1].includes(`header: '${col}'`)) {
            console.log(`   ✅ 包含列: ${col}`);
        } else {
            console.log(`   ❌ 缺少列: ${col}`);
            missingColumns.push(col);
        }
    }

    if (missingColumns.length === 0) {
        console.log('   ✅ 所有必需列都已包含');
    }
} else {
    console.log('❌ 验证1失败: 未找到 excludedColumns 定义');
}

console.log('');

// 验证2: 排除表使用 excludedColumns
const excludedSheetMatch = content.match(/excludedSheet\.columns = excludedColumns;/);
if (excludedSheetMatch) {
    console.log('✅ 验证2: 排除表正确使用 excludedColumns');
} else {
    console.log('❌ 验证2失败: 排除表未使用 excludedColumns');
}

console.log('');

// 验证3: 数据生成包含序号
const indexMatch = content.match(/index: totalProcessed \+ j \+ 1/);
if (indexMatch) {
    console.log('✅ 验证3: 数据生成包含序号字段');
} else {
    console.log('❌ 验证3失败: 数据生成缺少序号字段');
}

console.log('');

// 验证4: 数据生成包含红球命中计算
const redHitCalcMatch = content.match(/const redHit = calculateRedHit\(redBalls, actualRed\);/);
if (redHitCalcMatch) {
    console.log('✅ 验证4: 数据生成包含红球命中计算');
} else {
    console.log('❌ 验证4失败: 数据生成缺少红球命中计算');
}

console.log('');

// 验证5: 数据push包含red_hit字段
const redHitPushMatch = content.match(/red_hit: redHit,\s*\/\/ ⭐ 新增：红球命中/);
if (redHitPushMatch) {
    console.log('✅ 验证5: 数据push包含 red_hit 字段');
} else {
    console.log('❌ 验证5失败: 数据push缺少 red_hit 字段');
}

console.log('');

// 验证6: calculateRedHit函数存在
const calculateRedHitMatch = content.match(/function calculateRedHit\(redBalls, actualRed\)/);
if (calculateRedHitMatch) {
    console.log('✅ 验证6: calculateRedHit 辅助函数存在');
} else {
    console.log('❌ 验证6失败: calculateRedHit 辅助函数不存在');
}

console.log('');

// 验证7: 没有使用columnsWithDetails（旧定义）
const columnsWithDetailsUsage = content.match(/excludedSheet\.columns = columnsWithDetails;/);
if (!columnsWithDetailsUsage) {
    console.log('✅ 验证7: 已移除旧的 columnsWithDetails 使用');
} else {
    console.log('❌ 验证7失败: 仍在使用旧的 columnsWithDetails');
}

console.log('\n' + '='.repeat(60));
console.log('📊 验证总结:');
console.log('='.repeat(60));

const allPassed = excludedColumnsMatch &&
                  excludedSheetMatch &&
                  indexMatch &&
                  redHitCalcMatch &&
                  redHitPushMatch &&
                  calculateRedHitMatch &&
                  !columnsWithDetailsUsage;

if (allPassed) {
    console.log('✅ 所有验证通过！修改实施成功！');
} else {
    console.log('❌ 部分验证失败，请检查上述错误。');
}

console.log('='.repeat(60));
