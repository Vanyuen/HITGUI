const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('检查所有HWC优化表collection:\n');

    const collections = [
        'hit_dlt_redcombinationshotwarmcoldoptimizeds',
        'hit_dlt_redcombinationshotwarmcoldoptimized',
        'dltredcombinationshotwarmcoldoptimizeds',
        'hit_dlt_redcombinationshwcoptimized',
        'HIT_DLT_RedCombinationsHotWarmColdOptimized',
        'HIT_DLT_RedCombinationsHWCOptimized'
    ];

    for (const name of collections) {
        try {
            const coll = mongoose.connection.db.collection(name);
            const count = await coll.countDocuments();
            console.log(`${name}:`);
            console.log(`  记录数: ${count}`);

            if (count > 0) {
                const sample = await coll.findOne();
                console.log('  样本字段:', Object.keys(sample).join(', '));
                console.log('  样本数据:');
                console.log('    base_issue:', sample.base_issue);
                console.log('    target_issue:', sample.target_issue);
                console.log('    base_id:', sample.base_id);
                console.log('    target_id:', sample.target_id);
            }
            console.log('');
        } catch (e) {
            console.log(`${name}: 错误 - ${e.message}\n`);
        }
    }

    await mongoose.disconnect();
}

check();
