const mongoose = require('mongoose');

async function checkServerLogs() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    // 检查任务的元数据
    const tasksCollection = db.collection('hit_dlt_hwcpositivepredictiontasks');
    const task = await tasksCollection.findOne({ task_id: 'hwc-pos-20251212-l15' });
    
    console.log('=== 任务元数据 ===');
    console.log('task_id:', task.task_id);
    console.log('status:', task.status);
    console.log('created_at:', task.created_at);
    console.log('completed_at:', task.completed_at);
    
    // 检查issue_range
    console.log('\nissue_range:');
    if (task.issue_range) {
        console.log('  type:', task.issue_range.type);
        console.log('  issues数量:', task.issue_range.issues?.length);
        if (task.issue_range.issues) {
            console.log('  最后3期:', task.issue_range.issues.slice(-3));
        }
    }
    
    // 检查hwc_positive_ratios
    console.log('\nhwc_positive_ratios:', task.hwc_positive_ratios);
    
    // 检查exclude_conditions
    console.log('\nexclude_conditions:', JSON.stringify(task.exclude_conditions, null, 2));
    
    // 检查filters
    console.log('\nfilters:', JSON.stringify(task.filters, null, 2));
    
    await mongoose.disconnect();
}

checkServerLogs().catch(e => { console.error(e); process.exit(1); });
