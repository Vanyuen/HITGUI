/**
 * 检查期号25074的数据
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async() => {
    const db = mongoose.connection.db;

    const collections = ['hit_dlt_hwcpositivepredictiontaskresults', 'HIT_DLT_HwcPositivePredictionTaskResult'];
    let result = null;

    for (const name of collections) {
        const r = await db.collection(name).findOne({ period: 25074 });
        if (r) {
            result = r;
            console.log('✅ 找到数据，集合名:', name);
            break;
        }
    }

    if (!result) {
        console.log('❌ 未找到期号25074的数据');
        const all = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').find().sort({ period: -1 }).limit(5).toArray();
        console.log('\n最近5期:');
        all.forEach(r => console.log('  ', r.task_id, '- 期号', r.period));
        await mongoose.disconnect();
        return;
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📊 期号25074详细数据分析');
    console.log('═'.repeat(80));

    console.log('\n1️⃣ 基本信息:');
    console.log('   task_id:', result.task_id);
    console.log('   period:', result.period);
    console.log('   pairing_mode:', result.pairing_mode || '未设置');

    console.log('\n2️⃣ 组合数据:');
    const redCount = result.red_combinations ? result.red_combinations.length : 0;
    const blueCount = result.blue_combinations ? result.blue_combinations.length : 0;
    const pairedCount = result.paired_combinations ? result.paired_combinations.length : 0;
    const savedCount = result.combination_count || 0;

    console.log('   combination_count:', savedCount.toLocaleString());
    console.log('   red_combinations长度:', redCount.toLocaleString());
    console.log('   blue_combinations长度:', blueCount);
    console.log('   paired_combinations长度:', pairedCount.toLocaleString());

    console.log('\n3️⃣ 数据分析:');
    console.log('   计算:', savedCount, '÷', redCount, '=', (savedCount / redCount).toFixed(2));

    if (Math.abs(savedCount / redCount - 66) < 0.1) {
        console.log('   ✅ combination_count ≈ 红球数 × 66');
    }

    if (savedCount === redCount * blueCount) {
        console.log('   ✅ combination_count = 红球数 × 蓝球数 (笛卡尔积)');
    }

    console.log('\n4️⃣ 配对模式分析:');
    const pairingMode = result.pairing_mode || 'default';
    console.log('   配对模式:', pairingMode);

    let expectedCount = 0;
    if (pairingMode === 'truly-unlimited') {
        expectedCount = redCount * blueCount;
        console.log('   预期组合数 (笛卡尔积):', expectedCount.toLocaleString());
    } else if (pairingMode === 'unlimited' || pairingMode === 'default') {
        expectedCount = redCount;
        console.log('   预期组合数 (1:1循环):', expectedCount.toLocaleString());
    }

    console.log('\n5️⃣ paired_combinations 分析:');
    if (pairedCount === 0) {
        console.log('   ⚠️ paired_combinations 为空 (旧格式数据)');
        console.log('   导出Excel时会重新配对');
    } else if (pairedCount === savedCount) {
        console.log('   ✅ paired_combinations 长度与 combination_count 一致');
    } else {
        console.log('   ❌ paired_combinations 长度与 combination_count 不一致！');
        console.log('   差异:', Math.abs(pairedCount - savedCount).toLocaleString());
    }

    console.log('\n' + '═'.repeat(80));
    console.log('💡 问题诊断:');
    console.log('═'.repeat(80));

    if (pairedCount === 0) {
        console.log('\n【旧格式数据】需要从 red_combinations 和 blue_combinations 重新配对');
        console.log('\n导出Excel时的行为:');

        if (pairingMode === 'truly-unlimited') {
            console.log('   1. 配对模式: truly-unlimited (笛卡尔积)');
            console.log('   2. 预期导出:', redCount, '×', blueCount, '=', (redCount * blueCount).toLocaleString(), '行');
            console.log('   3. 前端显示: combination_count =', savedCount.toLocaleString());

            if (savedCount === redCount * blueCount) {
                console.log('   ✅ 前端显示的数量是正确的！');
            } else {
                console.log('   ❌ 前端显示的数量可能不正确');
            }
        } else {
            console.log('   1. 配对模式:', pairingMode, '(1:1循环)');
            console.log('   2. 预期导出:', redCount, '行');
            console.log('   3. 前端显示: combination_count =', savedCount.toLocaleString());

            if (savedCount === redCount) {
                console.log('   ✅ 前端显示的数量是正确的！');
            } else if (savedCount === redCount * 66) {
                console.log('   ❌ 前端显示的数量是错误的（应该是', redCount, '不是', savedCount, '）');
            }
        }

        console.log('\n实际Excel导出了多少行？26,288 行');
        console.log('   这说明: Excel只导出了', redCount, '个红球组合（不含表头为', (redCount - 1), '）');

        if (pairingMode === 'truly-unlimited' && redCount * blueCount === savedCount) {
            console.log('\n⚠️ 发现问题: ');
            console.log('   - 前端显示: 1,735,008 (正确，笛卡尔积)');
            console.log('   - Excel导出: 26,288 (错误，只导出了红球数量)');
            console.log('   - 问题原因: 导出Excel时未正确执行笛卡尔积配对！');
        }
    }

    await mongoose.disconnect();
}).catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
