const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟preloadHwcOptimizedData的查询
    const issuePairs = [
        { base_issue: '25139', target_issue: '25140' },
        { base_issue: '25140', target_issue: '25141' },
        { base_issue: '25141', target_issue: '25142' }  // 推算期
    ];

    console.log('=== 模拟preloadHwcOptimizedData ===');
    console.log('查询期号对:', issuePairs);

    const schema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed
    }, {
        collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds'
    });

    const Model = mongoose.model('TestHWCModel', schema);

    // 执行查询
    const hwcDataList = await Model.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();

    console.log('\n查询结果数:', hwcDataList.length);

    // 构建缓存
    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = `${data.base_issue}-${data.target_issue}`;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log(`  缓存: ${key} -> ${hwcMap.size}种热温冷比`);
        }
    }

    console.log('\n=== 检查各期号对的缓存情况 ===');
    for (const pair of issuePairs) {
        const key = `${pair.base_issue}-${pair.target_issue}`;
        const hwcMap = hwcOptimizedCache.get(key);
        console.log(`${key}: ${hwcMap ? '有数据, ' + hwcMap.size + '种比例' : '❌ 无数据'}`);

        if (hwcMap) {
            // 检查3:1:1比例
            const ratio311 = hwcMap.get('3:1:1');
            console.log(`  3:1:1 比例组合数: ${ratio311 ? ratio311.length : 0}`);
        }
    }

    await mongoose.disconnect();
}

test().catch(console.error);
