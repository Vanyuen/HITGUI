const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkCollections() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const db = mongoose.connection.db;

        const collections = [
            'hit_dlts',
            'hit_dlt_basictrendchart_redballmissing_histories',
            'hit_dlt_basictrendchart_blueballmissing_histories',
            'hit_dlt_combofeatures',
            'hit_dlt_redcombinationshotwarmcoldoptimized'
        ];

        console.log(`📊 检查指定集合:\n`);
        for (const coll of collections) {
            try {
                const count = await db.collection(coll).countDocuments();
                console.log(`  - ${coll} (${count} 条记录)`);
            } catch (collError) {
                console.log(`  - ${coll} ❌ 错误: ${collError.message}`);
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkCollections();