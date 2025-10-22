// 列出所有MongoDB集合
require('dotenv').config();
const mongoose = require('mongoose');

async function listCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('📚 数据库中的集合:');
        for (const coll of collections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  ${coll.name}: ${count.toLocaleString()} 条记录`);
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

listCollections();
