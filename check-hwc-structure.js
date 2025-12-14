const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcTable = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 获取一条有数据的记录
    const sample = await hwcTable.findOne({});

    if (sample) {
        console.log('有效记录示例:');
        console.log('  base_issue:', sample.base_issue);
        console.log('  target_issue:', sample.target_issue);
        console.log('  total_combinations:', sample.total_combinations);

        const hwcData = sample.hot_warm_cold_data;
        if (hwcData) {
            const keys = Object.keys(hwcData);
            console.log('  hot_warm_cold_data 热温冷比数量:', keys.length);
            console.log('  热温冷比列表:', keys.slice(0, 15).join(', '));

            // 取第一个比例查看数据
            if (keys.length > 0) {
                const firstKey = keys[0];
                const ids = hwcData[firstKey];
                console.log('  示例比例', firstKey, '组合数:', Array.isArray(ids) ? ids.length : 'N/A');
            }
        } else {
            console.log('  hot_warm_cold_data: 空');
        }
    } else {
        console.log('未找到任何数据');
    }

    await mongoose.disconnect();
}

check().catch(e => console.error(e));
