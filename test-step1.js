const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 任务正选条件：热温冷比 3:1:1
    const selectedRatios = [{ hot: 3, warm: 1, cold: 1 }];
    const selectedRatioKeys = selectedRatios.map(r => `${r.hot}:${r.warm}:${r.cold}`);

    console.log('选择的热温冷比:', selectedRatioKeys);

    // 模拟构建hwcOptimizedCache
    const hwcOptimizedCache = new Map();

    // 查询所有期号对的数据
    const hwcDataList = await hwcCol.find({
        target_issue: { $in: ['25042', '25097', '25140', '25141'] }
    }).toArray();

    console.log('\n=== 构建hwcOptimizedCache ===');
    for (const data of hwcDataList) {
        const key = `${data.base_issue}-${data.target_issue}`;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log(`  ${key}: ${hwcMap.size}种比例`);

            // 检查3:1:1比例
            const ratio311 = hwcMap.get('3:1:1');
            console.log(`    3:1:1: ${ratio311 ? ratio311.length : 0}个组合`);
        }
    }

    // 模拟applyPositiveSelection的Step 1
    console.log('\n=== 模拟Step 1筛选 ===');
    const testCases = [
        { base: '25041', target: '25042' },
        { base: '25096', target: '25097' },
        { base: '25139', target: '25140' },
        { base: '25140', target: '25141' }
    ];

    for (const tc of testCases) {
        const hwcKey = `${tc.base}-${tc.target}`;
        const hwcMap = hwcOptimizedCache.get(hwcKey);

        console.log(`\n期号对 ${hwcKey}:`);
        console.log(`  hwcMap存在: ${hwcMap ? 'YES' : 'NO'}`);

        if (hwcMap) {
            let candidateIds = new Set();
            for (const ratioKey of selectedRatioKeys) {
                const ids = hwcMap.get(ratioKey) || [];
                ids.forEach(id => candidateIds.add(id));
            }
            console.log(`  候选组合数: ${candidateIds.size}`);
        }
    }

    await mongoose.disconnect();
}

test().catch(console.error);
