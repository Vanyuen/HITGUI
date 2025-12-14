const mongoose = require('mongoose');

async function testQuery() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const collection = db.collection('hit_dlts');
    
    // 测试查询25142
    console.log('=== 测试查询25142 ===');
    
    const targetIssue = '25142';
    const result = await collection.findOne({ Issue: parseInt(targetIssue) });
    
    console.log('targetIssue:', targetIssue);
    console.log('parseInt(targetIssue):', parseInt(targetIssue));
    console.log('查询结果:', result ? '找到' : '未找到');
    
    // 测试查询25141
    console.log('\n=== 测试查询25141 ===');
    
    const result25141 = await collection.findOne({ Issue: parseInt('25141') });
    console.log('查询结果:', result25141 ? '找到 - Issue=' + result25141.Issue : '未找到');
    
    await mongoose.disconnect();
}

testQuery().catch(e => { console.error(e); process.exit(1); });
