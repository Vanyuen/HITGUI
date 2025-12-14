/**
 * 全面修复 hit_dlts 表的 Issue 排序问题
 *
 * 问题根因：Issue 字段是字符串类型，使用 sort({ Issue: -1 }) 会导致
 * 字符串比较（"9153" > "25139"）而非数值比较（9153 < 25139）
 *
 * 解决方案：将所有 hit_dlts 相关查询的 sort({ Issue: -1 }) 改为 sort({ ID: -1 })
 * 因为 ID 是数值类型且连续递增，可以正确表示期号顺序
 *
 * 运行: node fix-all-hit-dlts-sorting.js
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

let fixCount = 0;
const fixes = [];

// 定义需要修复的模式（针对 hit_dlts 表的查询）
const patterns = [
    // hit_dlts.find({}).sort({ Issue: -1 }) 模式
    {
        desc: 'hit_dlts.find({}).sort({ Issue: -1 })',
        old: 'hit_dlts.find({}).sort({ Issue: -1 })',
        new: 'hit_dlts.find({}).sort({ ID: -1 })'
    },
    // hit_dlts.find({})\\n.sort({ Issue: -1 }) 多行模式
    {
        desc: 'hit_dlts.find(query).sort({ Issue: -1 })',
        old: /hit_dlts\.find\(query\)\s*\n\s*\.sort\(\{\s*Issue:\s*-1\s*\}\)/g,
        new: 'hit_dlts.find(query)\n                .sort({ ID: -1 })'
    },
    // await hit_dlts.find({}).sort({ Issue: -1 }).limit
    {
        desc: 'await hit_dlts.find...sort Issue -1 (单行)',
        old: /await hit_dlts\.find\(\{\}\)\.sort\(\{\s*Issue:\s*-1\s*\}\)\.limit/g,
        new: 'await hit_dlts.find({}).sort({ ID: -1 }).limit'
    },
    // .select('Issue')\\n.sort({ Issue: -1 })
    {
        desc: 'select...sort({ Issue: -1 })',
        old: /\.select\('Issue'\)\s*\n\s*\.sort\(\{\s*Issue:\s*-1\s*\}\)/g,
        new: ".select('Issue')\n            .sort({ ID: -1 })"
    },
    // hit_dlts.findOne({}).sort({ Issue: -1 })
    {
        desc: 'hit_dlts.findOne({}).sort({ Issue: -1 })',
        old: /hit_dlts\.findOne\(\{\}\)\.sort\(\{\s*Issue:\s*-1\s*\}\)/g,
        new: 'hit_dlts.findOne({}).sort({ ID: -1 })'
    },
    // hit_dlts.findOne({Issue: ...}).sort({ Issue: -1 })
    {
        desc: 'hit_dlts.findOne({Issue:...}).sort({ Issue: -1 })',
        old: /hit_dlts\.findOne\(\{Issue:\s*\{[^}]+\}\}\)\.sort\(\{Issue:\s*-1\}\)/g,
        new: function(match) {
            return match.replace(/\.sort\(\{Issue:\s*-1\}\)/, '.sort({ID: -1})');
        }
    }
];

// 逐行检查并修复
const lines = content.split('\n');
const fixedLines = [];
const lineFixLog = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNum = i + 1;

    // 跳过 UnionLotto (SSQ) 相关查询 - 那是双色球表
    if (line.includes('UnionLotto')) {
        fixedLines.push(line);
        continue;
    }

    // 跳过已经使用 ID 排序的行
    if (line.includes('sort({ ID: -1 })') || line.includes('.sort({ ID: 1 })')) {
        fixedLines.push(line);
        continue;
    }

    // 修复 hit_dlts 相关的 sort({ Issue: -1 })
    if (line.includes('hit_dlts') && line.includes('sort') && line.includes('Issue: -1')) {
        const oldLine = line;
        line = line.replace(/sort\(\{\s*Issue:\s*-1\s*\}\)/g, 'sort({ ID: -1 })');
        if (line !== oldLine) {
            fixCount++;
            lineFixLog.push(`行 ${lineNum}: ${oldLine.trim().substring(0, 80)}...`);
        }
    }

    // 处理多行查询中的 .sort({ Issue: -1 })
    // 上下文判断：检查前5行是否有 hit_dlts
    if (line.includes('.sort({ Issue: -1 })') || line.match(/\.sort\(\{\s*Issue:\s*-1\s*\}\)/)) {
        let isHitDltsQuery = false;
        for (let j = Math.max(0, i - 5); j <= i; j++) {
            if (lines[j] && lines[j].includes('hit_dlts')) {
                isHitDltsQuery = true;
                break;
            }
        }

        if (isHitDltsQuery) {
            const oldLine = line;
            line = line.replace(/\.sort\(\{\s*Issue:\s*-1\s*\}\)/g, '.sort({ ID: -1 })');
            if (line !== oldLine) {
                fixCount++;
                lineFixLog.push(`行 ${lineNum}: ${oldLine.trim().substring(0, 80)}...`);
            }
        }
    }

    fixedLines.push(line);
}

content = fixedLines.join('\n');

// 特殊处理：修复 select('Issue Red1...').sort({ Issue: -1 })
const selectSortPattern = /\.select\('Issue Red1 Red2 Red3 Red4 Red5'\)\.sort\(\{\s*Issue:\s*-1\s*\}\)/g;
let selectMatch;
while ((selectMatch = selectSortPattern.exec(content)) !== null) {
    content = content.replace(selectMatch[0], ".select('Issue Red1 Red2 Red3 Red4 Red5').sort({ ID: -1 })");
    fixCount++;
    lineFixLog.push(`特殊: select('Issue Red1...').sort({ Issue: -1 }) 模式`);
}

// 写入修复后的文件
if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ hit_dlts 表 Issue 排序问题全面修复完成');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`📊 总计修复: ${fixCount} 处\n`);
    console.log('📝 修复详情:');
    lineFixLog.slice(0, 20).forEach(log => console.log(`   ${log}`));
    if (lineFixLog.length > 20) {
        console.log(`   ... 还有 ${lineFixLog.length - 20} 处`);
    }
    console.log('\n⚠️  注意: 修复不影响 UnionLotto (双色球) 表的查询');
} else {
    console.log('✅ 没有发现需要修复的 Issue 排序问题');
}

// 验证修复结果
console.log('\n════════════════════════════════════════════════════════════');
console.log('🔍 验证修复结果...');
console.log('════════════════════════════════════════════════════════════\n');

const verifyContent = fs.readFileSync(filePath, 'utf8');

// 检查是否还有遗漏的 hit_dlts sort({ Issue: -1 })
const remainingIssues = [];
const verifyLines = verifyContent.split('\n');
for (let i = 0; i < verifyLines.length; i++) {
    const line = verifyLines[i];
    const lineNum = i + 1;

    // 跳过 UnionLotto
    if (line.includes('UnionLotto')) continue;

    if (line.includes('sort({ Issue: -1 })') || line.includes('sort({Issue: -1})')) {
        // 检查上下文是否与 hit_dlts 相关
        let context = '';
        for (let j = Math.max(0, i - 3); j <= Math.min(verifyLines.length - 1, i + 1); j++) {
            context += verifyLines[j] + ' ';
        }
        if (context.includes('hit_dlts') || context.includes('DLT') || context.includes('大乐透')) {
            remainingIssues.push(`行 ${lineNum}: ${line.trim().substring(0, 80)}`);
        }
    }
}

if (remainingIssues.length > 0) {
    console.log('⚠️  仍有以下位置可能需要手动检查:');
    remainingIssues.forEach(issue => console.log(`   ${issue}`));
} else {
    console.log('✅ 所有 hit_dlts 相关查询的 Issue 排序已修复为 ID 排序');
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('修复完成！请运行 node --check src/server/server.js 验证语法');
console.log('════════════════════════════════════════════════════════════\n');
