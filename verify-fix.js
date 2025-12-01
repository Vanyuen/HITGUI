/**
 * 验证修复脚本：验证 ID 范围查询是否能正确为所有期号找到基准期
 */

const mongoose = require('mongoose');

async function verifyFix() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 验证修复：ID范围查询 ===\n');

    const hit_dlts = mongoose.connection.db.collection('hit_dlts');
    const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 模拟不连续的期号（类似于实际任务）
    const issueNumbers = [25075, 25076, 25077, 25124];  // 注意：25077到25124不连续
    console.log('1. 目标期号 (不连续):', issueNumbers);

    // 旧方法（有问题）
    console.log('\n=== 旧方法：$or 条件查询 ===');
    const firstIssueRecord = await hit_dlts.findOne({ Issue: issueNumbers[0] });
    if (!firstIssueRecord) {
        console.log('找不到第一个期号');
        await mongoose.disconnect();
        return;
    }

    const allIssueNums_old = [firstIssueRecord.ID - 1, ...issueNumbers];
    const allRecords_old = await hit_dlts.find({
        $or: [
            { ID: { $in: allIssueNums_old } },
            { Issue: { $in: issueNumbers } }
        ]
    }).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();

    console.log('旧方法查询结果:', allRecords_old.length, '条记录');
    const idToRecordMap_old = new Map(allRecords_old.map(r => [r.ID, r]));

    let missingCount_old = 0;
    for (const issue of issueNumbers) {
        const record = await hit_dlts.findOne({ Issue: issue });
        if (record) {
            const baseRecord = idToRecordMap_old.get(record.ID - 1);
            if (!baseRecord) {
                console.log(`  ❌ 期号 ${issue} (ID=${record.ID}) 的基准期 (ID=${record.ID-1}) 不在结果中`);
                missingCount_old++;
            }
        }
    }
    console.log(`旧方法：${missingCount_old} 个期号找不到基准期`);

    // 新方法（修复后）
    console.log('\n=== 新方法：ID范围查询 ===');
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .project({ Issue: 1, ID: 1 })
        .sort({ ID: 1 })
        .toArray();

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('目标期号ID范围:', minID, '-', maxID);

    const allRecords_new = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    }).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();

    console.log('新方法查询结果:', allRecords_new.length, '条记录');
    const idToRecordMap_new = new Map(allRecords_new.map(r => [r.ID, r]));

    let missingCount_new = 0;
    const issuePairs = [];
    for (const issue of issueNumbers) {
        const record = await hit_dlts.findOne({ Issue: issue });
        if (record) {
            const baseRecord = idToRecordMap_new.get(record.ID - 1);
            if (baseRecord) {
                issuePairs.push({
                    base_issue: baseRecord.Issue.toString(),
                    target_issue: record.Issue.toString()
                });
                console.log(`  ✅ 期号 ${issue} (ID=${record.ID}) → 基准期 ${baseRecord.Issue} (ID=${baseRecord.ID})`);
            } else {
                console.log(`  ❌ 期号 ${issue} (ID=${record.ID}) 的基准期 (ID=${record.ID-1}) 不在结果中`);
                missingCount_new++;
            }
        }
    }
    console.log(`新方法：${missingCount_new} 个期号找不到基准期`);

    // 验证 HWC 缓存查找
    console.log('\n=== 验证 HWC 缓存查找 ===');
    for (const pair of issuePairs) {
        const hwcData = await HwcOptimized.findOne({
            base_issue: pair.base_issue,
            target_issue: pair.target_issue
        });

        const hwcKey = `${pair.base_issue}-${pair.target_issue}`;
        if (hwcData && hwcData.hot_warm_cold_data) {
            const ratios = Object.keys(hwcData.hot_warm_cold_data);
            const ratio410 = hwcData.hot_warm_cold_data['4:1:0'];
            console.log(`  ✅ ${hwcKey}: ${ratios.length} 个比例, 4:1:0有 ${ratio410?.length || 0} 个组合`);
        } else {
            console.log(`  ❌ ${hwcKey}: 未找到HWC数据`);
        }
    }

    console.log('\n=== 修复验证完成 ===');
    console.log(`旧方法缺失: ${missingCount_old} 个`);
    console.log(`新方法缺失: ${missingCount_new} 个`);

    if (missingCount_new === 0 && missingCount_old > 0) {
        console.log('\n✅ 修复成功！新方法解决了期号不连续时的基准期查找问题');
    } else if (missingCount_new === 0 && missingCount_old === 0) {
        console.log('\n✅ 两种方法都工作正常（测试数据可能是连续的）');
    } else {
        console.log('\n⚠️ 仍有问题，需要进一步排查');
    }

    await mongoose.disconnect();
}

verifyFix().catch(console.error);
