/**
 * 诊断多批次场景下的批次边界Bug
 * 检查期号25091和25141的ID映射和缓存状态
 */
const mongoose = require('mongoose');

async function diagnoseMultiBatchBug() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const dltSchema = new mongoose.Schema({}, { strict: false });
    const hit_dlts = mongoose.model('DLT_Diag', dltSchema, 'hit_dlts');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_Diag', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== 诊断多批次批次边界Bug ===\n');

    // 1. 获取任务期号范围对应的ID
    const taskPeriods = [];
    for (let i = 25042; i <= 25142; i++) {
        taskPeriods.push(i);
    }
    console.log(`任务期号范围: 25042-25142 (${taskPeriods.length}期)\n`);

    // 2. 查询所有期号的ID
    const allRecords = await hit_dlts.find({ Issue: { $in: taskPeriods } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`数据库中找到的期号: ${allRecords.length}条\n`);

    // 3. 构建ID映射
    const issueToIDMap = new Map();
    const idToRecordMap = new Map();
    for (const record of allRecords) {
        issueToIDMap.set(record.Issue.toString(), record.ID);
        idToRecordMap.set(record.ID, record);
    }

    // 4. 检查批次边界期号
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < taskPeriods.length; i += batchSize) {
        batches.push(taskPeriods.slice(i, i + batchSize));
    }
    console.log(`批次数量: ${batches.length}`);
    for (let b = 0; b < batches.length; b++) {
        console.log(`  批次${b + 1}: ${batches[b][0]}-${batches[b][batches[b].length - 1]} (${batches[b].length}期)`);
    }
    console.log('');

    // 5. 检查每个批次最后一期的ID-1映射
    const boundaryPeriods = [25091, 25141, 25142]; // 批次1末, 批次2末, 批次3(推算期)
    console.log('=== 批次边界期号分析 ===\n');

    for (const period of boundaryPeriods) {
        const periodID = issueToIDMap.get(period.toString());
        console.log(`期号${period}:`);
        console.log(`  - ID: ${periodID || '不存在(推算期)'}`);

        if (periodID) {
            const baseRecord = idToRecordMap.get(periodID - 1);
            console.log(`  - ID-1 (${periodID - 1}): ${baseRecord ? `期号${baseRecord.Issue}` : '❌ 不存在!'}`);

            // 检查HWC缓存是否存在
            const hwcKey = baseRecord ? `${baseRecord.Issue}-${period}` : null;
            console.log(`  - HWC缓存Key: ${hwcKey || 'N/A'}`);

            if (hwcKey) {
                const hwcData = await HwcOptimized.findOne({
                    base_issue: parseInt(baseRecord.Issue),
                    target_issue: period
                }).lean();
                console.log(`  - HWC数据: ${hwcData ? `存在 (${hwcData.combinations_by_ratio?.length || 0}种比例)` : '❌ 不存在!'}`);
            }
        } else {
            // 推算期
            const latestRecord = allRecords[allRecords.length - 1];
            console.log(`  - 推算期基准: ${latestRecord?.Issue || 'N/A'}`);

            if (latestRecord) {
                const hwcKey = `${latestRecord.Issue}-${period}`;
                console.log(`  - HWC缓存Key(推算期): ${hwcKey}`);

                const hwcData = await HwcOptimized.findOne({
                    base_issue: latestRecord.Issue,
                    target_issue: period
                }).lean();
                console.log(`  - HWC数据(推算期): ${hwcData ? `存在 (${hwcData.combinations_by_ratio?.length || 0}种比例)` : '❌ 不存在!'}`);
            }
        }
        console.log('');
    }

    // 6. 检查preloadDataForIssues的ID范围
    console.log('=== ID范围分析 ===\n');
    const minID = allRecords[0].ID;
    const maxID = allRecords[allRecords.length - 1].ID;
    console.log(`preloadDataForIssues查询的ID范围: ${minID - 1} ~ ${maxID}`);
    console.log(`实际记录数: ${allRecords.length}`);

    // 检查ID-1是否在范围内
    const id25091 = issueToIDMap.get('25091');
    const id25141 = issueToIDMap.get('25141');
    console.log(`\n期号25091的ID: ${id25091}, ID-1: ${id25091 - 1}, 在范围内: ${id25091 - 1 >= minID - 1}`);
    console.log(`期号25141的ID: ${id25141}, ID-1: ${id25141 - 1}, 在范围内: ${id25141 - 1 >= minID - 1}`);

    // 7. 检查ID连续性
    console.log('\n=== ID连续性检查 ===');
    let gapCount = 0;
    for (let i = 1; i < allRecords.length; i++) {
        const expectedID = allRecords[i - 1].ID + 1;
        const actualID = allRecords[i].ID;
        if (actualID !== expectedID) {
            gapCount++;
            if (gapCount <= 5) {
                console.log(`Gap: ID ${allRecords[i - 1].ID} → ${allRecords[i].ID} (期号 ${allRecords[i - 1].Issue} → ${allRecords[i].Issue})`);
            }
        }
    }
    console.log(`ID间隙总数: ${gapCount}`);

    // 8. 列出批次边界前后5个期号的详细信息
    console.log('\n=== 批次边界前后期号详情 ===');
    for (const boundary of [25091, 25141]) {
        console.log(`\n--- 期号${boundary}附近 ---`);
        for (let p = boundary - 2; p <= boundary + 2; p++) {
            const id = issueToIDMap.get(p.toString());
            if (id) {
                const baseRec = idToRecordMap.get(id - 1);
                console.log(`  ${p}: ID=${id}, ID-1=${id-1} → ${baseRec ? '期号' + baseRec.Issue : '❌不存在'}`);
            } else {
                console.log(`  ${p}: 不在数据库中`);
            }
        }
    }

    await mongoose.disconnect();
}

diagnoseMultiBatchBug().catch(e => { console.error(e); process.exit(1); });
