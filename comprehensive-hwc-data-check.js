const mongoose = require('mongoose');

async function comprehensiveHWCCheck() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🔍 全面检查热温冷数据存储位置...\n');

    // 1. 获取数据库中所有集合名称
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('📚 数据库中所有集合:');
    const hwcRelatedCollections = [];
    collections.forEach(col => {
        const name = col.name;
        // 查找所有可能包含HWC的集合
        if (name.toLowerCase().includes('hwc') ||
            name.toLowerCase().includes('hotwarmcold') ||
            name.toLowerCase().includes('热温冷') ||
            name.toLowerCase().includes('optimized')) {
            console.log(`  ✅ ${name} (HWC相关)`);
            hwcRelatedCollections.push(name);
        }
    });

    console.log(`\n找到 ${hwcRelatedCollections.length} 个HWC相关集合`);

    // 2. 检查每个HWC相关集合的数据
    for (const collectionName of hwcRelatedCollections) {
        console.log(`\n📊 检查集合: ${collectionName}`);

        const Model = mongoose.model(collectionName,
            new mongoose.Schema({}, { strict: false }),
            collectionName
        );

        const count = await Model.countDocuments();
        console.log(`  - 总记录数: ${count}`);

        if (count > 0) {
            // 获取样本数据
            const samples = await Model.find().limit(3);
            console.log(`  - 样本数据结构:`);
            samples.forEach((doc, idx) => {
                console.log(`    样本 ${idx + 1}:`);
                const obj = doc.toObject();
                Object.keys(obj).forEach(key => {
                    if (key !== '_id' && key !== '__v') {
                        const value = obj[key];
                        if (typeof value === 'object' && value !== null) {
                            console.log(`      ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
                        } else {
                            console.log(`      ${key}: ${value}`);
                        }
                    }
                });
            });

            // 检查特定期号的数据
            const testQueries = [
                { base_issue: 25116 },
                { base_issue: '25116' },
                { baseIssue: 25116 },
                { base_period: 25116 },
                { period: 25116 },
                { issue: 25116 }
            ];

            console.log(`  - 查找期号 25116 相关数据:`);
            for (const query of testQueries) {
                const result = await Model.findOne(query);
                if (result) {
                    console.log(`    ✅ 找到数据 (查询: ${JSON.stringify(query)})`);
                    break;
                }
            }
        }
    }

    // 3. 特别检查可能的变体名称
    const possibleNames = [
        'HIT_DLT_RedCombinationsHotWarmColdOptimized',
        'hit_dlt_redcombinationshotwarmcoldoptimized',
        'HIT_DLT_HotWarmColdOptimized',
        'hit_dlt_hotwarmcoldoptimized',
        'HIT_DLT_HWCOptimized',
        'hit_dlt_hwcoptimized',
        'HIT_DLT_RedCombinationsHWCOptimized',
        'hit_dlt_redcombinationshwcoptimized'
    ];

    console.log('\n🔍 检查可能的集合名称变体:');
    for (const name of possibleNames) {
        try {
            const Model = mongoose.model(name,
                new mongoose.Schema({}, { strict: false }),
                name
            );
            const count = await Model.countDocuments();
            if (count > 0) {
                console.log(`  ✅ ${name}: ${count} 条记录`);

                // 查找25116相关数据
                const data = await Model.findOne({
                    $or: [
                        { base_issue: 25116 },
                        { base_issue: '25116' },
                        { baseIssue: 25116 },
                        { baseIssue: '25116' }
                    ]
                });

                if (data) {
                    console.log(`    - 找到25116数据: ${JSON.stringify(data).substring(0, 200)}...`);
                }
            }
        } catch (err) {
            // 集合不存在，继续
        }
    }

    // 4. 检查任务结果中的热温冷数据
    console.log('\n🔍 检查任务结果中的热温冷数据:');

    const TaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult',
        new mongoose.Schema({}, { strict: false }),
        'HIT_DLT_HwcPositivePredictionTaskResults'
    );

    const resultCount = await TaskResult.countDocuments();
    console.log(`  任务结果总数: ${resultCount}`);

    // 检查最近的结果
    const recentResults = await TaskResult.find({
        period: { $gte: 25115, $lte: 25125 }
    }).limit(5);

    console.log(`  25115-25125期间的结果:`);
    recentResults.forEach(result => {
        console.log(`    - 期号 ${result.period}: 组合数 ${result.combination_count || result.red_combinations?.length || 0}`);
    });

    // 5. 直接查询原始数据库，看看实际有哪些数据
    console.log('\n🔍 直接查询数据库统计信息:');
    const stats = await db.stats();
    console.log(`  数据库大小: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  集合数量: ${stats.collections}`);

    await mongoose.connection.close();
}

comprehensiveHWCCheck().catch(console.error);