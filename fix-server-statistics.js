/**
 * 修复 server.js 中的 statistics 检查逻辑
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 找到需要修改的代码
const searchStr = "const statisticsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });";
const replaceStr = "const statisticsCount = await hit_dlts.countDocuments({ 'statistics.frontSum': { $exists: true } });";

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(serverPath, content);
    console.log('✅ 修改成功!');
    console.log('   已将 statistics 检查从 { statistics: { $exists: true } }');
    console.log('   修改为 { \'statistics.frontSum\': { $exists: true } }');
} else if (content.includes(replaceStr)) {
    console.log('✅ 代码已经是最新的，无需修改');
} else {
    console.log('❌ 未找到匹配的代码');
    // 搜索附近的代码
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('statisticsCount') && lines[i].includes('countDocuments')) {
            console.log(`   在第 ${i + 1} 行找到类似代码:`);
            console.log(`   ${lines[i]}`);
        }
    }
}
