const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function finalDLTSourceDiagnosis() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🕵️ 大乐透数据源最终诊断\n');

    // 1. 检查迁移相关文件
    const migrationScripts = [
        'migrate-dlt-data.js',
        'migrate-add-dlt-statistics.js'
    ];

    console.log('📄 迁移脚本检查:');
    migrationScripts.forEach(script => {
        const scriptPath = path.join('E:\\HITGUI', script);
        if (fs.existsSync(scriptPath)) {
            const stats = fs.statSync(scriptPath);
            console.log(`  ✅ ${script}`);
            console.log(`    修改日期: ${stats.mtime}`);
            console.log(`    大小: ${stats.size} 字节`);
        } else {
            console.log(`  ❌ ${script} 不存在`);
        }
    });

    // 2. 检查数据库集合
    console.log('\n🔍 大乐透相关集合:');
    const collections = await db.listCollections().toArray();
    const dltCollections = collections.filter(coll =>
        coll.name.toLowerCase().includes('dlt') ||
        coll.name.includes('lottery')
    );

    dltCollections.forEach(async (coll) => {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`  ${coll.name}: ${count} 条记录`);
    });

    // 3. hit_dlts 集合详细分析
    const hitDlts = db.collection('hit_dlts');
    const totalCount = await hitDlts.countDocuments();
    const timeSpan = await hitDlts.aggregate([
        { $group: {
            _id: null,
            earliestIssue: { $min: "$Issue" },
            latestIssue: { $max: "$Issue" },
            earliestDate: { $min: "$DrawDate" },
            latestDate: { $max: "$DrawDate" }
        }}
    ]).toArray();

    console.log('\n📊 hit_dlts 集合数据概览:');
    console.log(`  总记录数: ${totalCount}`);
    console.log(`  期号范围: ${timeSpan[0].earliestIssue} - ${timeSpan[0].latestIssue}`);
    console.log(`  日期范围: ${timeSpan[0].earliestDate} - ${timeSpan[0].latestDate}`);

    // 4. 检查迁移痕迹
    const migrationTraceQueries = [
        { statistics: { $exists: true } },
        { TotalSales: { $exists: true } },
        { ID: { $exists: true, $ne: null } }
    ];

    console.log('\n🕰️ 迁移痕迹检查:');
    for (const query of migrationTraceQueries) {
        const count = await hitDlts.countDocuments(query);
        console.log(`  匹配 ${JSON.stringify(query)}: ${count} 条记录`);
    }

    // 5. 最后一条记录详情
    const lastRecord = await hitDlts.findOne({}, { sort: { Issue: -1 } });
    console.log('\n🏁 最后一条记录:');
    console.log(`  期号: ${lastRecord.Issue}`);
    console.log(`  开奖日期: ${lastRecord.DrawDate}`);
    console.log(`  红球: ${lastRecord.Red1},${lastRecord.Red2},${lastRecord.Red3},${lastRecord.Red4},${lastRecord.Red5}`);
    console.log(`  蓝球: ${lastRecord.Blue1},${lastRecord.Blue2}`);

    await mongoose.connection.close();
}

finalDLTSourceDiagnosis().catch(console.error);