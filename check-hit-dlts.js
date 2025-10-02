const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkHitDlts() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const sample = await db.collection('hit_dlts').findOne({ Issue: 25087 });

        console.log('\nhit_dlts 集合示例数据:\n');
        console.log(JSON.stringify(sample, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkHitDlts();
