const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkCollections() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log(`📊 数据库 'lottery' 中的集合:\n`);
        for (const coll of collections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  - ${coll.name} (${count} 条记录)`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkCollections();
