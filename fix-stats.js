const fs = require('fs');

let content = fs.readFileSync('src/server/server.js', 'utf8');

// 查找并替换
const searchStr = '// 1. 查找缺少statistics字段的记录';
const replaceRegion = /\/\/ 1\. 查找缺少statistics字段的记录[\s\S]*?log\(`📥 已加载 \$\{allMissing\.length\} 条遗漏值记录`\)/;

const newCode = `// 1. 获取遗漏值表最新ID（作为已处理数据的标记）
    const latestMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({}, { sort: { ID: -1 } });

    if (!latestMissing) {
        log('⚠️  遗漏值表为空，请先更新遗漏值表\\n');
        return { newRecords: 0, message: '遗漏值表为空' };
    }

    const latestMissingID = latestMissing.ID;
    log(\`📊 遗漏值表最新ID: \${latestMissingID}\`);

    // 2. 查找需要更新statistics的记录（基于ID范围）
    const latestWithStats = await hit_dlts.findOne(
        { 'statistics.frontSum': { $exists: true } },
        { sort: { ID: -1 } }
    );
    const lastStatsID = latestWithStats ? latestWithStats.ID : 0;
    log(\`📊 statistics最新已处理ID: \${lastStatsID}\`);

    const startID = lastStatsID + 1;
    const endID = latestMissingID;

    if (startID > endID) {
        log('✅ statistics字段已是最新，无需更新\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    const recordsWithoutStats = await hit_dlts.find({
        ID: { $gte: startID, $lte: endID }
    }).sort({ ID: 1 }).lean();

    if (recordsWithoutStats.length === 0) {
        log('✅ 无需更新的记录\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(\`📦 需要处理 \${recordsWithoutStats.length} 条记录 (ID: \${startID} ~ \${endID})\\n\`);

    // 3. 获取遗漏值映射（用于热温冷比计算）
    const missingMap = new Map();
    const allMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}).toArray();
    allMissing.forEach(r => missingMap.set(r.ID, r));
    log(\`📥 已加载 \${allMissing.length} 条遗漏值记录\`)`;

if (content.includes(searchStr)) {
    content = content.replace(replaceRegion, newCode);
    fs.writeFileSync('src/server/server.js', content, 'utf8');
    console.log('✅ 成功修改statistics增量逻辑');
} else {
    console.log('❌ 未找到目标代码');
}
