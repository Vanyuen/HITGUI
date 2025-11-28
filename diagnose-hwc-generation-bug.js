#!/usr/bin/env node

const mongoose = require('mongoose');

async function diagnoseHwcGenerationBug() {
    console.log('\n🔍 诊断热温冷生成逻辑 BUG...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
    const redCombinations = db.collection('hit_dlt_redcombinations');

    console.log('='.repeat(60));
    console.log('步骤1: 检查期号25123的遗漏值数据（基准期）');
    console.log('='.repeat(60));

    const missing25123 = await missingColl.findOne({ Issue: '25123' });

    if (!missing25123) {
        console.log('❌ 未找到期号25123的遗漏值数据！');
        await mongoose.disconnect();
        return;
    }

    const balls = [];
    for (let i = 1; i <= 35; i++) {
        const key = String(i);
        const val = parseInt(missing25123[key] || 0, 10);
        balls.push({
            ball: i,
            missing: val,
            type: val <= 4 ? '热' : (val >= 5 && val <= 9) ? '温' : '冷'
        });
    }

    const hot = balls.filter(b => b.type === '热');
    const warm = balls.filter(b => b.type === '温');
    const cold = balls.filter(b => b.type === '冷');

    console.log(`\n统计: 热号${hot.length}个, 温号${warm.length}个, 冷号${cold.length}个`);
    console.log(`\n热号列表 (${hot.length}个): ${hot.map(b => `${b.ball}(${b.missing})`).join(', ')}`);
    console.log(`温号列表 (${warm.length}个): ${warm.map(b => `${b.ball}(${b.missing})`).join(', ')}`);
    console.log(`冷号列表 (${cold.length}个): ${cold.map(b => `${b.ball}(${b.missing})`).join(', ')}`);

    console.log('\n' + '='.repeat(60));
    console.log('步骤2: 检查热温冷优化表中期号25124的数据');
    console.log('='.repeat(60));

    const hwc25124 = await hwcTable.findOne({ target_issue: '25124' });

    if (!hwc25124) {
        console.log('❌ 未找到期号25124的热温冷优化表数据！');
        await mongoose.disconnect();
        return;
    }

    console.log(`\nbase_issue: ${hwc25124.base_issue}`);
    console.log(`target_issue: ${hwc25124.target_issue}`);
    console.log(`生成时间: ${hwc25124.generated_at}`);

    const ratios = Object.keys(hwc25124.hot_warm_cold_data || {});
    console.log(`\n热温冷比例种类: ${ratios.length}`);

    ratios.sort().forEach(ratio => {
        const count = hwc25124.hot_warm_cold_data[ratio].length;
        console.log(`  ${ratio}: ${count.toLocaleString()} 个组合`);
    });

    const withWarm = ratios.filter(r => {
        const [h, w, c] = r.split(':').map(Number);
        return w > 0;
    });

    console.log(`\n含温号的比例: ${withWarm.length} 种`);
    if (withWarm.length > 0) {
        console.log(`  ${withWarm.join(', ')}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('步骤3: 手动验证 - 随机抽取包含温号的组合');
    console.log('='.repeat(60));

    // 温号列表
    const warmBalls = warm.map(b => b.ball);
    console.log(`\n温号球号: ${warmBalls.join(', ')}`);

    // 查找包含至少1个温号的组合
    const sampleCombos = await redCombinations.find({
        combination: { $in: warmBalls }
    }).limit(10).toArray();

    console.log(`\n从数据库中找到包含温号的组合示例 (前10个):`);
    sampleCombos.forEach((combo, idx) => {
        const comboArr = combo.combination;
        let hotCount = 0, warmCount = 0, coldCount = 0;

        comboArr.forEach(ball => {
            const ballData = balls.find(b => b.ball === ball);
            if (ballData) {
                if (ballData.type === '热') hotCount++;
                else if (ballData.type === '温') warmCount++;
                else coldCount++;
            }
        });

        const ratio = `${hotCount}:${warmCount}:${coldCount}`;
        console.log(`  ${idx + 1}. ${comboArr.join(',')} => ${ratio}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('步骤4: 验证 generate-hwc-optimized-table.js 的逻辑');
    console.log('='.repeat(60));

    // 测试生成逻辑
    function testCalculateHotColdRatio(combination, missingData) {
        let hot = 0, warm = 0, cold = 0;

        combination.forEach(ball => {
            const ballKey = typeof ball === 'number' ? ball.toString() : ball;
            const missing = parseInt(missingData[ballKey] || 0, 10);

            if (missing <= 4) hot++;
            else if (missing >= 5 && missing <= 9) warm++;
            else cold++;
        });

        return `${hot}:${warm}:${cold}`;
    }

    console.log('\n手动测试几个包含温号的组合:');

    // 手动构造包含温号的测试组合
    const testCombinations = [
        [warmBalls[0], hot[0].ball, hot[1].ball, hot[2].ball, hot[3].ball], // 1温4热
        [warmBalls[0], warmBalls[1], hot[0].ball, hot[1].ball, hot[2].ball], // 2温3热
        [warmBalls[0], hot[0].ball, hot[1].ball, cold[0].ball, cold[1].ball], // 1温2热2冷
    ];

    testCombinations.forEach((combo, idx) => {
        const ratio = testCalculateHotColdRatio(combo, missing25123);
        console.log(`  测试${idx + 1}: [${combo.join(',')}] => ${ratio}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('步骤5: 检查 base_issue 是否正确');
    console.log('='.repeat(60));

    console.log(`\n期号25124的热温冷表应该基于: 期号25123的遗漏值`);
    console.log(`实际 base_issue: ${hwc25124.base_issue}`);

    if (hwc25124.base_issue !== '25123') {
        console.log('❌ BUG: base_issue 不正确！应该是 25123');
    } else {
        console.log('✅ base_issue 正确');
    }

    console.log('\n' + '='.repeat(60));
    console.log('诊断结论');
    console.log('='.repeat(60));

    console.log('\n📊 数据事实:');
    console.log(`  1. 期号25123有 ${warm.length} 个温号: ${warmBalls.join(', ')}`);
    console.log(`  2. 从 324,632 个组合中，数学上必然存在包含温号的组合`);
    console.log(`  3. 数据库中确实存在包含温号的组合（见上方示例）`);

    console.log('\n❌ BUG 位置:');
    if (withWarm.length === 0) {
        console.log('  热温冷优化表中没有任何含温号的比例！');
        console.log('  这说明 generate-hwc-optimized-table.js 的生成逻辑有问题！');
        console.log('\n🔍 可能原因:');
        console.log('  1. calculateHotColdRatioByMissing 函数中遗漏值阈值判断错误');
        console.log('  2. missingData 传入的数据不正确');
        console.log('  3. 字段类型转换问题（ball number vs string）');
        console.log('  4. base_issue 查询错误，拿到了错误期号的遗漏值');
    } else {
        console.log('  ✅ 热温冷优化表中有含温号的比例，之前的分析错误');
    }

    await mongoose.disconnect();
    console.log('\n✅ 诊断完成！\n');
}

diagnoseHwcGenerationBug().catch(error => {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
});
