const mongoose = require('mongoose');

async function checkAllDatabases() {
    try {
        // 连接到MongoDB
        await mongoose.connect('mongodb://127.0.0.1:27017/admin');
        console.log('✅ 连接到MongoDB成功\n');

        // 获取所有数据库列表
        const adminDb = mongoose.connection.db.admin();
        const { databases } = await adminDb.listDatabases();

        console.log('📊 所有数据库列表:\n');
        for (const db of databases) {
            console.log(`数据库: ${db.name} (大小: ${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);

            // 如果是lottery或test数据库，列出集合
            if (db.name === 'lottery' || db.name === 'test') {
                const dbConnection = mongoose.connection.client.db(db.name);
                const collections = await dbConnection.listCollections().toArray();

                console.log(`  集合列表:`);
                for (const col of collections) {
                    const count = await dbConnection.collection(col.name).countDocuments();
                    console.log(`    - ${col.name}: ${count} 条记录`);

                    // 特别检查PredictionTask
                    if (col.name === 'PredictionTask' || col.name === 'predictiontasks') {
                        console.log(`      ⭐ 发现任务表！`);
                        const tasks = await dbConnection.collection(col.name).find().limit(3).toArray();
                        if (tasks.length > 0) {
                            console.log(`      最新任务示例:`);
                            tasks.forEach((task, idx) => {
                                console.log(`        ${idx + 1}. ID: ${task.task_id || task._id}, 创建时间: ${task.created_at || task.createdAt}`);
                            });
                        }
                    }
                }
                console.log('');
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ 检查完成');
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkAllDatabases();
