const mongoose = require('mongoose');

async function checkResultDetail() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const resultsCollection = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    
    // 获取25142的完整记录
    const record = await resultsCollection.findOne({ 
        task_id: 'hwc-pos-20251212-l15',
        period: 25142 
    });
    
    if (record) {
        console.log('=== 25142 完整记录 ===');
        console.log('period:', record.period);
        console.log('is_predicted:', record.is_predicted);
        console.log('combination_count:', record.combination_count);
        
        // 检查red_combinations和blue_combinations
        console.log('\nred_combinations:');
        if (record.red_combinations) {
            console.log('  类型:', Array.isArray(record.red_combinations) ? 'Array' : typeof record.red_combinations);
            console.log('  长度:', record.red_combinations.length);
            if (record.red_combinations.length > 0) {
                console.log('  前5个:', record.red_combinations.slice(0, 5));
            }
        } else {
            console.log('  不存在');
        }
        
        console.log('\nblue_combinations:');
        if (record.blue_combinations) {
            console.log('  类型:', Array.isArray(record.blue_combinations) ? 'Array' : typeof record.blue_combinations);
            console.log('  长度:', record.blue_combinations.length);
        } else {
            console.log('  不存在');
        }
        
        // 检查positive_selection_details
        console.log('\npositive_selection_details:');
        if (record.positive_selection_details) {
            console.log(JSON.stringify(record.positive_selection_details, null, 2));
        } else {
            console.log('  不存在');
        }
        
        // 检查exclusion_summary
        console.log('\nexclusion_summary:');
        if (record.exclusion_summary) {
            console.log(JSON.stringify(record.exclusion_summary, null, 2));
        } else {
            console.log('  不存在');
        }
    } else {
        console.log('未找到25142的记录');
    }
    
    await mongoose.disconnect();
}

checkResultDetail().catch(e => { console.error(e); process.exit(1); });
