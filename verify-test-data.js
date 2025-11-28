#!/usr/bin/env node

const mongoose = require('mongoose');

async function verifyTestData() {
    console.log('\n✅ 验证测试数据正确性...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
    const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

    const testIssues = ['25121', '25122', '25123', '25124'];

    console.log('='.repeat(60));
    console.log('验证测试数据（期号 25121-25124）');
    console.log('='.repeat(60));

    for (const targetIssue of testIssues) {
        console.log(`\n期号 ${targetIssue}:`);
        console.log('-'.repeat(60));

        const hwcRecord = await hwcTable.findOne({ target_issue: targetIssue });

        if (!hwcRecord) {
            console.log('  ❌ 未找到热温冷优化表记录！');
            continue;
        }

        console.log(`  base_issue: ${hwcRecord.base_issue}`);
        console.log(`  target_issue: ${hwcRecord.target_issue}`);
        console.log(`  generated_at: ${hwcRecord.generated_at}`);

        const ratios = Object.keys(hwcRecord.hot_warm_cold_data || {});
        console.log(`  热温冷比例种类: ${ratios.length}`);

        // 检查是否有温号
        const withWarm = ratios.filter(r => {
            const [h, w, c] = r.split(':').map(Number);
            return w > 0;
        });

        console.log(`  含温号的比例: ${withWarm.length} 种`);

        if (withWarm.length > 0) {
            console.log(`  ✅ 数据正确（包含温号）`);
            console.log(`  温号比例示例: ${withWarm.slice(0, 5).join(', ')}`);

            // 验证 4:1:0 是否存在
            if (hwcRecord.hot_warm_cold_data['4:1:0']) {
                const count = hwcRecord.hot_warm_cold_data['4:1:0'].length;
                console.log(`  ✅ 找到 4:1:0 比例: ${count.toLocaleString()} 个组合`);
            } else {
                console.log(`  ⚠️  未找到 4:1:0 比例（可能该期确实没有）`);
            }
        } else {
            console.log(`  ❌ 数据错误（无温号）`);
        }

        // 验证 base_issue 的遗漏值数据
        const baseIssue = hwcRecord.base_issue;
        const missingData = await missingColl.findOne({ Issue: baseIssue });

        if (missingData) {
            let hotCount = 0, warmCount = 0, coldCount = 0;

            for (let i = 1; i <= 35; i++) {
                const missing = parseInt(missingData[String(i)] || 0, 10);
                if (missing <= 4) hotCount++;
                else if (missing >= 5 && missing <= 9) warmCount++;
                else coldCount++;
            }

            console.log(`  期号 ${baseIssue} 遗漏值统计: 热${hotCount} 温${warmCount} 冷${coldCount}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('数据库统计');
    console.log('='.repeat(60));

    const totalRecords = await hwcTable.countDocuments();
    console.log(`\n总记录数: ${totalRecords} 条`);

    // 检查是否有无温号的记录
    const allRecords = await hwcTable.find({}).toArray();
    let wrongCount = 0;

    for (const record of allRecords) {
        const ratios = Object.keys(record.hot_warm_cold_data || {});
        const withWarm = ratios.filter(r => {
            const [h, w, c] = r.split(':').map(Number);
            return w > 0;
        });

        if (withWarm.length === 0) {
            wrongCount++;
        }
    }

    console.log(`含温号的记录: ${totalRecords - wrongCount} 条`);
    console.log(`无温号的记录: ${wrongCount} 条`);

    if (wrongCount === 0) {
        console.log('\n✅ 所有记录都正确包含温号比例！');
    } else {
        console.log('\n❌ 发现错误记录（无温号）！');
    }

    await mongoose.disconnect();
    console.log('\n✅ 验证完成！\n');
}

verifyTestData().catch(error => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
});
