const mongoose = require('mongoose');

async function testExactQuery() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 使用直接的collection查询（跳过mongoose schema）
        const hit_dlts_collection = mongoose.connection.collection('hit_dlts');

        console.log('🔍 测试1: 使用collection直接查询 Issue < "25125"');
        const result1 = await hit_dlts_collection.find({
            Issue: { $lt: "25125" }
        })
        .sort({ ID: -1 })
        .limit(110)
        .project({ Issue: 1, ID: 1 })
        .toArray();

        console.log(`  结果数量: ${result1.length}`);
        if (result1.length > 0) {
            console.log(`  前5条:`,result1.slice(0, 5).map(r => `ID=${r.ID}, Issue="${r.Issue}"`));
        }

        // 测试2: 检查Issue字段的实际存储类型
        console.log('\n🔍 测试2: 检查Issue字段的实际MongoDB存储类型');
        const sampleDocs = await hit_dlts_collection.find({})
            .sort({ ID: -1 })
            .limit(1)
            .toArray();

        if (sampleDocs.length > 0) {
            const doc = sampleDocs[0];
            console.log(`  样本文档: ${JSON.stringify(doc, null, 2)}`);
            console.log(`  Issue值: "${doc.Issue}"`);
            console.log(`  Issue类型: ${typeof doc.Issue}`);
            console.log(`  Issue构造函数: ${doc.Issue.constructor.name}`);
        }

        // 测试3: 使用Mongoose Model查询（这是代码实际使用的方式）
        console.log('\n🔍 测试3: 使用Mongoose Model查询（模拟实际代码）');

        const hit_dltsSchema = new mongoose.Schema({
            Issue: { type: String },
            ID: { type: Number }
        }, { collection: 'hit_dlts' });

        const hit_dlts_Model = mongoose.model('HitDltsTest', hit_dltsSchema);

        const result3 = await hit_dlts_Model.find({
            Issue: { $lt: "25125" }
        })
        .sort({ ID: -1 })
        .limit(110)
        .select('Issue ID')
        .lean();

        console.log(`  结果数量: ${result3.length}`);
        if (result3.length > 0) {
            console.log(`  前5条:`, result3.slice(0, 5).map(r => `ID=${r.ID}, Issue="${r.Issue}"`));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

testExactQuery();
