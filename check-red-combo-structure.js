const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;
    
    console.log('🔍 检查红球组合表结构...\n');
    
    const sample = await db.collection('hit_dlt_redcombinations').findOne({});
    
    if (sample) {
        console.log('✅ 找到示例记录:');
        console.log('   字段:', Object.keys(sample).join(', '));
        console.log('\n   完整记录:');
        console.log(JSON.stringify(sample, null, 2));
    } else {
        console.log('❌ 表为空');
    }
    
    mongoose.connection.close();
}).catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
