const mongoose = require('mongoose');

async function checkData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:9976/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 已连接');

        const DLTSchema = new mongoose.Schema({}, { strict: false });
        const DLT = mongoose.model('HIT_DLT', DLTSchema);

        const DLTRedMissingSchema = new mongoose.Schema({}, { collection: 'HIT_DLT_RedMissing', strict: false });
        const DLTRedMissing = mongoose.model('HIT_DLT_RedMissing_Check', DLTRedMissingSchema);

        const count = await DLT.countDocuments();
        const missingCount = await DLTRedMissing.countDocuments();

        console.log(`📊 hit_dlts集合中有 ${count} 条记录`);
        console.log(`📊 HIT_DLT_RedMissing集合中有 ${missingCount} 条记录`);

        if (count > 0) {
            const sample = await DLT.findOne().lean();
            console.log('\n示例DLT数据:', JSON.stringify(sample, null, 2));
        }

        if (missingCount > 0) {
            const sample = await DLTRedMissing.findOne().lean();
            console.log('\n示例Missing数据:', JSON.stringify(sample, null, 2));
        }

        // 列出所有集合
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n数据库中的所有集合:');
        for (const coll of collections) {
            const collCount = await mongoose.connection.db.collection(coll.name).countDocuments();
            console.log(`  - ${coll.name}: ${collCount} 条记录`);
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkData();
