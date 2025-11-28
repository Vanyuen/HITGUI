const mongoose = require('mongoose');

// 连接MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (err) => {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
});

db.once('open', async () => {
    console.log('✅ 数据库连接成功\n');

    try {
        // 删除所有热温冷正选任务
        const taskResult = await db.collection('hit_dlt_hwcpositivepredictiontasks').deleteMany({});
        console.log(`🗑️  删除任务: ${taskResult.deletedCount} 个`);

        // 删除所有热温冷正选任务结果
        const resultResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').deleteMany({});
        console.log(`🗑️  删除任务结果: ${resultResult.deletedCount} 个`);

        console.log('\n✅ 旧任务清理完成！现在可以使用修复后的代码创建新任务。');

    } catch (error) {
        console.error('❌ 删除失败:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
});
