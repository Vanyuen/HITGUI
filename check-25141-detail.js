const mongoose = require('mongoose');

async function checkDetail() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const collection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    
    // 检查25141-25142详情
    console.log('=== 25141-25142 详情 ===');
    const record = await collection.findOne({ base_issue: '25141', target_issue: '25142' });
    
    if (record) {
        console.log('base_issue:', record.base_issue, '(类型:', typeof record.base_issue, ')');
        console.log('target_issue:', record.target_issue, '(类型:', typeof record.target_issue, ')');
        console.log('total_combinations:', record.total_combinations);
        console.log('created_at:', record.created_at);
        
        if (record.hot_warm_cold_data) {
            const ratios = Object.keys(record.hot_warm_cold_data);
            console.log('\nhot_warm_cold_data 包含的ratio:', ratios.length);
            
            // 检查3:1:1是否存在
            if (record.hot_warm_cold_data['3:1:1']) {
                const ids = record.hot_warm_cold_data['3:1:1'];
                console.log('  3:1:1 组合数:', ids.length);
                console.log('  前5个ID:', ids.slice(0, 5));
            } else {
                console.log('  3:1:1 不存在！');
            }
            
            // 列出所有ratio及其数量
            console.log('\n所有ratio:');
            for (const ratio of ratios) {
                const count = record.hot_warm_cold_data[ratio]?.length || 0;
                console.log('  ' + ratio + ': ' + count + ' combinations');
            }
        } else {
            console.log('hot_warm_cold_data 不存在！');
        }
        
        if (record.statistics) {
            console.log('\nstatistics:', JSON.stringify(record.statistics, null, 2));
        }
    } else {
        console.log('记录不存在！');
    }
    
    // 检查期号范围
    console.log('\n=== 检查期号范围 ===');
    const maxRecord = await collection.findOne({}, { sort: { target_issue: -1 }});
    const minRecord = await collection.findOne({}, { sort: { target_issue: 1 }});
    console.log('最小target_issue:', minRecord?.target_issue);
    console.log('最大target_issue:', maxRecord?.target_issue);
    
    // 检查数字格式是否存在
    const numericCount = await collection.countDocuments({ target_issue: { $type: 'number' }});
    const stringCount = await collection.countDocuments({ target_issue: { $type: 'string' }});
    console.log('\n数字类型target_issue数:', numericCount);
    console.log('字符串类型target_issue数:', stringCount);
    
    await mongoose.disconnect();
}

checkDetail().catch(e => { console.error(e); process.exit(1); });
