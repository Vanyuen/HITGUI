// 诊断：验证Mongoose模型是否正确查询到HWC数据
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    await mongoose.connect(MONGODB_URI);
    console.log('=== 诊断：Mongoose模型HWC查询验证 ===\n');

    // 1. 定义Schema和Model（模拟server.js中的定义）
    const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed,
        created_at: { type: Date, default: Date.now }
    });

    // 方式1: 不指定collection名（错误的方式）
    let ModelWithoutCollection;
    try {
        ModelWithoutCollection = mongoose.model('HIT_DLT_Test1', dltRedCombinationsHotWarmColdOptimizedSchema);
    } catch (e) {
        ModelWithoutCollection = mongoose.model('HIT_DLT_Test1');
    }

    // 方式2: 指定正确的collection名
    let ModelWithCollection;
    try {
        ModelWithCollection = mongoose.model('HIT_DLT_Test2', dltRedCombinationsHotWarmColdOptimizedSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');
    } catch (e) {
        ModelWithCollection = mongoose.model('HIT_DLT_Test2');
    }

    console.log('[Step 1] 验证两种Model定义方式的collection名:');
    console.log(`  Model1 (无第三参数) collection: ${ModelWithoutCollection.collection.name}`);
    console.log(`  Model2 (有第三参数) collection: ${ModelWithCollection.collection.name}`);

    // 2. 测试查询
    console.log('\n[Step 2] 测试$or查询:');
    const testPairs = [
        { base_issue: '25139', target_issue: '25140' },
        { base_issue: '25140', target_issue: '25141' },
        { base_issue: '25141', target_issue: '25142' }
    ];

    // 使用方式1查询
    const result1 = await ModelWithoutCollection.find({
        $or: testPairs.map(p => ({ base_issue: p.base_issue, target_issue: p.target_issue }))
    }).lean();
    console.log(`  Model1 (${ModelWithoutCollection.collection.name}) 查询结果: ${result1.length}条`);

    // 使用方式2查询
    const result2 = await ModelWithCollection.find({
        $or: testPairs.map(p => ({ base_issue: p.base_issue, target_issue: p.target_issue }))
    }).lean();
    console.log(`  Model2 (${ModelWithCollection.collection.name}) 查询结果: ${result2.length}条`);

    // 3. 检查正确Model的查询结果详情
    console.log('\n[Step 3] Model2查询结果详情:');
    for (const data of result2) {
        const ratioCount = data.hot_warm_cold_data ? Object.keys(data.hot_warm_cold_data).length : 0;
        const sample311 = data.hot_warm_cold_data?.['3:1:1']?.length || 0;
        console.log(`  ${data.base_issue}->${data.target_issue}: ${ratioCount}种比例, 3:1:1有${sample311}个组合`);
    }

    // 4. 模拟构建hwcOptimizedCache
    console.log('\n[Step 4] 模拟构建hwcOptimizedCache:');
    const hwcOptimizedCache = new Map();
    for (const data of result2) {
        const key = `${data.base_issue}-${data.target_issue}`;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
        }
    }
    console.log(`  缓存大小: ${hwcOptimizedCache.size}个期号对`);

    // 5. 测试缓存查找
    console.log('\n[Step 5] 测试缓存查找:');
    const testKeys = ['25139-25140', '25140-25141', '25141-25142'];
    for (const key of testKeys) {
        const hwcMap = hwcOptimizedCache.get(key);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1') || [];
            console.log(`  ${key}: ✅ 找到 (3:1:1有${ratio311.length}个组合)`);
        } else {
            console.log(`  ${key}: ❌ 未找到`);
        }
    }

    // 6. 检查server.js中实际的Model定义
    console.log('\n[Step 6] 检查已注册的Mongoose模型:');
    const registeredModels = mongoose.modelNames();
    console.log(`  已注册的模型: ${registeredModels.length}个`);
    const hwcModels = registeredModels.filter(n => n.toLowerCase().includes('hotwarmcold'));
    console.log(`  热温冷相关模型: ${hwcModels.join(', ') || '无'}`);

    await mongoose.disconnect();
    console.log('\n=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
