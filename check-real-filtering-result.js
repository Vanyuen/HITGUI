/**
 * 检查真正的筛选结果
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async() => {
    const db = mongoose.connection.db;
    // 尝试多个集合名称
    let result = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne({
        task_id: 'hwc-pos-20251111-yzc',
        period: 25116
    });

    if (!result) {
        result = await db.collection('HIT_DLT_HwcPositivePredictionTaskResult').findOne({
            task_id: 'hwc-pos-20251111-yzc',
            period: 25116
        });
    }

    if (!result) {
        console.log('❌ 未找到数据');
        await mongoose.disconnect();
        return;
    }

    console.log('📊 期号25116的完整数据分析\n');
    console.log('═'.repeat(80));

    console.log('\n1️⃣ 数据库保存的原始数据:');
    console.log('   combination_count:', result.combination_count);
    console.log('   red_combinations数组长度:', result.red_combinations ? result.red_combinations.length : 0);
    console.log('   blue_combinations数组长度:', result.blue_combinations ? result.blue_combinations.length : 0);
    console.log('   pairing_mode:', result.pairing_mode || '未设置');
    console.log('   paired_combinations长度:', result.paired_combinations ? result.paired_combinations.length : 0);

    console.log('\n2️⃣ 排除条件统计 (exclusion_summary):');
    if (result.exclusion_summary) {
        console.log(JSON.stringify(result.exclusion_summary, null, 2));
    } else {
        console.log('   无统计信息');
    }

    console.log('\n3️⃣ 正选筛选详情 (positive_selection_details):');
    if (result.positive_selection_details) {
        console.log(JSON.stringify(result.positive_selection_details, null, 2));
    } else {
        console.log('   无筛选详情');
    }

    console.log('\n4️⃣ 前10个红球组合ID:');
    if (result.red_combinations) {
        console.log('   ', result.red_combinations.slice(0, 10));
    }

    console.log('\n' + '═'.repeat(80));
    console.log('💡 结论分析:\n');

    const redCount = result.red_combinations ? result.red_combinations.length : 0;
    const savedCount = result.combination_count || 0;
    const pairingMode = result.pairing_mode || 'default';

    console.log('   红球组合数:', redCount, '个');
    console.log('   配对模式:', pairingMode);

    if (pairingMode === 'unlimited' || pairingMode === 'default') {
        console.log('   预期配对数:', redCount, '个 (1:1循环匹配)');
    } else if (pairingMode === 'truly-unlimited') {
        console.log('   预期配对数:', redCount * 66, '个 (笛卡尔积)');
    }

    console.log('   实际保存的combination_count:', savedCount);

    if (savedCount === redCount * 66) {
        console.log('\n   ⚠️ combination_count = 红球数×66，可能是旧代码bug');
        console.log('   ✅ 真正的筛选结果应该是:', redCount, '个组合');
    } else if (savedCount === redCount) {
        console.log('\n   ✅ combination_count 正确，与红球数一致');
    } else {
        console.log('\n   ❓ combination_count 与预期不符，需要进一步分析');
    }

    await mongoose.disconnect();
}).catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
