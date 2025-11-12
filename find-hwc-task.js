/**
 * 查找热温冷正选任务（在所有可能的集合中）
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

async function findTask() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        const taskId = 'hwc-pos-20251111-gqb';

        // 列出所有可能的集合
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📋 数据库中共有 ${collections.length} 个集合\n`);

        // 搜索包含 hwc 或 positive 的集合
        const relevantCollections = collections.filter(c =>
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('positive') ||
            c.name.toLowerCase().includes('task')
        );

        console.log('🔍 相关集合:');
        for (const col of relevantCollections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(`   ${col.name}: ${count} 条记录`);
        }

        console.log('\n🔍 在所有集合中搜索任务ID...');

        for (const col of relevantCollections) {
            const doc = await mongoose.connection.db.collection(col.name).findOne({
                task_id: taskId
            });

            if (doc) {
                console.log(`\n✅ 在集合 "${col.name}" 中找到任务!`);
                console.log('任务数据:');
                console.log(JSON.stringify(doc, null, 2));
                break;
            }
        }

        // 如果还是没找到，尝试模糊搜索
        console.log('\n🔍 尝试模糊搜索包含 "gqb" 的任务...');
        for (const col of relevantCollections) {
            const docs = await mongoose.connection.db.collection(col.name).find({
                task_id: { $regex: 'gqb', $options: 'i' }
            }).limit(10).toArray();

            if (docs.length > 0) {
                console.log(`\n✅ 在集合 "${col.name}" 中找到 ${docs.length} 个匹配的任务:`);
                for (const doc of docs) {
                    console.log(`   - ${doc.task_id || doc._id} (${doc.task_name || 'No name'}) - 状态: ${doc.status || 'Unknown'}`);
                }
            }
        }

        // 查找最近创建的任务
        console.log('\n🔍 查找最近创建的热温冷正选任务...');
        for (const col of relevantCollections) {
            const docs = await mongoose.connection.db.collection(col.name).find({})
                .sort({ created_at: -1 })
                .limit(5)
                .toArray();

            if (docs.length > 0) {
                console.log(`\n📋 集合 "${col.name}" 最近的5个任务:`);
                for (const doc of docs) {
                    console.log(`   - ${doc.task_id || doc._id} (创建于: ${doc.created_at || 'Unknown'})`);
                }
            }
        }

    } catch (error) {
        console.error('❌ 搜索失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

findTask().catch(console.error);
