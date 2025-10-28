const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkHitCollections() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB连接成功\n');

        const db = mongoose.connection.db;
        
        // 检查 hit_dlt_exclusiondetails
        const hitExclusionCount = await db.collection('hit_dlt_exclusiondetails').countDocuments();
        console.log(`📊 hit_dlt_exclusiondetails 记录数: ${hitExclusionCount}`);
        
        if (hitExclusionCount > 0) {
            const sample = await db.collection('hit_dlt_exclusiondetails').findOne();
            console.log('\n样本数据:');
            console.log(JSON.stringify(sample, null, 2).substring(0, 500));
        }
        
        // 检查 hit_prediction_tasks
        const hitTaskCount = await db.collection('hit_prediction_tasks').countDocuments();
        console.log(`\n📊 hit_prediction_tasks 记录数: ${hitTaskCount}`);
        
        if (hitTaskCount > 0) {
            const tasks = await db.collection('hit_prediction_tasks').find({}).sort({ created_at: -1 }).limit(5).toArray();
            console.log('\n最近5个任务:');
            tasks.forEach(t => {
                console.log(`  - ${t.task_id} (${t.created_at})`);
            });
            
            // 检查是否有"预测任务_2025-10-25 20-02-54"
            const targetTask = await db.collection('hit_prediction_tasks').findOne({
                task_id: { $regex: /2025-10-25.*20.02/ }
            });
            if (targetTask) {
                console.log('\n✅ 找到目标任务:');
                console.log(`  task_id: ${targetTask.task_id}`);
                console.log(`  created_at: ${targetTask.created_at}`);
                
                // 检查该任务的排除详情
                const exclusions = await db.collection('hit_dlt_exclusiondetails').find({
                    task_id: targetTask.task_id
                }).toArray();
                console.log(`\n📊 该任务的排除详情记录数: ${exclusions.length}`);
                
                if (exclusions.length > 0) {
                    console.log('\n排除详情样本:');
                    const sample = exclusions[0];
                    console.log(`  period: ${sample.period}`);
                    console.log(`  condition: ${sample.condition}`);
                    const count = sample.excluded_combination_ids ? sample.excluded_combination_ids.length : 0;
                    console.log(`  excluded_count: ${count}`);
                }
            }
        }
        
        // 检查 hit_prediction_task_results
        const hitResultCount = await db.collection('hit_prediction_task_results').countDocuments();
        console.log(`\n📊 hit_prediction_task_results 记录数: ${hitResultCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkHitCollections();
