const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 认真检查数据库中的热温冷相关集合...\n');

    // 1. 列出所有集合名称
    const collections = await db.listCollections().toArray();
    console.log('📋 所有集合列表 (共' + collections.length + '个):');

    const hwcRelated = collections.filter(c =>
        c.name.toLowerCase().includes('hwc') ||
        c.name.toLowerCase().includes('hot') ||
        c.name.toLowerCase().includes('warm') ||
        c.name.toLowerCase().includes('cold') ||
        c.name.toLowerCase().includes('optimized')
    );

    console.log('\n🌡️ 热温冷相关的集合:');
    if (hwcRelated.length === 0) {
        console.log('  ❌ 没有找到热温冷相关的集合');
    } else {
        for (const col of hwcRelated) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`  ✅ ${col.name} (${count} 条记录)`);
        }
    }

    // 2. 检查代码中使用的表名
    console.log('\n📝 代码中查询的集合名称:');
    console.log('  代码查询: hit_dlt_redcombinationshotwarmcoldoptimized');

    // 3. 尝试不同的可能表名
    console.log('\n🔍 尝试查找可能的表名:');
    const possibleNames = [
        'hit_dlt_redcombinationshotwarmcoldoptimized',
        'hit_dlt_redcombinationshotwarmcoldOptimized',
        'HIT_DLT_RedCombinationsHotWarmColdOptimized',
        'dltredcombinationshotwarmcoldoptimized',
        'DLTRedCombinationsHotWarmColdOptimized',
        'hit_dlt_red_combinations_hot_warm_cold_optimized',
        'RedCombinationsHotWarmColdOptimized'
    ];

    for (const name of possibleNames) {
        try {
            const count = await db.collection(name).countDocuments();
            if (count > 0) {
                console.log(`  ✅ ${name}: ${count} 条记录`);

                // 显示一条样本数据
                const sample = await db.collection(name).findOne();
                console.log(`     样本字段:`, Object.keys(sample));
            } else {
                console.log(`  ⚪ ${name}: 存在但为空`);
            }
        } catch (err) {
            console.log(`  ❌ ${name}: 不存在`);
        }
    }

    // 4. 检查 Schema 定义
    console.log('\n📊 检查是否有期号对数据 (25123→25124):');
    for (const name of possibleNames) {
        try {
            const data = await db.collection(name).findOne({
                $or: [
                    { base_issue: '25123', target_issue: '25124' },
                    { base_issue: 25123, target_issue: 25124 },
                    { baseIssue: '25123', targetIssue: '25124' },
                    { baseIssue: 25123, targetIssue: 25124 }
                ]
            });
            if (data) {
                console.log(`  ✅ ${name}:`);
                console.log(`     base_issue/baseIssue: ${data.base_issue || data.baseIssue}`);
                console.log(`     target_issue/targetIssue: ${data.target_issue || data.targetIssue}`);
                console.log(`     数据字段:`, Object.keys(data));
            }
        } catch (err) {
            // 忽略
        }
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 连接失败:', err);
    process.exit(1);
});
