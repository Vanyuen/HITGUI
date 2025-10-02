const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkRedMissing() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;

        console.log('\n检查红球遗漏数据:\n');

        const sample1 = await db.collection('hit_dlt_redballmissing_histories').findOne();
        if (sample1) {
            console.log('✅ hit_dlt_redballmissing_histories:');
            console.log(JSON.stringify(sample1, null, 2).substring(0, 500));
        }

        const sample2 = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').findOne();
        if (sample2) {
            console.log('\n✅ hit_dlt_basictrendchart_redballmissing_histories:');
            console.log(JSON.stringify(sample2, null, 2).substring(0, 500));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkRedMissing();
