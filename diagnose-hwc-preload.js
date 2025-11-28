/**
 * 诊断热温冷优化表预加载问题
 * 检查数据库数据结构和预加载逻辑
 */

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const hwcOptimizedSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });
const HWCOptimized = mongoose.model('HWCOptimized_Diagnose', hwcOptimizedSchema);

async function diagnosPreload() {
    console.log('🔍 开始诊断热温冷优化表预加载问题...\n');

    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 1. 检查数据库中的数据结构
        console.log('📊 步骤1: 检查数据库中的数据结构...');
        const sampleDoc = await HWCOptimized.findOne({
            base_issue: '25113',
            target_issue: '25114'
        }).lean();

        if (!sampleDoc) {
            console.error('❌ 未找到期号对 25113→25114 的数据');
            await mongoose.disconnect();
            return;
        }

        console.log(`✅ 找到期号对: ${sampleDoc.base_issue}→${sampleDoc.target_issue}`);
        console.log(`📦 数据字段:`, Object.keys(sampleDoc));
        console.log();

        // 检查 hot_warm_cold_data 字段
        if (sampleDoc.hot_warm_cold_data) {
            console.log('✅ hot_warm_cold_data 字段存在');
            const ratios = Object.keys(sampleDoc.hot_warm_cold_data);
            console.log(`📊 包含 ${ratios.length} 种热温冷比:`, ratios.slice(0, 5));

            if (ratios.length > 0) {
                const firstRatio = ratios[0];
                const ids = sampleDoc.hot_warm_cold_data[firstRatio];
                console.log(`📊 第一个比例 "${firstRatio}" 包含 ${ids.length} 个组合ID`);
            }
        } else {
            console.error('❌ hot_warm_cold_data 字段不存在！');
        }
        console.log();

        // 2. 模拟预加载逻辑
        console.log('📊 步骤2: 模拟预加载逻辑...');

        const issuePairs = [
            { base_issue: '25113', target_issue: '25114' },
            { base_issue: '25114', target_issue: '25115' }
        ];

        const hwcDataList = await HWCOptimized.find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        }).lean();

        console.log(`✅ 查询到 ${hwcDataList.length} 条数据`);

        // 构建缓存（模拟代码中的逻辑）
        const hwcOptimizedCache = new Map();
        for (const data of hwcDataList) {
            const key = `${data.base_issue}-${data.target_issue}`;

            console.log(`\n处理期号对: ${key}`);
            console.log(`  字段: base_issue="${data.base_issue}", target_issue="${data.target_issue}"`);
            console.log(`  字段类型: base_issue=${typeof data.base_issue}, target_issue=${typeof data.target_issue}`);

            // 检查 hwc_map 字段（代码中使用的）
            if (data.hwc_map) {
                console.log(`  ✅ 找到 hwc_map 字段 (类型: ${typeof data.hwc_map})`);
                hwcOptimizedCache.set(key, data.hwc_map);
            }
            // 检查 hot_warm_cold_data 字段（数据库中实际的）
            else if (data.hot_warm_cold_data) {
                console.log(`  ⚠️  没有 hwc_map 字段，但有 hot_warm_cold_data 字段`);
                console.log(`  💡 需要将 hot_warm_cold_data 转换为 Map 格式`);

                // 转换为 Map 格式
                const hwcMap = new Map();
                for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                    hwcMap.set(ratio, ids);
                }
                hwcOptimizedCache.set(key, hwcMap);
                console.log(`  ✅ 已转换为 Map: ${hwcMap.size} 个比例`);
            } else {
                console.log(`  ❌ 既没有 hwc_map 也没有 hot_warm_cold_data 字段！`);
            }
        }

        console.log(`\n📊 缓存构建完成: ${hwcOptimizedCache.size} 个期号对`);

        // 3. 模拟查询逻辑
        console.log('\n📊 步骤3: 模拟查询逻辑...');

        for (const pair of issuePairs) {
            const key = `${pair.base_issue}-${pair.target_issue}`;
            const hwcMap = hwcOptimizedCache.get(key);

            console.log(`\n查询期号对: ${key}`);
            if (hwcMap) {
                console.log(`  ✅ 缓存命中！Map大小: ${hwcMap.size}`);

                // 测试获取特定比例的数据
                const testRatio = '4:1:0';
                const ids = hwcMap.get(testRatio);
                if (ids) {
                    console.log(`  ✅ 比例 "${testRatio}" 包含 ${ids.length} 个组合ID`);
                } else {
                    console.log(`  ⚠️  比例 "${testRatio}" 不存在`);
                }
            } else {
                console.error(`  ❌ 缓存未命中！将fallback到动态计算`);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error.stack);
        await mongoose.disconnect();
    }
}

diagnosPreload();
