/**
 * 模拟处理25124期号，排查0组合的原因
 */

const mongoose = require('mongoose');

async function simulate() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 模拟resolveIssueRangeInternal返回的降序数组（最近6期）
        const targetIssues = ['25125', '25124', '25123', '25122', '25121', '25120'];

        console.log('='.repeat(80));
        console.log('📊 第一步：解析期号范围（降序）');
        console.log('='.repeat(80));
        console.log('期号数组:', targetIssues.join(', '));
        console.log('');

        // 模拟preloadData中的期号对生成逻辑
        console.log('='.repeat(80));
        console.log('🔄 第二步：基于ID生成期号对');
        console.log('='.repeat(80));

        const issueNumbers = targetIssues.map(i => parseInt(i));
        console.log('期号数值:', issueNumbers.join(', '));
        console.log('');

        // 查询所有期号的记录
        const targetRecords = await hit_dlts.find({
            Issue: { $in: issueNumbers }
        }, { projection: { Issue: 1, ID: 1 } }).sort({ ID: 1 }).toArray();

        console.log(`查询到 ${targetRecords.length} 条记录:`);
        targetRecords.forEach(r => {
            console.log(`  期号 ${r.Issue}, ID: ${r.ID}`);
        });
        console.log('');

        // 构建映射
        const idToRecordMap = new Map(targetRecords.map(r => [r.ID, r]));
        const issueToRecordMap = new Map(targetRecords.map(r => [r.Issue, r]));

        // 最新已开奖期号
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 } });
        const latestIssue = latestRecord.Issue;
        console.log(`最新已开奖期号: ${latestIssue}\n`);

        // 生成期号对
        const issuePairs = [];
        console.log('期号对生成过程:');

        for (let i = 0; i < issueNumbers.length; i++) {
            const targetIssueNum = issueNumbers[i];
            const targetRecord = issueToRecordMap.get(targetIssueNum);

            if (!targetRecord) {
                console.log(`  ${i+1}. 期号${targetIssueNum}: ⚠️ 不存在（推算期），跳过`);
                continue;
            }

            const targetID = targetRecord.ID;
            const targetIssue = targetRecord.Issue.toString();
            const baseRecord = idToRecordMap.get(targetID - 1);

            if (baseRecord) {
                issuePairs.push({
                    base_issue: baseRecord.Issue.toString(),
                    target_issue: targetIssue
                });
                console.log(`  ${i+1}. ${baseRecord.Issue} → ${targetIssue} (ID ${baseRecord.ID} → ${targetID}) ${targetIssueNum > latestIssue ? '🔮推算' : '✅已开奖'}`);
            } else {
                // 查询数据库
                const baseRecordFromDB = await hit_dlts.findOne({ ID: targetID - 1 }, { projection: { Issue: 1, ID: 1 } });

                if (baseRecordFromDB) {
                    issuePairs.push({
                        base_issue: baseRecordFromDB.Issue.toString(),
                        target_issue: targetIssue
                    });
                    console.log(`  ${i+1}. ${baseRecordFromDB.Issue} → ${targetIssue} (查询数据库) ${targetIssueNum > latestIssue ? '🔮推算' : '✅已开奖'}`);
                    idToRecordMap.set(baseRecordFromDB.ID, baseRecordFromDB);
                } else {
                    console.log(`  ${i+1}. 期号${targetIssue}: ❌ 无法找到ID=${targetID-1}的上一期`);
                }
            }
        }

        console.log(`\n✅ 共生成 ${issuePairs.length} 个期号对`);
        console.log('');

        // 检查热温冷数据
        console.log('='.repeat(80));
        console.log('🔥 第三步：检查热温冷优化表数据');
        console.log('='.repeat(80));

        for (const pair of issuePairs) {
            const hwcData = await hwcCol.findOne({
                base_issue: pair.base_issue,
                target_issue: pair.target_issue
            });

            if (hwcData) {
                const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
                console.log(`✅ ${pair.base_issue}→${pair.target_issue}: 存在数据，${ratios.length}种热温冷比例`);
            } else {
                console.log(`❌ ${pair.base_issue}→${pair.target_issue}: 缺少数据`);
            }
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ 模拟完成');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

simulate();
