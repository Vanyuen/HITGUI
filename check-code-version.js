const fs = require('fs');
const path = require('path');

console.log('🔍 检查server.js代码版本...\n');

const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
const content = fs.readFileSync(serverPath, 'utf-8');

// 检查关键修复点
console.log('📋 检查关键修复点:\n');

// 1. 检查集合名修复（第512行）
const line512 = content.split('\n')[511];  // 数组索引从0开始
console.log('1. 集合名修复（第512行）:');
if (line512.includes("'hit_dlt_redcombinationshotwarmcoldoptimizeds'")) {
    console.log('   ✅ 已修复：包含正确的集合名参数');
    console.log(`   代码: ${line512.substring(0, 100)}...`);
} else {
    console.log('   ❌ 未修复：缺少集合名参数');
    console.log(`   代码: ${line512}`);
}

// 2. 检查增强日志（第15078行附近）
const logEnhancement = content.includes('期号对列表:') && content.includes('查询到');
console.log('\n2. 增强日志（preloadHwcOptimizedData方法）:');
if (logEnhancement) {
    console.log('   ✅ 已添加：包含详细的调试日志');
} else {
    console.log('   ❌ 未添加：缺少增强日志');
}

// 3. 检查base期查询修复（第16341行附近）
const basePeriodFix = content.includes('🔧 2025-11-17修复: 分两步查询');
console.log('\n3. base期查询修复（preloadData方法）:');
if (basePeriodFix) {
    console.log('   ✅ 已修复：使用两步查询逻辑');

    // 查找具体代码
    const lines = content.split('\n');
    const fixLineIndex = lines.findIndex(l => l.includes('🔧 2025-11-17修复'));
    if (fixLineIndex !== -1) {
        console.log(`   位置: 第${fixLineIndex + 1}行`);
        console.log('   代码片段:');
        for (let i = fixLineIndex; i < fixLineIndex + 5; i++) {
            if (lines[i]) {
                console.log(`     ${lines[i].trim()}`);
            }
        }
    }
} else {
    console.log('   ❌ 未修复：仍使用旧的查询逻辑');
}

// 4. 统计备份文件
console.log('\n📁 备份文件:');
const backupFiles = fs.readdirSync('src/server').filter(f =>
    f.startsWith('server.js.backup')
);
console.log(`   共${backupFiles.length}个备份:`);
backupFiles.forEach(f => {
    const stat = fs.statSync(path.join('src', 'server', f));
    console.log(`   - ${f} (${new Date(stat.mtime).toLocaleString()})`);
});

console.log('\n📊 总结:');
const allFixed = line512.includes("'hit_dlt_redcombinationshotwarmcoldoptimizeds'") &&
                 logEnhancement &&
                 basePeriodFix;

if (allFixed) {
    console.log('   ✅ 所有修复都已应用到代码中');
    console.log('   ⚠️ 如果问题仍存在，可能是：');
    console.log('      1. 服务器没有重启');
    console.log('      2. Electron应用缓存了旧代码');
    console.log('      3. 运行时出现错误导致修复代码未执行');
} else {
    console.log('   ❌ 部分修复未应用，需要重新修复');
}
