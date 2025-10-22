// 强制检查ac_value字段
require('dotenv').config();
const mongoose = require('mongoose');

async function forceCheck() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_redcombinations');

        // 检查有ac_value字段的文档数
        const withACValue = await collection.countDocuments({ ac_value: { $exists: true } });
        console.log(`有 ac_value 字段的文档数: ${withACValue}`);

        // 查找一个有ac_value的文档
        const sampleWithAC = await collection.findOne({ ac_value: { $exists: true } });
        console.log('\n有ac_value的示例文档:', JSON.stringify(sampleWithAC, null, 2));

        // 查找一个没有ac_value的文档
        const sampleWithoutAC = await collection.findOne({ ac_value: { $exists: false } });
        console.log('\n没有ac_value的示例文档:', JSON.stringify(sampleWithoutAC, null, 2));

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

forceCheck();
