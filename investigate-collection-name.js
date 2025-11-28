const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function investigateCollections() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('📊 数据库中的集合:\n');
        const matchingCollections = collections.filter(coll =>
            coll.name.includes('redcombinationshotwarmcoldoptimized')
        );

        if (matchingCollections.length === 0) {
            console.log('❌ 未找到匹配的集合名');
            return;
        }

        console.log('🔍 匹配的集合:');
        for (const coll of matchingCollections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  - ${coll.name} (${count} 条记录)`);
        }

        // 如果找到匹配的集合，详细检查其中一个
        if (matchingCollections.length > 0) {
            const sampleCollection = matchingCollections[0].name;
            const sampleRecords = await db.collection(sampleCollection)
                .find({})
                .limit(10)
                .toArray();

            console.log('\n📋 样本记录示例:');
            sampleRecords.forEach((record, index) => {
                console.log(`记录 ${index + 1}:`);
                console.log(`  base_issue: ${record.base_issue}`);
                console.log(`  target_issue: ${record.target_issue}`);
                console.log(`  is_drawn: ${record.hit_analysis?.is_drawn}`);
            });
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

investigateCollections();