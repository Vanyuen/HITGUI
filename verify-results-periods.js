const mongoose = require('mongoose');

async function verifyResults() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const resultsCollection = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    
    // 获取所有结果的期号
    const results = await resultsCollection.find({ task_id: 'hwc-pos-20251212-l15' })
        .project({ period: 1, is_predicted: 1, combination_count: 1, _id: 0 })
        .sort({ period: 1 })
        .toArray();
    
    console.log('=== 结果分析 ===');
    console.log('总结果数:', results.length);
    
    // 检查期号
    const periods = results.map(r => r.period);
    console.log('最小期号:', Math.min(...periods));
    console.log('最大期号:', Math.max(...periods));
    
    // 检查is_predicted
    const predictedCount = results.filter(r => r.is_predicted === true).length;
    const notPredictedCount = results.filter(r => r.is_predicted === false).length;
    console.log('\nis_predicted=true:', predictedCount);
    console.log('is_predicted=false:', notPredictedCount);
    
    // 检查combination_count=0的记录
    const zeroCount = results.filter(r => r.combination_count === 0);
    console.log('\ncombination_count=0的记录:', zeroCount.length);
    for (const r of zeroCount) {
        console.log('  期号', r.period, '- is_predicted:', r.is_predicted);
    }
    
    // 检查25141和25142
    console.log('\n=== 关键期号 ===');
    const r25141 = results.find(r => r.period === 25141);
    const r25142 = results.find(r => r.period === 25142);
    
    if (r25141) {
        console.log('25141:', JSON.stringify(r25141));
    } else {
        console.log('25141: 不存在');
    }
    
    if (r25142) {
        console.log('25142:', JSON.stringify(r25142));
    } else {
        console.log('25142: 不存在');
    }
    
    await mongoose.disconnect();
}

verifyResults().catch(e => { console.error(e); process.exit(1); });
