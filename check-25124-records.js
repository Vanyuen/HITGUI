const mongoose = require('mongoose');

(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const records = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({ $or: [{ base_issue: '25123' }, { base_issue: '25124' }, { target_issue: '25124' }, { target_issue: '25125' }] })
        .toArray();

    records.sort((a, b) => parseInt(a.target_issue) - parseInt(b.target_issue));

    console.log('Records near 25124:');
    records.forEach(r => {
        console.log(`  ${r.base_issue} → ${r.target_issue} | predicted: ${r.is_predicted} | _id: ${r._id}`);
    });

    console.log(`\nTotal records found: ${records.length}`);

    await mongoose.connection.close();
})().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
