/**
 * 诊断所有相关表的 ID 字段问题
 * 运行: node diagnose-all-tables.js
 */
const mongoose = require('mongoose');

async function diagnose() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 诊断所有相关表的 ID 字段');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 要检查的表
    const tables = [
        'hit_dlts',
        'hit_dlt_basictrendchart_redballmissing_histories',
        'hit_dlt_basictrendchart_blueballmissing_histories',
        'hit_dlt_combofeatures',
        'HIT_DLT_RedCombinationsHotWarmColdOptimized'
    ];

    for (const tableName of tables) {
        console.log(`\n📋 检查表: ${tableName}`);
        console.log('─'.repeat(60));

        try {
            const collection = db.collection(tableName);
            const count = await collection.countDocuments();

            if (count === 0) {
                console.log('   ⚠️  表为空');
                continue;
            }

            console.log(`   总记录数: ${count}`);

            // 检查最新记录的 ID
            const latest = await collection.findOne({}, { sort: { _id: -1 }, projection: { ID: 1, Issue: 1 } });
            const latestByID = await collection.findOne({}, { sort: { ID: -1 }, projection: { ID: 1, Issue: 1 } });

            console.log(`   最新记录 (按_id): ID=${latest?.ID}, Issue=${latest?.Issue}`);
            console.log(`   最新记录 (按ID):  ID=${latestByID?.ID}, Issue=${latestByID?.Issue}`);

            // 检查 ID 是否有效
            if (latestByID) {
                const idType = typeof latestByID.ID;
                const isNaN = Number.isNaN(latestByID.ID);

                if (idType !== 'number' || isNaN) {
                    console.log(`   ❌ 问题: 最新ID无效! 类型=${idType}, isNaN=${isNaN}`);
                } else {
                    console.log(`   ✅ ID 字段正常`);
                }
            }

            // 查找问题记录
            const allRecords = await collection.find({}).project({ _id: 1, ID: 1, Issue: 1 }).limit(10000).toArray();
            const problems = allRecords.filter(r =>
                r.ID === null ||
                r.ID === undefined ||
                (typeof r.ID === 'number' && Number.isNaN(r.ID)) ||
                typeof r.ID !== 'number'
            );

            if (problems.length > 0) {
                console.log(`   ❌ 发现 ${problems.length} 条问题记录!`);
                problems.slice(0, 3).forEach(r => {
                    console.log(`      - _id: ${r._id}, ID: ${r.ID} (${typeof r.ID}), Issue: ${r.Issue}`);
                });
                if (problems.length > 3) {
                    console.log(`      ... 还有 ${problems.length - 3} 条`);
                }
            }

        } catch (err) {
            console.log(`   ❌ 检查出错: ${err.message}`);
        }
    }

    // 模拟增量更新的关键查询
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('🧪 模拟增量更新关键查询');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. 遗漏值表最新ID
        const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');
        const latestMissing = await missingColl.findOne({}, { sort: { ID: -1 } });
        const latestMissingID = latestMissing ? latestMissing.ID : null;
        console.log(`1. 遗漏值表最新ID: ${latestMissingID} (类型: ${typeof latestMissingID})`);

        if (typeof latestMissingID !== 'number' || Number.isNaN(latestMissingID)) {
            console.log('   ❌ 这就是问题所在! 遗漏值表的最新ID无效!');
        }

        // 2. hit_dlts 最新ID
        const dltColl = db.collection('hit_dlts');
        const latestDlt = await dltColl.findOne({}, { sort: { ID: -1 } });
        console.log(`2. hit_dlts最新ID: ${latestDlt?.ID} (期号: ${latestDlt?.Issue})`);

        // 3. statistics 最新已处理ID
        const latestWithStats = await dltColl.findOne(
            { 'statistics.frontSum': { $exists: true } },
            { sort: { ID: -1 }, projection: { ID: 1, Issue: 1 } }
        );
        console.log(`3. statistics最新已处理ID: ${latestWithStats?.ID || '无'}`);

        // 4. 组合特征表最新ID
        const comboColl = db.collection('hit_dlt_combofeatures');
        const latestCombo = await comboColl.findOne({}, { sort: { ID: -1 } });
        console.log(`4. 组合特征表最新ID: ${latestCombo?.ID || '无'}`);

        // 5. 计算 startID 和 endID
        const lastStatsID = latestWithStats ? latestWithStats.ID : 0;
        const startID = lastStatsID + 1;
        const endID = latestMissingID;

        console.log(`\n📊 增量更新范围计算:`);
        console.log(`   lastStatsID = ${lastStatsID}`);
        console.log(`   startID = lastStatsID + 1 = ${startID}`);
        console.log(`   endID = latestMissingID = ${endID}`);

        if (Number.isNaN(startID) || Number.isNaN(endID)) {
            console.log(`\n   ❌ 发现NaN! 这会导致查询失败!`);
        }

        // 6. 模拟会出问题的查询
        console.log(`\n🧪 测试查询: hit_dlts.find({ ID: { $gte: ${startID}, $lte: ${endID} } })`);

        if (!Number.isNaN(startID) && !Number.isNaN(endID)) {
            const testQuery = await dltColl.find({ ID: { $gte: startID, $lte: endID } }).limit(1).toArray();
            console.log(`   ✅ 查询成功, 找到 ${testQuery.length} 条记录`);
        } else {
            console.log(`   ❌ 无法执行查询 - startID 或 endID 为 NaN`);
        }

    } catch (err) {
        console.log(`\n❌ 模拟查询出错: ${err.message}`);
        console.log(`   错误详情: ${err.stack}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    await mongoose.disconnect();
}

diagnose().catch(err => {
    console.error('❌ 诊断失败:', err.message);
    process.exit(1);
});
