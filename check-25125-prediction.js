/**
 * 检查推算期25125的热温冷数据是否存在
 */
const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const col = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        console.log('检查推算期25125的基准期配置：\n');

        const data25125 = await col.findOne({ base_issue: '25124', target_issue: '25125' });
        console.log('期号对 25124→25125:');
        console.log('  存在:', !!data25125);
        if (data25125) {
            const ratios = Object.keys(data25125.hot_warm_cold_data || {});
            console.log('  热温冷比例数:', ratios.length);
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

check();
