const mongoose = require('mongoose');

async function checkSchema() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const resultsCollection = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    
    // 获取一条完整记录查看字段
    console.log('=== 完整记录示例 ===');
    const sample = await resultsCollection.findOne({ task_id: 'hwc-pos-20251212-l15' });
    
    if (sample) {
        console.log('所有字段:');
        for (const key of Object.keys(sample)) {
            const value = sample[key];
            if (key === 'combinations') {
                console.log('  ' + key + ': Array[' + (value?.length || 0) + ']');
            } else if (typeof value === 'object' && value !== null) {
                console.log('  ' + key + ': ' + JSON.stringify(value).substring(0, 100));
            } else {
                console.log('  ' + key + ': ' + value + ' (' + typeof value + ')');
            }
        }
    }
    
    await mongoose.disconnect();
}

checkSchema().catch(e => { console.error(e); process.exit(1); });
