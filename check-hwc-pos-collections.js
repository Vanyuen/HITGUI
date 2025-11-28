/**
 * 检查热温冷正选任务相关的集合
 */

const mongoose = require('mongoose');

async function checkCollections() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('=== 所有集合列表 ===\n');

        const hwcCollections = collections.filter(c =>
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('positive') ||
            c.name.toLowerCase().includes('prediction')
        );

        if (hwcCollections.length === 0) {
            console.log('❌ 没有找到与热温冷正选任务相关的集合');
            console.log('\n所有集合名称:');
            collections.forEach(c => console.log('  -', c.name));
        } else {
            console.log('找到以下相关集合:\n');
            for (const coll of hwcCollections) {
                const count = await db.collection(coll.name).countDocuments({});
                console.log(`📁 ${coll.name}: ${count} 条记录`);

                if (count > 0) {
                    const sample = await db.collection(coll.name).findOne({});
                    console.log('   示例文档字段:', Object.keys(sample).join(', '));
                }
                console.log('');
            }
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkCollections();
