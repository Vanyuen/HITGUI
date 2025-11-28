/**
 * 检查热温冷比优化表数据覆盖率
 */

const mongoose = require('mongoose');

async function checkHWCDataCoverage() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const db = mongoose.connection.db;

        // 1. 统计总期号数
        const totalIssues = await db.collection('hit_dlts').countDocuments();
        console.log(`📊 总开奖期号数: ${totalIssues} 期`);

        // 2. 统计热温冷比优化表记录数
        const hwcCount = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();
        console.log(`📊 热温冷比优化表记录数: ${hwcCount} 条\n`);

        // 3. 理论应有记录数 = 总期号数 - 1（第一期没有上一期）
        const expectedCount = totalIssues - 1;
        const coverageRate = totalIssues > 1 ? ((hwcCount / expectedCount) * 100).toFixed(2) : 0;

        console.log(`📊 理论应有记录数: ${expectedCount} 条`);
        console.log(`📊 数据覆盖率: ${coverageRate}%\n`);

        if (hwcCount < expectedCount) {
            console.log(`⚠️ 缺失 ${expectedCount - hwcCount} 条记录\n`);
        } else {
            console.log(`✅ 数据完整\n`);
        }

        // 4. 检查最新期号覆盖情况
        const latestIssues = await db.collection('hit_dlts')
            .find({})
            .sort({ Issue: -1 })
            .limit(20)
            .toArray();

        console.log('📊 最近20期覆盖情况:\n');

        for (let i = 1; i < latestIssues.length; i++) {
            const targetIssue = latestIssues[i - 1].Issue;
            const baseIssue = latestIssues[i].Issue;

            const exists = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
                base_issue: baseIssue.toString(),
                target_issue: targetIssue.toString()
            });

            if (exists) {
                console.log(`  ✅ ${baseIssue} → ${targetIssue}`);
            } else {
                console.log(`  ❌ ${baseIssue} → ${targetIssue} (缺失)`);
            }
        }

        // 5. 检查是否有跳跃的期号对
        console.log('\n📊 检查期号对的ID关系:\n');

        const hwcRecords = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({})
            .sort({ target_issue: -1 })
            .limit(10)
            .toArray();

        for (const record of hwcRecords) {
            const baseIssue = record.base_issue;
            const targetIssue = record.target_issue;

            // 查询这两个期号的ID
            const baseRecord = await db.collection('hit_dlts').findOne({ Issue: parseInt(baseIssue) });
            const targetRecord = await db.collection('hit_dlts').findOne({ Issue: parseInt(targetIssue) });

            if (baseRecord && targetRecord) {
                const idDiff = targetRecord.ID - baseRecord.ID;
                if (idDiff === 1) {
                    console.log(`  ✅ ${baseIssue}(ID=${baseRecord.ID}) → ${targetIssue}(ID=${targetRecord.ID}) [ID差=1]`);
                } else {
                    console.log(`  ⚠️ ${baseIssue}(ID=${baseRecord.ID}) → ${targetIssue}(ID=${targetRecord.ID}) [ID差=${idDiff}]`);
                }
            }
        }

        await mongoose.disconnect();
        console.log('\n🔌 已断开MongoDB连接');

    } catch (error) {
        console.error('❌ 检查失败:', error);
        await mongoose.disconnect();
    }
}

checkHWCDataCoverage();
