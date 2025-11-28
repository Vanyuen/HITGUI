/**
 * 检查期号(Issue)与ID的映射关系
 * 验证期号是否连续，以及ID-1规则的正确性
 */

const mongoose = require('mongoose');

async function checkIssueIdMapping() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n===== 检查期号与ID映射关系 =====\n');

        const db = mongoose.connection.db;

        // 查询用户选择的期号范围
        const userSelectedIssues = [25118, 25119, 25120, 25121, 25122, 25123, 25124, 25125];

        console.log('【用户选择的期号范围】');
        console.log(`期号: ${userSelectedIssues.join(', ')}\n`);

        // 查询这些期号在数据库中的记录
        const records = await db.collection('hit_dlts')
            .find({ Issue: { $in: userSelectedIssues } })
            .sort({ ID: 1 })
            .toArray();

        console.log('【数据库中的记录】');
        console.log(`找到${records.length}条记录:\n`);

        const issueIdMap = new Map();
        records.forEach(r => {
            issueIdMap.set(r.Issue, r.ID);
            console.log(`  期号 ${r.Issue} → ID ${r.ID}`);
        });

        // 检查期号是否连续
        console.log('\n【期号连续性检查】');
        let isConsecutive = true;
        for (let i = 1; i < userSelectedIssues.length; i++) {
            const diff = userSelectedIssues[i] - userSelectedIssues[i - 1];
            if (diff !== 1) {
                isConsecutive = false;
                console.log(`  ⚠️ 期号 ${userSelectedIssues[i - 1]} → ${userSelectedIssues[i]}: 相差${diff} (不连续)`);
            }
        }
        if (isConsecutive) {
            console.log('  ✅ 期号完全连续');
        }

        // 根据ID-1规则生成期号对
        console.log('\n【使用ID-1规则生成期号对】');
        console.log('规则: 目标期号的ID-1 = 基准期号的ID\n');

        const issuePairs = [];
        for (const record of records) {
            const targetIssue = record.Issue;
            const targetID = record.ID;
            const baseID = targetID - 1;

            // 查询baseID对应的期号
            const baseRecord = await db.collection('hit_dlts').findOne({ ID: baseID });

            if (baseRecord) {
                issuePairs.push({
                    base_issue: baseRecord.Issue.toString(),
                    base_id: baseID,
                    target_issue: targetIssue.toString(),
                    target_id: targetID
                });
                console.log(`  ✅ ID ${baseID}(期号${baseRecord.Issue}) → ID ${targetID}(期号${targetIssue})`);
            } else {
                console.log(`  ❌ ID ${targetID}(期号${targetIssue}) 的上一期 ID ${baseID} 不存在`);
            }
        }

        console.log(`\n生成的期号对总数: ${issuePairs.length}`);

        // 检查热温冷优化表是否包含这些期号对
        console.log('\n【检查热温冷优化表】');
        console.log('查询: hit_dlt_redcombinationshotwarmcoldoptimizeds\n');

        for (const pair of issuePairs) {
            const hwcRecord = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
                base_issue: pair.base_issue,
                target_issue: pair.target_issue
            });

            if (hwcRecord) {
                const dataKeys = Object.keys(hwcRecord.hot_warm_cold_data || {}).length;
                console.log(`  ✅ ${pair.base_issue} → ${pair.target_issue}: 存在 (${dataKeys}个热温冷比)`);
            } else {
                console.log(`  ❌ ${pair.base_issue} → ${pair.target_issue}: 不存在`);
            }
        }

        // 对比错误的数组相邻配对方式
        console.log('\n【错误的数组相邻配对方式（仅供对比）】');
        console.log('错误逻辑: issueRecords[i-1] → issueRecords[i]\n');

        for (let i = 1; i < records.length; i++) {
            const baseIssue = records[i - 1].Issue;
            const targetIssue = records[i].Issue;
            console.log(`  期号 ${baseIssue} → ${targetIssue} (数组索引配对)`);
        }

        console.log('\n===== 检查完成 =====\n');

        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkIssueIdMapping();
