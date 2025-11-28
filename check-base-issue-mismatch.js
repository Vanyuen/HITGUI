#!/usr/bin/env node

const mongoose = require('mongoose');

async function checkWrongBaseIssue() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
    const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

    console.log('\n=== 检查期号25124的热温冷优化表用了哪个base_issue ===\n');

    const hwc25124 = await hwcTable.findOne({ target_issue: '25124' });
    console.log(`base_issue: ${hwc25124.base_issue}`);
    console.log(`target_issue: ${hwc25124.target_issue}`);
    console.log(`generated_at: ${hwc25124.generated_at}`);

    // 检查base_issue的遗漏值
    const baseMissing = await missingColl.findOne({ Issue: hwc25124.base_issue });

    console.log(`\n期号 ${hwc25124.base_issue} 的温号:`);
    let warmCount = 0;
    for (let i = 1; i <= 35; i++) {
        const val = parseInt(baseMissing[String(i)] || 0);
        if (val >= 5 && val <= 9) {
            console.log(`  球号${i}: 遗漏${val}`);
            warmCount++;
        }
    }
    console.log(`温号总数: ${warmCount}`);

    // 对比期号25122和25123
    console.log('\n=== 对比期号25122和25123的温号 ===\n');

    const missing25122 = await missingColl.findOne({ Issue: '25122' });
    console.log('期号25122的温号:');
    let warm25122 = 0;
    for (let i = 1; i <= 35; i++) {
        const val = parseInt(missing25122[String(i)] || 0);
        if (val >= 5 && val <= 9) {
            console.log(`  球号${i}: 遗漏${val}`);
            warm25122++;
        }
    }
    console.log(`温号总数: ${warm25122}`);

    const missing25123 = await missingColl.findOne({ Issue: '25123' });
    console.log('\n期号25123的温号:');
    let warm25123 = 0;
    for (let i = 1; i <= 35; i++) {
        const val = parseInt(missing25123[String(i)] || 0);
        if (val >= 5 && val <= 9) {
            console.log(`  球号${i}: 遗漏${val}`);
            warm25123++;
        }
    }
    console.log(`温号总数: ${warm25123}`);

    await mongoose.disconnect();
}

checkWrongBaseIssue().catch(console.error);
