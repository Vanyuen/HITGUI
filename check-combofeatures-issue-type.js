const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTComboFeatures = mongoose.connection.db.collection('hit_dlt_combofeatures');

    // 查看几个样本的Issue类型
    const samples = await DLTComboFeatures.find().limit(10).toArray();

    console.log('DLTComboFeatures表Issue字段类型:');
    samples.forEach(record => {
        console.log(`  期号: ${record.Issue}, 类型: ${typeof record.Issue}, ID: ${record.ID}`);
    });

    // 尝试用number类型查询
    const byNumber = await DLTComboFeatures.findOne({ Issue: 25083 });
    console.log('\n用number(25083)查询:', !!byNumber);

    // 尝试用string类型查询
    const byString = await DLTComboFeatures.findOne({ Issue: '25083' });
    console.log('用string("25083")查询:', !!byString);

    // 查看最大最小期号的类型
    const max = await DLTComboFeatures.find().sort({ ID: -1 }).limit(1).toArray();
    const min = await DLTComboFeatures.find().sort({ ID: 1 }).limit(1).toArray();

    console.log('\n最大期号:', max[0]?.Issue, '类型:', typeof max[0]?.Issue);
    console.log('最小期号:', min[0]?.Issue, '类型:', typeof min[0]?.Issue);

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
