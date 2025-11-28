const mongoose = require('mongoose');

(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const records = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({}).toArray();

    records.sort((a, b) => parseInt(a.target_issue) - parseInt(b.target_issue));

    console.log('📊 总记录数:', records.length);
    console.log('\n📈 连续数据段:');

    let rangeStart = parseInt(records[0].target_issue);
    let rangePrev = rangeStart;
    let count = 1;

    for (let i = 1; i < records.length; i++) {
        const curr = parseInt(records[i].target_issue);

        if (curr === rangePrev + 1) {
            rangePrev = curr;
            count++;
        } else {
            console.log(`   ${rangeStart} → ${rangePrev} (${count} records)`);
            if (curr - rangePrev > 1) {
                console.log(`   ❌ GAP: Missing ${curr - rangePrev - 1} records`);
            }
            rangeStart = curr;
            rangePrev = curr;
            count = 1;
        }
    }

    console.log(`   ${rangeStart} → ${rangePrev} (${count} records)`);

    await mongoose.connection.close();
})().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
