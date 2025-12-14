const mongoose = require('mongoose');

async function checkTaskResult() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    // 检查最新的HWC任务
    const tasksCollection = db.collection('hit_dlt_hwcpositivepredictiontasks');
    const resultsCollection = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    
    // 获取最新任务
    console.log('=== 最新HWC任务 ===');
    const latestTask = await tasksCollection.findOne({}, { sort: { created_at: -1 }});
    if (latestTask) {
        console.log('task_id:', latestTask.task_id);
        console.log('task_type:', latestTask.task_type);
        console.log('status:', latestTask.status);
        console.log('issue_range:', JSON.stringify(latestTask.issue_range));
        console.log('hwc_positive_ratios:', latestTask.hwc_positive_ratios);
        console.log('created_at:', latestTask.created_at);
        
        // 检查该任务的结果
        console.log('\n=== 该任务的结果 ===');
        const results = await resultsCollection.find({ task_id: latestTask.task_id }).toArray();
        console.log('结果数量:', results.length);
        
        for (const r of results) {
            console.log('\n期号', r.target_issue + ':');
            console.log('  base_issue:', r.base_issue);
            console.log('  is_predicted:', r.is_predicted);
            console.log('  combination_count:', r.combination_count);
            if (r.combinations) {
                console.log('  combinations数组长度:', r.combinations.length);
            }
            if (r.statistics) {
                console.log('  statistics:', JSON.stringify(r.statistics).substring(0, 200) + '...');
            }
        }
    } else {
        console.log('没有找到任务');
    }
    
    await mongoose.disconnect();
}

checkTaskResult().catch(e => { console.error(e); process.exit(1); });
