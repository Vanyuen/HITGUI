/**
 * 验证应用是否加载了修复后的代码
 * 通过检查server.js的修改时间和内容
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src', 'server', 'server.js');

console.log('🔍 检查代码文件...\n');

// 检查文件存在
if (!fs.existsSync(serverPath)) {
    console.log('❌ 找不到 server.js 文件');
    process.exit(1);
}

// 获取文件修改时间
const stats = fs.statSync(serverPath);
const modifiedTime = stats.mtime;
console.log(`📝 server.js 最后修改时间: ${modifiedTime.toLocaleString('zh-CN')}`);

// 检查文件内容
const content = fs.readFileSync(serverPath, 'utf-8');

// 检查关键修复点
const checks = [
    {
        name: '核心修复：await Promise.all',
        pattern: /await Promise\.all\(\s*exclusionsToSave\.map/,
        expected: true
    },
    {
        name: '日志消息：正在保存排除详情',
        pattern: /log\(`\s*💾 正在保存排除详情/,
        expected: true
    },
    {
        name: '日志消息：排除详情保存完成',
        pattern: /log\(`\s*✅ 排除详情保存完成/,
        expected: true
    },
    {
        name: 'Sheet2查询范围：Step 2-10',
        pattern: /step:\s*\{\s*\$in:\s*\[2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9,\s*10\]/,
        expected: true
    },
    {
        name: 'Step 2 detailsMap',
        pattern: /detailsMap: detailsMap\s*\/\/ ⭐ 传递详细原因/,
        expected: true
    },
    {
        name: '旧代码：Promise.all 无 await（应该不存在）',
        pattern: /Promise\.all\(\s*exclusionsToSave\.map[^]*?\)\.then\(/,
        expected: false
    }
];

console.log('\n📊 代码检查结果:\n');

let allPassed = true;
for (const check of checks) {
    const found = check.pattern.test(content);
    const passed = found === check.expected;

    const status = passed ? '✅' : '❌';
    const foundText = check.expected ? (found ? '找到' : '未找到') : (found ? '仍存在' : '已移除');

    console.log(`${status} ${check.name}: ${foundText}`);

    if (!passed) {
        allPassed = false;
    }
}

console.log('\n' + '='.repeat(70));
if (allPassed) {
    console.log('✅ 所有修复都已应用到代码文件中！');
    console.log('\n⚠️ 但任务仍然没有保存排除详情，可能的原因:');
    console.log('1. 应用没有重新加载 server.js 模块（Node.js 缓存）');
    console.log('2. 排除详情保存时出错（检查应用控制台日志）');
    console.log('3. exclusionsToSave 数组为空（正选/排除条件未生效）');
    console.log('\n💡 解决方案:');
    console.log('1. 检查应用控制台，是否有 "💾 正在保存排除详情" 的日志？');
    console.log('2. 检查应用控制台，是否有任何错误信息？');
    console.log('3. 尝试删除 node_modules/.cache 文件夹（如果存在）');
    console.log('4. 完全关闭应用，重启电脑，然后重新启动应用');
} else {
    console.log('❌ 部分修复未应用到代码文件！');
    console.log('   这不应该发生，因为我们之前已经应用了修复。');
    console.log('   可能是文件被意外覆盖了。');
}
console.log('='.repeat(70));

// 显示文件大小和行数
const lines = content.split('\n').length;
const sizeKB = (stats.size / 1024).toFixed(2);
console.log(`\n📏 文件信息:`);
console.log(`   大小: ${sizeKB} KB`);
console.log(`   行数: ${lines}`);
console.log(`   路径: ${serverPath}`);
