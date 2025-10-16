const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTComboFeatures = mongoose.connection.db.collection('hit_dlt_combofeatures');

    // 检查25082的特征
    const features25082 = await DLTComboFeatures.findOne({ Issue: '25082' });

    console.log('期号25082的组合特征存在:', !!features25082);

    if (features25082) {
        console.log('25082的combo_2数量:', features25082.combo_2?.length);
        console.log('25082的combo_3数量:', features25082.combo_3?.length);
        console.log('25082的combo_4数量:', features25082.combo_4?.length);
        console.log('combo_2示例:', features25082.combo_2?.slice(0, 5));
        console.log('combo_3示例:', features25082.combo_3?.slice(0, 3));
        console.log('combo_4示例:', features25082.combo_4?.slice(0, 2));
    }

    // 检查附近几期
    const nearby = await DLTComboFeatures.find({
        Issue: { $in: ['25080', '25081', '25082', '25083', '25084'] }
    }).sort({ Issue: 1 }).toArray();

    console.log('\n25080-25084期的组合特征:');
    nearby.forEach(record => {
        console.log(`  期号: ${record.Issue}, 2码:${record.combo_2?.length}, 3码:${record.combo_3?.length}, 4码:${record.combo_4?.length}`);
    });

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
