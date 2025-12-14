/**
 * 直接测试HwcPositivePredictor的关键路径
 * 模拟实际运行时的状态
 */

const path = require('path');

// 需要在server.js相同目录运行，确保能正确加载模块
async function runTest() {
    console.log('=== 直接测试HwcPositivePredictor ===\n');

    // 加载server模块 (需要修改server.js导出相关类)
    // 由于server.js是一个Express应用，我们需要直接连接数据库并模拟关键逻辑

    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const db = mongoose.connection.db;

    // 模拟任务参数
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }

    console.log('[1] 模拟preloadData数据结构构建...\n');

    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询所有目标期号
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`targetRecords: ${targetRecords.length}条`);

    if (targetRecords.length === 0) {
        console.log('没有找到记录!');
        await mongoose.disconnect();
        return;
    }

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    // 查询完整ID范围
    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`allRecords: ${allRecords.length}条 (ID ${minID - 1} ~ ${maxID})`);

    // 构建映射 - 这是关键！
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    console.log(`idToRecordMap: ${idToRecordMap.size}个条目`);
    console.log(`issueToIdMap: ${issueToIdMap.size}个条目\n`);

    // 检查25141的关键数据
    console.log('[2] 检查25141的关键数据...\n');

    const targetIssue25141 = '25141';
    const targetID25141 = issueToIdMap.get(targetIssue25141);
    console.log(`25141的targetID: ${targetID25141}`);

    if (targetID25141) {
        const baseRecord25141 = idToRecordMap.get(targetID25141 - 1);
        console.log(`25141的baseRecord (ID=${targetID25141 - 1}): ${baseRecord25141 ? `存在, Issue=${baseRecord25141.Issue}` : '不存在!'}`);

        if (baseRecord25141) {
            const baseIssue25141 = baseRecord25141.Issue.toString();
            const hwcKey25141 = `${baseIssue25141}-${targetIssue25141}`;
            console.log(`25141的hwcKey: ${hwcKey25141}`);

            // 检查HWC数据
            const hwcData25141 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({ base_issue: baseIssue25141, target_issue: targetIssue25141 });

            if (hwcData25141) {
                const ratio311Count = hwcData25141.hot_warm_cold_data?.['3:1:1']?.length || 0;
                console.log(`25141的HWC数据: 存在, 3:1:1有${ratio311Count}个组合`);
            } else {
                console.log(`25141的HWC数据: 不存在!`);
            }
        }
    } else {
        console.log(`25141不在issueToIdMap中!`);
    }

    // 检查25142（推算期）
    console.log('\n[3] 检查25142（推算期）的关键数据...\n');

    const targetIssue25142 = '25142';
    const targetID25142 = issueToIdMap.get(targetIssue25142);
    console.log(`25142的targetID: ${targetID25142 !== undefined ? targetID25142 : '未定义 (推算期)'}`);

    // 推算期的baseIssue应该是最大已开奖期号
    const existingIssueNums = new Set(targetRecords.map(r => r.Issue));
    const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
    console.log(`最大已开奖期号: ${maxExistingIssue}`);

    const baseIssue25142 = maxExistingIssue.toString();
    const hwcKey25142 = `${baseIssue25142}-${targetIssue25142}`;
    console.log(`25142的hwcKey: ${hwcKey25142}`);

    const hwcData25142 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: baseIssue25142, target_issue: targetIssue25142 });

    if (hwcData25142) {
        const ratio311Count = hwcData25142.hot_warm_cold_data?.['3:1:1']?.length || 0;
        console.log(`25142的HWC数据: 存在, 3:1:1有${ratio311Count}个组合`);
    } else {
        console.log(`25142的HWC数据: 不存在!`);
    }

    // 模拟processBatch中的批次处理
    console.log('\n[4] 模拟processBatch中Batch 2和Batch 3的处理...\n');

    // Batch 2: 25092-25141 (50期)
    const batch2 = targetIssues.slice(50, 100);
    console.log(`Batch 2: ${batch2[0]} - ${batch2[batch2.length - 1]} (${batch2.length}期)`);

    // 检查Batch 2中25141的处理
    const idx25141InBatch2 = batch2.indexOf('25141');
    console.log(`25141在Batch 2中的index: ${idx25141InBatch2}`);

    // 模拟issueToIDArray构建
    const issueToIDArray2 = batch2.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        return { issue: issueStr, id: id || null, index };
    });

    const item25141 = issueToIDArray2.find(item => item.issue === '25141');
    console.log(`25141的issueToIDArray条目: ${JSON.stringify(item25141)}`);

    // 模拟25141的baseIssue确定
    if (item25141 && item25141.id !== null) {
        const baseRecordFor25141 = idToRecordMap.get(item25141.id - 1);
        console.log(`25141的baseRecord查找结果: ${baseRecordFor25141 ? `Issue=${baseRecordFor25141.Issue}` : '不存在!'}`);
    }

    // Batch 3: 25142 (1期)
    const batch3 = targetIssues.slice(100);
    console.log(`\nBatch 3: ${batch3.join(', ')} (${batch3.length}期)`);

    const issueToIDArray3 = batch3.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        return { issue: issueStr, id: id || null, index };
    });

    const item25142 = issueToIDArray3[0];
    console.log(`25142的issueToIDArray条目: ${JSON.stringify(item25142)}`);
    console.log(`25142的index: ${item25142.index}`);
    console.log(`25142是推算期 (id===null): ${item25142.id === null}`);

    if (item25142.id === null && item25142.index === 0) {
        console.log(`推算期25142在批次index=0，需要从数据库查询最新期号`);
        const latestRecord = await db.collection('hit_dlts').findOne({}, { sort: { ID: -1 } });
        console.log(`数据库最新期号: ${latestRecord.Issue}`);
        console.log(`这将用作baseIssue: ${latestRecord.Issue}`);
    }

    await mongoose.disconnect();
    console.log('\n=== 测试完成 ===');
}

runTest().catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
});
