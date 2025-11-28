const mongoose = require('mongoose');

async function checkDataImportLogic() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🔍 大乐透数据导入逻辑检查\n');

    // 检查所有大乐透相关集合
    const dltCollections = [
        'hit_dlts',
        'hit_dlts',
        'hit_dlts',
        'hit_dlts'
    ];

    console.log('📊 各集合记录数统计:');
    for (const collName of dltCollections) {
        try {
            const count = await db.collection(collName).countDocuments();
            console.log(`  ${collName}: ${count} 条记录`);
        } catch (error) {
            console.log(`  ${collName}: 查询失败 (${error.message})`);
        }
    }

    // 检查 hit_dlts 集合的详细信息
    console.log('\n🔬 hit_dlts 集合详细信息:');
    const hitDlts = await db.collection('hit_dlts').find({})
        .sort({ ID: 1 })
        .limit(5)
        .toArray();

    console.log('前5条记录:');
    hitDlts.forEach(doc => {
        console.log(`  期号: ${doc.Issue}, ID: ${doc.ID}, 开奖日期: ${doc.DrawDate}`);
        console.log(`  红球: ${doc.Red1},${doc.Red2},${doc.Red3},${doc.Red4},${doc.Red5}`);
        console.log(`  蓝球: ${doc.Blue1},${doc.Blue2}`);
        console.log('─'.repeat(40));
    });

    // 查找所有大乐透相关的集合
    console.log('\n📁 所有大乐透相关集合:');
    const collections = await db.listCollections().toArray();
    const dltRelatedCollections = collections
        .filter(coll =>
            coll.name.toLowerCase().includes('dlt') ||
            coll.name.toLowerCase().includes('lottery')
        )
        .map(coll => coll.name);

    console.log(dltRelatedCollections.join(', '));

    await mongoose.connection.close();
}

checkDataImportLogic().catch(console.error);