const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 检查热温冷优化表数据...\n');

    // 检查期号对 25107→25108
    const sample = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized')
        .findOne({ base_issue: '25107', target_issue: '25108' });
    console.log('📋 样本检查: 25107→25108优化表数据:', sample ? '✅ 存在' : '❌ 不存在');

    if (sample && sample.hot_warm_cold_data) {
        const ratios = Object.keys(sample.hot_warm_cold_data);
        console.log(`   可用的热温冷比 (共${ratios.length}种):`, ratios.slice(0, 10).join(', '), '...\n');
    }

    // 检查所有需要的期号对
    console.log('📊 检查25108-25124期号对的优化表数据:');
    const pairs = [];
    for (let i = 25108; i <= 25124; i++) {
        pairs.push({ base_issue: (i-1).toString(), target_issue: i.toString() });
    }

    const foundData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized')
        .find({ $or: pairs })
        .toArray();

    const foundMap = new Map(foundData.map(d => [`${d.base_issue}-${d.target_issue}`, d]));

    for (let i = 25108; i <= 25124; i++) {
        const key = `${i-1}-${i}`;
        const exists = foundMap.has(key);
        console.log(`  期号对 ${key}:`, exists ? '✅ 存在' : '❌ 缺失');
    }

    console.log(`\n✅ 总计: 需要${pairs.length}个期号对, 实际找到${foundData.length}个`);

    // 检查25125推算期
    const predict25125 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized')
        .findOne({ base_issue: '25124', target_issue: '25125' });
    console.log(`\n🔮 推算期 25124→25125:`, predict25125 ? '✅ 存在' : '❌ 缺失');

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 连接失败:', err);
    process.exit(1);
});
