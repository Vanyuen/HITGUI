/**
 * 查找大乐透开奖号码的实际存储位置
 */

const mongoose = require('mongoose');

async function findWinningNumbers() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 列出所有collection
        const collections = await db.listCollections().toArray();
        console.log('📚 数据库中的所有集合:');
        collections.forEach(coll => {
            console.log(`   - ${coll.name}`);
        });
        console.log();

        // 检查 hit_dlts 表的完整记录（获取所有字段）
        const hitDltsCollection = db.collection('hit_dlts');
        const fullSample = await hitDltsCollection.findOne({ ID: 2792 }); // 最新一期

        console.log('📋 hit_dlts 表完整记录（ID=2792，最新期）:');
        console.log(JSON.stringify(fullSample, null, 2));
        console.log('\n所有字段:', Object.keys(fullSample || {}).sort());

        // 尝试查找其他可能存储开奖号码的集合
        const possibleCollections = collections.filter(c =>
            c.name.toLowerCase().includes('dlt') ||
            c.name.toLowerCase().includes('lotto') ||
            c.name.toLowerCase().includes('hit')
        );

        console.log('\n\n🔍 可能存储大乐透数据的集合:');
        for (const coll of possibleCollections) {
            console.log(`\n集合: ${coll.name}`);
            const sample = await db.collection(coll.name).findOne({});
            if (sample) {
                console.log(`   字段: ${Object.keys(sample).slice(0, 20).join(', ')}`);

                // 如果有Issue字段，显示一条完整记录
                if (sample.Issue) {
                    const withIssue = await db.collection(coll.name).findOne({}, { sort: { ID: -1 } });
                    console.log(`   最新记录样本:`);
                    console.log(`   ${JSON.stringify(withIssue).substring(0, 500)}`);
                }
            }
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

findWinningNumbers();
