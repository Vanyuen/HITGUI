const mongoose = require('mongoose');

async function testCacheKey() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const collection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    
    // 测试查询25141-25142
    console.log('=== 测试HWC数据查询 ===');
    
    // 测试1：字符串-字符串
    const test1 = await collection.findOne({ base_issue: '25141', target_issue: '25142' });
    console.log('Test1 (string-string): ', test1 ? 'Found!' : 'Not Found');
    
    // 测试2：数字-数字
    const test2 = await collection.findOne({ base_issue: 25141, target_issue: 25142 });
    console.log('Test2 (number-number): ', test2 ? 'Found!' : 'Not Found');
    
    // 测试3：混合
    const test3 = await collection.findOne({ base_issue: '25141', target_issue: 25142 });
    console.log('Test3 (string-number): ', test3 ? 'Found!' : 'Not Found');
    
    // 检查数据类型
    if (test1) {
        console.log('\n数据中的字段类型:');
        console.log('  base_issue:', typeof test1.base_issue, test1.base_issue);
        console.log('  target_issue:', typeof test1.target_issue, test1.target_issue);
        
        // 检查hot_warm_cold_data
        if (test1.hot_warm_cold_data) {
            console.log('\nhot_warm_cold_data存在');
            const ratios = Object.keys(test1.hot_warm_cold_data);
            console.log('  ratio数量:', ratios.length);
            console.log('  3:1:1存在?', !!test1.hot_warm_cold_data['3:1:1']);
            if (test1.hot_warm_cold_data['3:1:1']) {
                console.log('  3:1:1组合数:', test1.hot_warm_cold_data['3:1:1'].length);
            }
        }
    }
    
    await mongoose.disconnect();
}

testCacheKey().catch(e => { console.error(e); process.exit(1); });
