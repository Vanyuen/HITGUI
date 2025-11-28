#!/usr/bin/env node

const mongoose = require('mongoose');

async function checkCollectionNames() {
    console.log('\n🔍 检查数据库中的 collection 名称\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;

    console.log('='.repeat(70));
    console.log('所有热温冷相关 collection:');
    console.log('='.repeat(70));

    const collections = await db.listCollections().toArray();
    const hwcCollections = collections.filter(c =>
        c.name.toLowerCase().includes('hotwarmcold') ||
        c.name.toLowerCase().includes('hwc')
    );

    for (const coll of hwcCollections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`\n📁 ${coll.name}`);
        console.log(`   记录数: ${count.toLocaleString()}`);

        if (count > 0) {
            const sample = await db.collection(coll.name).findOne({});
            console.log(`   示例字段:`, Object.keys(sample).slice(0, 10).join(', '));
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('结论');
    console.log('='.repeat(70));

    const optimized = hwcCollections.find(c =>
        c.name.toLowerCase().includes('optimized')
    );

    if (optimized) {
        console.log(`\n✅ 实际数据库 collection 名称: ${optimized.name}`);
        console.log(`⚠️  Schema 中定义的名称: hit_dlt_redcombinationshotwarmcoldoptimizeds`);

        if (optimized.name !== 'hit_dlt_redcombinationshotwarmcoldoptimizeds') {
            console.log(`\n❌ 名称不匹配！这就是为什么查询返回0的原因。`);
        }
    }

    await mongoose.disconnect();
}

checkCollectionNames().catch(console.error);
