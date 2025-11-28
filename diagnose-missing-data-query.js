#!/usr/bin/env node

const mongoose = require('mongoose');

async function diagnoseMissingDataQuery() {
    console.log('\n🔍 诊断 missingData 查询和字段类型问题...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const MissingCollection = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

    console.log('='.repeat(60));
    console.log('测试1: 检查查询返回的 missingData 对象结构');
    console.log('='.repeat(60));

    // 用字符串查询
    const missingData = await MissingCollection.findOne({ Issue: '25123' });

    if (!missingData) {
        console.log('❌ 未找到期号 25123 的遗漏值数据！');
        await mongoose.disconnect();
        return;
    }

    console.log('\n✅ 找到遗漏值数据');
    console.log(`Issue: ${missingData.Issue} (类型: ${typeof missingData.Issue})`);

    // 检查字段名
    const keys = Object.keys(missingData);
    console.log(`\n总字段数: ${keys.length}`);
    console.log(`前10个字段: ${keys.slice(0, 10).join(', ')}`);

    // 检查球号字段的类型
    console.log('\n检查球号字段:');
    const testBalls = [1, 5, 9, 10, 12, 14, 18, 35]; // 包含温号

    testBalls.forEach(ball => {
        const strKey = String(ball);
        const numKey = ball;

        const strVal = missingData[strKey];
        const numVal = missingData[numKey];

        console.log(`\n  球号 ${ball}:`);
        console.log(`    missingData["${strKey}"] = ${strVal} (类型: ${typeof strVal})`);
        console.log(`    missingData[${numKey}] = ${numVal} (类型: ${typeof numVal})`);

        if (strVal !== undefined && numVal !== undefined && strVal !== numVal) {
            console.log(`    ⚠️  两种方式取值不同！`);
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('测试2: 模拟 calculateHotColdRatioByMissing 函数');
    console.log('='.repeat(60));

    // 当前实现
    function currentImplementation(combination, missingData) {
        let hot = 0, warm = 0, cold = 0;

        combination.forEach(ball => {
            const ballKey = typeof ball === 'number' ? ball.toString() : ball;
            const missing = parseInt(missingData[ballKey] || 0, 10);

            console.log(`    球号 ${ball} (key="${ballKey}"): missing=${missingData[ballKey]} => parsed=${missing}`);

            if (missing <= 4) hot++;
            else if (missing >= 5 && missing <= 9) warm++;
            else cold++;
        });

        return `${hot}:${warm}:${cold}`;
    }

    // 测试包含温号的组合
    const testCombo = [5, 2, 3, 6, 8]; // 应该是 4:1:0 (5是温号，2368是热号)

    console.log(`\n测试组合: [${testCombo.join(',')}]`);
    console.log('  期望结果: 4:1:0 (球号5是温号(遗漏6)，其他都是热号)');
    console.log('\n  逐球分析:');

    const ratio = currentImplementation(testCombo, missingData);
    console.log(`\n  计算结果: ${ratio}`);

    console.log('\n' + '='.repeat(60));
    console.log('测试3: 检查所有球号字段是否存在');
    console.log('='.repeat(60));

    console.log('\n所有35个球号的遗漏值:');
    for (let i = 1; i <= 35; i++) {
        const strKey = String(i);
        const val = missingData[strKey];

        if (val === undefined) {
            console.log(`  ❌ 球号 ${i} (key="${strKey}"): 不存在`);
        } else {
            const missing = parseInt(val, 10);
            const type = missing <= 4 ? '热' : (missing >= 5 && missing <= 9) ? '温' : '冷';
            console.log(`  球号 ${i} (key="${strKey}"): ${val} (${type})`);
        }
    }

    await mongoose.disconnect();
    console.log('\n✅ 诊断完成！\n');
}

diagnoseMissingDataQuery().catch(error => {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
});
