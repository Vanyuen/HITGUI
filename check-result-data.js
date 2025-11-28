const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251116-2il' })
        .sort({ created_at: 1 })
        .limit(10)
        .toArray();

    console.log(`共找到 ${results.length} 条结果\n`);

    results.forEach((r, i) => {
        console.log(`结果 ${i + 1}:`);
        console.log(`  _id: ${r._id}`);
        console.log(`  target_issue: ${r.target_issue}`);
        console.log(`  base_issue: ${r.base_issue}`);
        console.log(`  is_predicted: ${r.is_predicted}`);
        console.log(`  paired_combinations length: ${r.paired_combinations?.length || 0}`);
        console.log(`  winning_numbers: ${r.winning_numbers ? 'exists' : 'null'}`);
        console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
