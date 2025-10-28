const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkCollection() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB连接成功\n');

        const db = mongoose.connection.db;
        
        // 列出所有集合
        const collections = await db.listCollections().toArray();
        console.log('📋 数据库中的集合:');
        collections.forEach(c => console.log(`  - ${c.name}`));
        
        // 检查DLTExclusionDetails
        const exclusionDetailsCount = await db.collection('DLTExclusionDetails').countDocuments();
        console.log(`\n📊 DLTExclusionDetails 记录数: ${exclusionDetailsCount}`);
        
        if (exclusionDetailsCount > 0) {
            const sample = await db.collection('DLTExclusionDetails').findOne();
            console.log('\n样本数据:');
            console.log(JSON.stringify(sample, null, 2));
        }
        
        // 检查PredictionTask
        const taskCount = await db.collection('PredictionTask').countDocuments();
        console.log(`\n📊 PredictionTask 记录数: ${taskCount}`);
        
        if (taskCount > 0) {
            const taskSample = await db.collection('PredictionTask').findOne({}, { sort: { created_at: -1 } });
            console.log('\n最近的任务:');
            console.log(`  task_id: ${taskSample.task_id}`);
            console.log(`  created_at: ${taskSample.created_at}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkCollection();
