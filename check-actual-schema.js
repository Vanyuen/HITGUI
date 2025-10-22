// 检查实际数据结构
require('dotenv').config();
const mongoose = require('mongoose');

async function checkSchema() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_redcombinations');

        // 获取一个示例文档
        const sample = await collection.findOne({});

        console.log('📋 实际的文档结构:');
        console.log(JSON.stringify(sample, null, 2));

        console.log('\n🔑 字段列表:');
        if (sample) {
            Object.keys(sample).forEach(key => {
                const value = sample[key];
                const type = Array.isArray(value) ? 'Array' : typeof value;
                console.log(`  ${key}: ${type} = ${JSON.stringify(value).substring(0, 50)}`);
            });
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkSchema();
