const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find()
        .sort({_id: -1})
        .limit(6)
        .toArray();

    console.log('最新6条任务结果:');
    results.forEach(r => {
        console.log(`期号${r.period}: combination_count=${r.combination_count}, is_predicted=${r.is_predicted}, step1=${r.step1_basic_combinations || 'N/A'}`);
    });

    await mongoose.disconnect();
}).catch(e => console.error(e));
