const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkRedMissing() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;

        console.log('\n检查红球遗漏数据集合:\n');

        const collections = [
            'hit_dlts',
            'hit_dlt_basictrendchart_redballmissing_histories'
        ];

        for (const collName of collections) {
            const sample = await db.collection(collName).findOne({ Issue: 25087 });
            if (sample) {
                console.log(`✅ ${collName}:`);
                console.log(`   字段:`, Object.keys(sample).slice(0, 15).join(', '));
                console.log(`   Issue: ${sample.Issue}`);
                console.log(`   示例数据: 1=${sample['1']}, 2=${sample['2']}, 3=${sample['3']}\n`);
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkRedMissing();
