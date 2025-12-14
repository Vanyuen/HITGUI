const mongoose = require('mongoose');

async function testQuery() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    // 直接查询集合
    const collection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    
    // 查看最新几条记录
    console.log('=== 直接查询集合 ===');
    const latestRecords = await collection.find()
        .sort({ target_issue: -1 })
        .limit(5)
        .project({ base_issue: 1, target_issue: 1, hot_warm_cold_data: 1, ratio_counts: 1, _id: 0 })
        .toArray();
    
    for (const r of latestRecords) {
        console.log('\n记录:', r.base_issue, '->', r.target_issue);
        if (r.hot_warm_cold_data) {
            const ratios = Object.keys(r.hot_warm_cold_data);
            console.log('  hot_warm_cold_data字段存在, ratio数:', ratios.length);
            console.log('  示例ratios:', ratios.slice(0, 3));
        } else {
            console.log('  hot_warm_cold_data字段不存在');
        }
        if (r.ratio_counts) {
            const ratios = Object.keys(r.ratio_counts);
            console.log('  ratio_counts字段存在, ratio数:', ratios.length);
        }
    }
    
    // 检查25140-25141这对是否存在
    console.log('\n=== 检查25140-25141 ===');
    const pair25140 = await collection.findOne({ base_issue: '25140', target_issue: '25141' });
    if (pair25140) {
        console.log('存在！');
        console.log('字段:', Object.keys(pair25140).join(', '));
    } else {
        console.log('不存在！');
        // 尝试数字类型
        const pair25140num = await collection.findOne({ base_issue: 25140, target_issue: 25141 });
        if (pair25140num) {
            console.log('以数字类型存在！');
        }
    }

    // 检查25141-25142这对是否存在
    console.log('\n=== 检查25141-25142 ===');
    const pair25141 = await collection.findOne({ base_issue: '25141', target_issue: '25142' });
    if (pair25141) {
        console.log('存在！');
    } else {
        console.log('不存在！');
    }
    
    await mongoose.disconnect();
}

testQuery().catch(e => { console.error(e); process.exit(1); });
