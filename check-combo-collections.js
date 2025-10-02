const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkComboCollections() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n查找组合相关集合:\n');
        for (const coll of collections) {
            if (coll.name.includes('red') ||
                coll.name.includes('blue') ||
                coll.name.includes('combination') ||
                coll.name.includes('period') ||
                coll.name.includes('missing')) {
                const count = await db.collection(coll.name).countDocuments();
                console.log(`✅ ${coll.name} (${count.toLocaleString()} 条记录)`);
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkComboCollections();
