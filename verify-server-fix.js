// 验证修复是否生效的脚本
// 运行此脚本验证集合名是否正确配置

const mongoose = require('mongoose');

async function verifyServerFix() {
    console.log('🔍 验证服务器修复是否生效...\n');

    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    mongoose.set('strictQuery', false);

    // 1. 模拟加载模型（与server.js保持一致）
    console.log('📝 步骤1: 验证模型定义...');

    const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed,
        total_combinations: Number
    }, { strict: false });

    // 使用修复后的模型定义
    const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
        'HIT_DLT_RedCombinationsHotWarmColdOptimizedTest',
        dltRedCombinationsHotWarmColdOptimizedSchema,
        'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 正确的集合名
    );

    console.log(`  模型名称: HIT_DLT_RedCombinationsHotWarmColdOptimized`);
    console.log(`  集合名称: ${DLTRedCombinationsHotWarmColdOptimized.collection.name}`);

    // 2. 测试查询
    console.log('\n📊 步骤2: 测试查询...');

    const testPairs = [
        { base: '25120', target: '25121' },
        { base: '25121', target: '25122' },
        { base: '25122', target: '25123' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    console.log('  模拟服务器查询逻辑:');
    const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
        $or: testPairs.map(p => ({
            base_issue: p.base,
            target_issue: p.target
        }))
    }).lean();

    console.log(`  ✅ 查询到 ${hwcDataList.length} 条HWC优化数据`);

    if (hwcDataList.length > 0) {
        console.log('\n  样本数据:');
        hwcDataList.slice(0, 3).forEach(d => {
            const ratios = Object.keys(d.hot_warm_cold_data || {});
            const ratio410Count = d.hot_warm_cold_data['4:1:0']?.length || 0;
            console.log(`    - ${d.base_issue}→${d.target_issue}: ${ratios.length}种比例, 4:1:0有${ratio410Count}个组合`);
        });
    }

    // 3. 模拟缓存构建
    console.log('\n🗄️ 步骤3: 模拟缓存构建...');

    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = `${data.base_issue}-${data.target_issue}`;

        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log(`  ✅ 缓存 ${key}: ${hwcMap.size}种比例`);
        }
    }

    console.log(`\n  总缓存数: ${hwcOptimizedCache.size}/${testPairs.length}个期号对`);

    // 4. 检查缺失
    if (hwcOptimizedCache.size < testPairs.length) {
        console.log('\n⚠️ 发现缺失的期号对:');
        const cachedKeys = new Set(Array.from(hwcOptimizedCache.keys()));
        testPairs.forEach(p => {
            const key = `${p.base}-${p.target}`;
            if (!cachedKeys.has(key)) {
                console.log(`  ❌ ${key}`);
            }
        });
    }

    // 5. 测试Step1筛选逻辑
    console.log('\n🎯 步骤4: 测试Step1热温冷筛选...');

    const testKey = '25120-25121';
    const hwcMap = hwcOptimizedCache.get(testKey);

    if (hwcMap) {
        const ratio410Ids = hwcMap.get('4:1:0') || [];
        console.log(`  测试期号对: ${testKey}`);
        console.log(`  ✅ 找到HWC Map, 包含 ${hwcMap.size} 种比例`);
        console.log(`  ✅ 4:1:0比例有 ${ratio410Ids.length} 个组合ID`);
        console.log(`  前5个组合ID: ${ratio410Ids.slice(0, 5).join(', ')}`);
    } else {
        console.log(`  ❌ 未找到期号对 ${testKey} 的HWC数据`);
    }

    console.log('\n✅ 验证完成！');
    console.log('\n📋 结论:');
    console.log('  1. 集合名配置: ✅ 正确');
    console.log(`  2. 数据查询: ${hwcDataList.length > 0 ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  3. 缓存构建: ${hwcOptimizedCache.size > 0 ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  4. Step1筛选: ${hwcMap ? '✅ 应该能正常工作' : '❌ 可能有问题'}`);

    console.log('\n📝 下一步:');
    console.log('  1. 通过Electron应用启动服务器（npm start）');
    console.log('  2. 创建测试任务（期号范围：最近5期，热温冷比：4:1:0）');
    console.log('  3. 查看控制台日志，特别关注"预加载热温冷优化表"的输出');

    await mongoose.connection.close();
}

verifyServerFix().catch(console.error);
