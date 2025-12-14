/**
 * 修复所有 Issue 排序问题
 * 将 sort({ Issue: -1 }) 改为 sort({ ID: -1 }) 用于获取最新记录
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

let fixCount = 0;

// 修复1: cleanupUnifiedExpiredCache 中的排序
const fix1Old = "const latestIssue = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('Issue');";
const fix1New = "const latestIssue = await hit_dlts.findOne({}).sort({ ID: -1 }).select('Issue');  // 修复: ID排序";
if (content.includes(fix1Old)) {
    content = content.replace(fix1Old, fix1New);
    fixCount++;
    console.log('修复1: cleanupUnifiedExpiredCache');
}

// 修复2: verifyUnifiedData 中的排序
const fix2Old = "const dltLatest = await hit_dlts.findOne({}).sort({ Issue: -1 });";
const fix2New = "const dltLatest = await hit_dlts.findOne({}).sort({ ID: -1 });  // 修复: ID排序";
if (content.includes(fix2Old)) {
    content = content.replace(fix2Old, fix2New);
    fixCount++;
    console.log('修复2: verifyUnifiedData');
}

// 修复3: 其他可能的问题 - 获取最新期号的查询
const patterns = [
    // 常见的获取最新期号模式
    {
        old: "const mainLatest = await hit_dlts.findOne({}).sort({ Issue: -1 });",
        new: "const mainLatest = await hit_dlts.findOne({}).sort({ ID: -1 });  // 修复: ID排序"
    },
    {
        old: "const latestIssue = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('Issue');",
        new: "const latestIssue = await hit_dlts.findOne({}).sort({ ID: -1 }).select('Issue');  // 修复: ID排序"
    }
];

patterns.forEach((p, i) => {
    if (content.includes(p.old)) {
        content = content.replace(new RegExp(escapeRegExp(p.old), 'g'), p.new);
        fixCount++;
        console.log(`修复${i+3}: 其他位置`);
    }
});

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n总计修复 ${fixCount} 处`);
