const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const maxIssue = await mongoose.connection.db.collection('hit_dlt_combofeatures')
        .find().sort({Issue: -1}).limit(1).toArray();
    const minIssue = await mongoose.connection.db.collection('hit_dlt_combofeatures')
        .find().sort({Issue: 1}).limit(1).toArray();

    console.log('最大期号:', maxIssue[0]?.Issue);
    console.log('最小期号:', minIssue[0]?.Issue);

    const check25082 = await mongoose.connection.db.collection('hit_dlt_combofeatures')
        .findOne({Issue: 25082});
    console.log('期号25082存在:', !!check25082);

    if (check25082) {
        console.log('25082的combo_2数量:', check25082.combo_2?.length);
        console.log('25082的combo_3数量:', check25082.combo_3?.length);
        console.log('25082的combo_4数量:', check25082.combo_4?.length);
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
