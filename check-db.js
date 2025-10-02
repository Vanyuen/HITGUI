const mongoose = require('mongoose');

async function checkDatabase() {
    try {
        // 连接到本地MongoDB
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 成功连接到本地MongoDB');

        // 检查数据库信息
        const db = mongoose.connection.db;
        const stats = await db.stats();

        console.log('\n📊 数据库统计信息:');
        console.log(`数据库名: ${stats.db}`);
        console.log(`集合数量: ${stats.collections}`);
        console.log(`数据大小: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);

        // 列出所有集合
        const collections = await db.listCollections().toArray();
        console.log('\n📋 现有集合:');

        if (collections.length === 0) {
            console.log('❌ 暂无数据集合');
        } else {
            for (const collection of collections) {
                const count = await db.collection(collection.name).countDocuments();
                console.log(`- ${collection.name}: ${count} 条记录`);
            }
        }

        // 检查是否存在项目需要的集合
        const requiredCollections = [
            'hit_unionlottoes',      // HIT_UnionLotto
            'hit_dlts',              // HIT_DLT
            'hit_dlt_redcombinations',
            'hit_dlt_bluecombinations'
        ];

        console.log('\n🔍 项目所需集合检查:');
        for (const collectionName of requiredCollections) {
            const exists = collections.some(c => c.name.toLowerCase() === collectionName.toLowerCase());
            console.log(`${exists ? '✅' : '❌'} ${collectionName}: ${exists ? '存在' : '不存在'}`);
        }

    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkDatabase();