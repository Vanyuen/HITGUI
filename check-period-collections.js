const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkPeriodCollections() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n查找期号/开奖相关集合:\n');
        for (const coll of collections) {
            if (coll.name.includes('period') ||
                coll.name === 'dlt' ||
                coll.name.includes('hit_dlts') && !coll.name.includes('combination') && !coll.name.includes('missing') && !coll.name.includes('task')) {
                const count = await db.collection(coll.name).countDocuments();
                if (count > 0) {
                    console.log(`✅ ${coll.name} (${count.toLocaleString()} 条记录)`);

                    if (count < 10) {
                        const sample = await db.collection(coll.name).findOne();
                        console.log(`   字段:`, Object.keys(sample).slice(0, 10).join(', '));
                    }
                }
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkPeriodCollections();
