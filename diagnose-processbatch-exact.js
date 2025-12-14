// 精确诊断processBatch执行流程
const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('=== 精确诊断processBatch执行流程 ===\n');

    const db = mongoose.connection.db;

    // 模拟任务参数
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i);
    }

    // ============ 模拟preloadData ============
    console.log('[1] 模拟preloadData...');
    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询目标期号
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    // 查询完整ID范围
    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`  allRecords: ${allRecords.length}条 (ID ${minID - 1} ~ ${maxID})`);

    // 构建映射 (这是关键！)
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    console.log(`  idToRecordMap: ${idToRecordMap.size}条`);
    console.log(`  issueToIdMap: ${issueToIdMap.size}条`);

    // ============ 模拟批次3处理 (25139-25142) ============
    console.log('\n[2] 模拟批次3处理 (最后4期)...');
    const batch3Issues = [25139, 25140, 25141, 25142];

    // 构建issueToIDArray (这是processBatch的关键数据结构)
    const issueToIDArray = batch3Issues.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        return { issue: issueStr, id: id || null, index };
    });

    console.log('  issueToIDArray:');
    issueToIDArray.forEach((item, i) => {
        console.log(`    [${i}] issue=${item.issue}, id=${item.id}, index=${item.index}`);
    });

    // 模拟processBatch循环
    console.log('\n[3] 模拟processBatch循环...');
    for (let i = 0; i < issueToIDArray.length; i++) {
        const { issue: targetIssue, id: targetID } = issueToIDArray[i];
        console.log(`\n  === 处理期号 ${targetIssue} (i=${i}) ===`);
        console.log(`    targetID: ${targetID !== null ? targetID : '(推算期)'}`);

        let baseIssue, baseID;

        if (targetID !== null) {
            // 情况1：已开奖期号
            const baseRecord = idToRecordMap.get(targetID - 1);
            console.log(`    查询ID-1: idToRecordMap.get(${targetID - 1}) = ${baseRecord ? 'Issue=' + baseRecord.Issue : '不存在!'}`);

            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                baseID = baseRecord.ID;
                console.log(`    baseIssue: ${baseIssue} (通过ID-1规则)`);
            } else if (i > 0) {
                baseIssue = issueToIDArray[i - 1].issue;
                baseID = issueToIDArray[i - 1].id;
                console.log(`    baseIssue: ${baseIssue} (通过数组fallback)`);
            } else {
                console.log(`    ❌ 无法确定baseIssue!`);
                continue;
            }
        } else {
            // 情况2：推算期
            console.log(`    推算期处理...`);
            if (i > 0) {
                const prevElement = issueToIDArray[i - 1];
                console.log(`    前一个元素: issue=${prevElement?.issue}, id=${prevElement?.id}`);
                if (prevElement && prevElement.issue) {
                    baseIssue = prevElement.issue;
                    baseID = prevElement.id;
                    console.log(`    baseIssue: ${baseIssue} (通过前一个元素)`);
                } else {
                    console.log(`    ❌ 前一个元素异常!`);
                }
            } else {
                console.log(`    ❌ 推算期是批次第一个，需要数据库查询`);
            }
        }

        // 生成hwcKey并检查缓存
        if (baseIssue) {
            const hwcKey = `${baseIssue}-${targetIssue}`;
            console.log(`    hwcKey: ${hwcKey}`);

            // 检查HWC数据是否存在
            const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
                base_issue: baseIssue,
                target_issue: targetIssue
            });
            if (hwcData) {
                const ratio311Count = hwcData.hot_warm_cold_data?.['3:1:1']?.length || 0;
                console.log(`    HWC数据: ✅ 存在, 3:1:1有${ratio311Count}个组合`);
            } else {
                console.log(`    HWC数据: ❌ 不存在!`);
            }
        } else {
            console.log(`    ❌ baseIssue未定义，无法生成hwcKey`);
        }
    }

    await mongoose.disconnect();
    console.log('\n=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
