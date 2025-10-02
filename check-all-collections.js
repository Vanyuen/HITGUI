const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkAllCollections() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n所有集合:\n');
        for (const coll of collections) {
            if (coll.name.includes('task') || coll.name.includes('Task') || coll.name.includes('prediction')) {
                const count = await db.collection(coll.name).countDocuments();
                console.log(`✅ ${coll.name} (${count} 条记录)`);

                if (count > 0 && count < 5) {
                    const sample = await db.collection(coll.name).findOne();
                    console.log(`   示例: task_id = ${sample.task_id || '(无)'}`, sample._id || '');
                }
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkAllCollections();
