const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const hwcTable = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
    const hwc25124 = await hwcTable.findOne({ target_issue: '25124' });

    if (hwc25124) {
        console.log('期号25124热温冷比例:');
        const hwcData = hwc25124.hot_warm_cold_data || {};

        const ratioDetails = Object.keys(hwcData).map(function(ratio) {
            const parts = ratio.split(':').map(Number);
            return {
                ratio: ratio,
                count: hwcData[ratio].length,
                hot: parts[0],
                warm: parts[1],
                cold: parts[2]
            };
        });

        ratioDetails.sort(function(a, b) {
            // 优先按温号数排序
            if (a.warm !== b.warm) return b.warm - a.warm;
            // 再按热号数排序
            if (a.hot !== b.hot) return b.hot - a.hot;
            // 最后按冷号数排序
            return b.cold - a.cold;
        });

        console.log('热温冷比例种类数:', ratioDetails.length);

        ratioDetails.forEach(function(detail) {
            console.log(detail.ratio + ': ' + detail.count + ' 个组合');
        });
    }

    await mongoose.disconnect();
}

check().catch(console.error);