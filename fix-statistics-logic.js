// 修改 server.js 中的 incrementalUpdateStatistics 函数
const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverJsPath, 'utf8');

const oldFunction = `async function incrementalUpdateStatistics() {
    log('═══════════════════════════════════════════════════════════════');
    log('📊 增量更新statistics字段');
    log('═══════════════════════════════════════════════════════════════\\n');

    const db = mongoose.connection.db;

    // 1. 查找缺少statistics字段的记录
    const recordsWithoutStats = await hit_dlts.find({
        $or: [
            { statistics: { $exists: false } },
            { 'statistics.frontSum': { $exists: false } }
        ]
    }).sort({ ID: 1 }).lean();

    if (recordsWithoutStats.length === 0) {
        log('✅ statistics字段已是最新，无需更新\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(\`📦 需要处理 \${recordsWithoutStats.length} 条记录\\n\`);

    // 2. 获取遗漏值映射（用于热温冷比计算）
    const missingMap = new Map();
    const allMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}).toArray();
    allMissing.forEach(r => missingMap.set(r.ID, r));
    log(\`📥 已加载 \${allMissing.length} 条遗漏值记录\`);

    // 3. 获取所有记录用于计算重号
    const allRecordsMap = new Map();
    const allRecords = await hit_dlts.find({}).sort({ ID: 1 }).select('ID Red1 Red2 Red3 Red4 Red5').lean();
    allRecords.forEach(r => allRecordsMap.set(r.ID, r));

    // 4. 逐条更新
    let updateCount = 0;
    for (let i = 0; i < recordsWithoutStats.length; i++) {
        const record = recordsWithoutStats[i];`;

const newFunction = `async function incrementalUpdateStatistics() {
    log('═══════════════════════════════════════════════════════════════');
    log('📊 增量更新statistics字段');
    log('═══════════════════════════════════════════════════════════════\\n');

    const db = mongoose.connection.db;

    // 1. 获取遗漏值表最新ID（作为已处理数据的标记）
    const latestMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({}, { sort: { ID: -1 } });

    if (!latestMissing) {
        log('⚠️  遗漏值表为空，请先更新遗漏值表\\n');
        return { newRecords: 0, message: '遗漏值表为空' };
    }

    const latestMissingID = latestMissing.ID;
    log(\`📊 遗漏值表最新ID: \${latestMissingID}\`);

    // 2. 查找需要更新statistics的记录（基于遗漏值表最新ID）
    // 查找: ID在遗漏值范围内 且 缺少statistics字段的记录
    const latestWithStats = await hit_dlts.findOne(
        { 'statistics.frontSum': { $exists: true } },
        { sort: { ID: -1 } }
    );
    const lastStatsID = latestWithStats ? latestWithStats.ID : 0;
    log(\`📊 statistics最新已处理ID: \${lastStatsID}\`);

    // 只处理: lastStatsID < ID <= latestMissingID 的记录
    const startID = lastStatsID + 1;
    const endID = latestMissingID;

    if (startID > endID) {
        log('✅ statistics字段已是最新，无需更新\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    const recordsToUpdate = await hit_dlts.find({
        ID: { $gte: startID, $lte: endID }
    }).sort({ ID: 1 }).lean();

    if (recordsToUpdate.length === 0) {
        log('✅ 无需更新的记录\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(\`📦 需要处理 \${recordsToUpdate.length} 条记录 (ID: \${startID} ~ \${endID})\\n\`);

    // 3. 获取遗漏值映射（用于热温冷比计算）
    const missingMap = new Map();
    const allMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}).toArray();
    allMissing.forEach(r => missingMap.set(r.ID, r));
    log(\`📥 已加载 \${allMissing.length} 条遗漏值记录\`);

    // 4. 获取所有记录用于计算重号
    const allRecordsMap = new Map();
    const allRecords = await hit_dlts.find({}).sort({ ID: 1 }).select('ID Red1 Red2 Red3 Red4 Red5').lean();
    allRecords.forEach(r => allRecordsMap.set(r.ID, r));

    // 5. 逐条更新
    let updateCount = 0;
    for (let i = 0; i < recordsToUpdate.length; i++) {
        const record = recordsToUpdate[i];`;

if (content.includes(oldFunction)) {
    content = content.replace(oldFunction, newFunction);
    fs.writeFileSync(serverJsPath, content, 'utf8');
    console.log('✅ 成功修改 incrementalUpdateStatistics 函数');
} else {
    console.log('❌ 未找到目标函数，尝试备用方案...');

    // 备用方案：查找并替换关键部分
    const oldPart1 = `    // 1. 查找缺少statistics字段的记录
    const recordsWithoutStats = await hit_dlts.find({
        $or: [
            { statistics: { $exists: false } },
            { 'statistics.frontSum': { $exists: false } }
        ]
    }).sort({ ID: 1 }).lean();

    if (recordsWithoutStats.length === 0) {
        log('✅ statistics字段已是最新，无需更新\\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(\`📦 需要处理 \${recordsWithoutStats.length} 条记录\\n\`);`;

    const newPart1 = `    // 1. 获取遗漏值表最新ID（作为已处理数据的标记）
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

    log(\`📦 需要处理 \${recordsWithoutStats.length} 条记录 (ID: \${startID} ~ \${endID})\\n\`);`;

    if (content.includes(oldPart1)) {
        content = content.replace(oldPart1, newPart1);
        fs.writeFileSync(serverJsPath, content, 'utf8');
        console.log('✅ 使用备用方案成功修改');
    } else {
        console.log('❌ 备用方案也失败');
        // 输出查找信息
        const lines = content.split('\n');
        for (let i = 29240; i < 29260 && i < lines.length; i++) {
            console.log(`${i}: ${lines[i].substring(0, 60)}...`);
        }
    }
}
