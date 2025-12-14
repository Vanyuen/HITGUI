const mongoose = require('mongoose');

async function checkPeriod25142() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const resultsCollection = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    
    // 查找period为25142的记录
    console.log('=== 查找 period=25142 ===');
    const record25142 = await resultsCollection.findOne({ 
        task_id: 'hwc-pos-20251212-l15',
        period: 25142 
    });
    
    if (record25142) {
        console.log('找到！');
        console.log('  result_id:', record25142.result_id);
        console.log('  period:', record25142.period);
        console.log('  is_predicted:', record25142.is_predicted);
        console.log('  combination_count:', record25142.combination_count);
    } else {
        console.log('未找到period=25142的记录');
    }
    
    // 查找period为25141的记录
    console.log('\n=== 查找 period=25141 ===');
    const record25141 = await resultsCollection.findOne({ 
        task_id: 'hwc-pos-20251212-l15',
        period: 25141 
    });
    
    if (record25141) {
        console.log('找到！');
        console.log('  result_id:', record25141.result_id);
        console.log('  period:', record25141.period);
        console.log('  is_predicted:', record25141.is_predicted);
        console.log('  combination_count:', record25141.combination_count);
    } else {
        console.log('未找到period=25141的记录');
    }
    
    // 查看所有期号范围
    console.log('\n=== 所有期号 ===');
    const allPeriods = await resultsCollection.find({ task_id: 'hwc-pos-20251212-l15' })
        .project({ period: 1, is_predicted: 1, combination_count: 1, _id: 0 })
        .sort({ period: 1 })
        .toArray();
    
    console.log('期号数量:', allPeriods.length);
    console.log('最小期号:', allPeriods[0]?.period);
    console.log('最大期号:', allPeriods[allPeriods.length - 1]?.period);
    
    // 显示最后5期
    console.log('\n最后5期:');
    for (const r of allPeriods.slice(-5)) {
        console.log('  ' + r.period + ': count=' + r.combination_count + ', is_predicted=' + r.is_predicted);
    }
    
    // 查找combination_count=0的记录
    console.log('\n=== combination_count=0 的记录 ===');
    const zeroCountRecords = allPeriods.filter(r => r.combination_count === 0);
    console.log('数量:', zeroCountRecords.length);
    for (const r of zeroCountRecords) {
        console.log('  期号 ' + r.period + ': is_predicted=' + r.is_predicted);
    }
    
    await mongoose.disconnect();
}

checkPeriod25142().catch(e => { console.error(e); process.exit(1); });
