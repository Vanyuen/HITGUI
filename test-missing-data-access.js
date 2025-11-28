#!/usr/bin/env node

const mongoose = require('mongoose');

async function testMissingDataAccess() {
    console.log('\n🔍 测试 missingData 字段访问问题...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const MissingCollection = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

    const base_issue = '25123';
    console.log(`查询期号: ${base_issue}\n`);

    const missingData = await MissingCollection.findOne({ Issue: base_issue });

    if (!missingData) {
        console.log('❌ 未找到数据！');
        await mongoose.disconnect();
        return;
    }

    console.log('✅ 找到数据\n');
    console.log('='.repeat(60));
    console.log('测试场景1: 正确的字段访问');
    console.log('='.repeat(60));

    // 正确方式：温号球号 5
    const ball5_str = missingData['5'];
    const ball5_num = missingData[5];

    console.log(`\nmissingData['5'] = ${ball5_str} (类型: ${typeof ball5_str})`);
    console.log(`missingData[5] = ${ball5_num} (类型: ${typeof ball5_num})`);
    console.log(`parseInt(ball5_str || 0) = ${parseInt(ball5_str || 0)}`);

    console.log('\n' + '='.repeat(60));
    console.log('测试场景2: 模拟第一次生成时可能的错误');
    console.log('='.repeat(60));

    // 假设第一次生成时，missingData 是空对象或字段名不对
    const emptyData = {};
    const wrongFieldData = { '1_missing': 10, '5_missing': 6 }; // 错误的字段名

    console.log('\n如果 missingData 是空对象:');
    const testBall = 5;
    const ballKey = testBall.toString();
    const missing1 = parseInt(emptyData[ballKey] || 0, 10);
    console.log(`  parseInt(emptyData['${ballKey}'] || 0) = ${missing1}`);
    console.log(`  判定: ${missing1 <= 4 ? '热' : missing1 <= 9 ? '温' : '冷'}`);

    console.log('\n如果字段名错误:');
    const missing2 = parseInt(wrongFieldData[ballKey] || 0, 10);
    console.log(`  parseInt(wrongFieldData['${ballKey}'] || 0) = ${missing2}`);
    console.log(`  判定: ${missing2 <= 4 ? '热' : missing2 <= 9 ? '温' : '冷'}`);

    console.log('\n' + '='.repeat(60));
    console.log('测试场景3: 检查数据库字段结构');
    console.log('='.repeat(60));

    const allKeys = Object.keys(missingData);
    console.log(`\n总字段数: ${allKeys.length}`);
    console.log(`字段列表: ${allKeys.join(', ')}`);

    // 检查是否所有1-35的球号都存在
    console.log('\n检查球号字段完整性:');
    let missingFields = [];
    for (let i = 1; i <= 35; i++) {
        const key = String(i);
        if (missingData[key] === undefined) {
            missingFields.push(i);
        }
    }

    if (missingFields.length > 0) {
        console.log(`❌ 缺失球号字段: ${missingFields.join(', ')}`);
    } else {
        console.log(`✅ 所有球号字段都存在（1-35）`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试场景4: Issue 查询类型问题');
    console.log('='.repeat(60));

    // 测试用数字查询
    const missingDataNum = await MissingCollection.findOne({ Issue: parseInt(base_issue) });
    console.log(`\n用数字查询 Issue: ${parseInt(base_issue)}`);
    console.log(`结果: ${missingDataNum ? '✅ 找到' : '❌ 未找到'}`);

    if (!missingDataNum) {
        console.log('\n⚠️  这就是 BUG！第一次生成时如果用 parseInt(base_issue) 查询，');
        console.log('    会查询失败，导致 missingData 为 null，');
        console.log('    然后代码跳过该期号，不生成数据！');
    }

    await mongoose.disconnect();
    console.log('\n✅ 测试完成！\n');
}

testMissingDataAccess().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});
