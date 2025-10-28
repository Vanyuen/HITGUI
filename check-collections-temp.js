const mongoose = require('mongoose');

async function checkCollections() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const collections = await mongoose.connection.db.listCollections().toArray();

        console.log('所有集合列表:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        for (const coll of collections) {
            const count = await mongoose.connection.db.collection(coll.name).countDocuments();
            console.log(`  ${coll.name}: ${count}条记录`);
        }

        console.log('\n包含"red"或"combination"的集合:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const filtered = collections.filter(c =>
            c.name.includes('red') || c.name.includes('combination')
        );

        if (filtered.length === 0) {
            console.log('  未找到相关集合');
        } else {
            for (const coll of filtered) {
                const count = await mongoose.connection.db.collection(coll.name).countDocuments();
                console.log(`  ${coll.name}: ${count}条记录`);
            }
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkCollections();
