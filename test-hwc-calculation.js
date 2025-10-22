const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery').then(async () => {
    const dltSchema = new mongoose.Schema({}, {strict: false, collection: 'hit_dlts'});
    const missingSchema = new mongoose.Schema({}, {strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories'});

    const DLT = mongoose.model('HIT_DLT_Test', dltSchema);
    const Missing = mongoose.model('Missing_Test', missingSchema);

    // 获取7001期数据
    const dltRec = await DLT.findOne({Issue: 7001}).lean();
    const missingRec = await Missing.findOne({Issue: '7001'}).lean();

    const balls = [dltRec.Red1, dltRec.Red2, dltRec.Red3, dltRec.Red4, dltRec.Red5];

    console.log('7001期红球:', balls);
    console.log('\n对应遗漏值:');

    let hot = 0, warm = 0, cold = 0;

    balls.forEach(b => {
        const missingValue = missingRec[String(b)];
        console.log(`  号码${b}: 遗漏值=${missingValue}`,
            missingValue <= 4 ? '(热)' : (missingValue <= 9 ? '(温)' : '(冷)'));

        if (missingValue <= 4) hot++;
        else if (missingValue <= 9) warm++;
        else cold++;
    });

    console.log(`\n热温冷比: ${hot}:${warm}:${cold}`);

    process.exit(0);
});
