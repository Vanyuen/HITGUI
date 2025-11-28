const mongoose = require('mongoose');

async function debug() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 测试期号
    const targetIssues = ['25124', '25123', '25122', '25121', '25120', '25119', '25118', '25117', '25116', '25115'];

    // 模拟代码中的查询方式 (使用数字)
    const queryIssuesNum = targetIssues.map(i => parseInt(i, 10)).filter(n => !isNaN(n));
    console.log('=== 模拟代码中的查询 (数字类型) ===');
    console.log('查询条件:', queryIssuesNum);
    const result1 = await db.collection('hit_dlts').find({ Issue: { $in: queryIssuesNum } }).toArray();
    console.log('数字查询结果数:', result1.length);

    // 正确的查询方式 (使用字符串)
    const queryIssuesStr = targetIssues.map(i => i.toString());
    console.log('\n=== 正确的查询 (字符串类型) ===');
    console.log('查询条件:', queryIssuesStr);
    const result2 = await db.collection('hit_dlts').find({ Issue: { $in: queryIssuesStr } }).toArray();
    console.log('字符串查询结果数:', result2.length);

    // 检查mongoose模型行为
    console.log('\n=== 检查mongoose模型定义 ===');
    const DLTSchema = mongoose.connection.model('hit_dlts')?.schema;
    if (DLTSchema) {
        const issueField = DLTSchema.path('Issue');
        console.log('Schema中Issue字段类型:', issueField?.instance);
    } else {
        console.log('未找到mongoose模型');
    }

    await mongoose.disconnect();
}

debug().catch(err => {
    console.error(err);
    process.exit(1);
});
