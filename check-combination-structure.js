const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTRedCombination = mongoose.connection.db.collection('hit_dlt_redcombinations');

    // 获取一个示例记录
    const sample = await DLTRedCombination.findOne();

    console.log('DLTRedCombination 表字段结构:');
    console.log('字段列表:', Object.keys(sample));
    console.log('\n示例记录:');
    console.log(JSON.stringify(sample, null, 2));

    // 检查是否有 combo_2 字段
    console.log('\ncombo_2 字段存在:', 'combo_2' in sample);
    console.log('combo_3 字段存在:', 'combo_3' in sample);
    console.log('combo_4 字段存在:', 'combo_4' in sample);

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
