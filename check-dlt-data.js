const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const hit_dlts = mongoose.connection.db.collection('hit_dlts');

    const count = await hit_dlts.countDocuments();
    console.log('hit_dlts表总记录数:', count);

    const maxIssue = await hit_dlts.find().sort({Issue: -1}).limit(1).toArray();
    const minIssue = await hit_dlts.find().sort({Issue: 1}).limit(1).toArray();

    console.log('最大期号:', maxIssue[0]?.Issue);
    console.log('最小期号:', minIssue[0]?.Issue);

    const check25082 = await hit_dlts.findOne({Issue: '25082'});
    const check25083 = await hit_dlts.findOne({Issue: '25083'});

    console.log('期号25082存在:', !!check25082);
    console.log('期号25083存在:', !!check25083);

    if (check25082) {
        console.log('25082开奖号码:', [
            check25082.Red1,
            check25082.Red2,
            check25082.Red3,
            check25082.Red4,
            check25082.Red5
        ].join(', '), '+ [', check25082.Blue1, check25082.Blue2, ']');
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
