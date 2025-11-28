/**
 * 检查所有大乐透相关集合，找出正确的数据存储位置
 */

const mongoose = require('mongoose');

async function checkAll() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 检查所有可能的集合
        const collections = [
            'hit_dlts',
            'hit_dlts_backup_missing_values',
            'HIT_DLT',
            'hit_dlt'
        ];

        for (const collName of collections) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📊 集合: ${collName}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            try {
                const collection = db.collection(collName);
                const count = await collection.countDocuments();
                console.log(`记录数: ${count}`);

                if (count > 0) {
                    const latest = await collection.findOne({}, { sort: { ID: -1 } });
                    console.log('\n最新记录（按ID）:');
                    console.log(`   ID: ${latest.ID}`);
                    console.log(`   Issue: ${latest.Issue}`);
                    console.log(`   字段: ${Object.keys(latest).slice(0, 20).join(', ')}`);

                    // 检查是否有开奖号码字段
                    const hasRed1 = 'Red1' in latest;
                    const hasNumField1 = '1' in latest;

                    console.log(`\n   字段类型: ${hasRed1 ? '✅ 开奖号码(Red1-Red5)' : ''}${hasNumField1 ? '🔢 遗漏值("1"-"12")' : ''}`);

                    if (hasRed1) {
                        console.log(`   红球: [${latest.Red1}, ${latest.Red2}, ${latest.Red3}, ${latest.Red4}, ${latest.Red5}]`);
                        console.log(`   蓝球: [${latest.Blue1}, ${latest.Blue2}]`);
                    }

                    if (hasNumField1) {
                        console.log(`   遗漏值样本: "1"=${latest["1"]}, "2"=${latest["2"]}, "3"=${latest["3"]}`);
                    }
                }
            } catch (error) {
                console.log(`   ❌ 集合不存在或无法访问`);
            }
            console.log();
        }

        // 检查是否有后台进程在运行
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 检查最近的数据修改时间');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const hitDlts = db.collection('hit_dlts');
        const recentlyModified = await hitDlts.find({})
            .sort({ _id: -1 })
            .limit(5)
            .project({ _id: 1, ID: 1, Issue: 1 })
            .toArray();

        console.log('最近插入的5条记录（按_id）:');
        recentlyModified.forEach(r => {
            const timestamp = r._id.getTimestamp();
            console.log(`   ID=${r.ID}, Issue=${r.Issue}, 插入时间=${timestamp.toLocaleString('zh-CN')}`);
        });

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkAll();
