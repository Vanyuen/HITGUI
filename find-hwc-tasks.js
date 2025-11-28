/**
 * 查找热温冷正选任务
 */

const mongoose = require('mongoose');

async function findTasks() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = mongoose.connection.db;

        console.log('=== 查找所有包含hwc/positive的集合 ===\n');
        const collections = await db.listCollections().toArray();
        const taskColls = collections.filter(c =>
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('positive') ||
            c.name.toLowerCase().includes('task')
        );

        for (const coll of taskColls) {
            const count = await db.collection(coll.name).countDocuments({});
            console.log(`${coll.name}: ${count} 条记录`);

            if (count > 0 && count < 10) {
                const docs = await db.collection(coll.name).find({}).sort({ created_at: -1 }).limit(3).toArray();
                console.log('  最新记录:');
                docs.forEach((doc, i) => {
                    console.log(`    ${i+1}. task_id: ${doc.task_id || doc._id}, created: ${doc.created_at}`);
                });
            }
        }

        console.log('\n=== 完成 ===');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

findTasks();
