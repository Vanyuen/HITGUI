/**
 * 热温冷优化表完整性验证脚本（修正版）
 */

const mongoose = require('mongoose');

async function verifyData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('═══════════════════════════════════════════════════');
        console.log('🔍 热温冷优化表完整性验证');
        console.log('═══════════════════════════════════════════════════\n');

        const db = mongoose.connection.db;

        // 使用正确的集合名称（小写+复数）
        const hwcCollection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const dltCollection = db.collection('hit_dlts');

        // 1. 基础统计
        const totalRecords = await hwcCollection.countDocuments({});
        console.log(`📊 优化表记录总数: ${totalRecords}\n`);

        if (totalRecords === 0) {
            console.log('❌ 优化表为空，验证失败！\n');
            process.exit(1);
        }

        // 2. 检查期号覆盖范围
        const allIssues = await dltCollection.find({}).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();
        const expectedPairs = allIssues.length - 1; // 第1期没有上一期
        const expectedWithPredicted = expectedPairs + 1; // 加上1期推算

        const lastIssue = allIssues[allIssues.length - 1];
        const firstIssue = allIssues[0];

        console.log(`📅 历史数据统计:`);
        console.log(`   - 已开奖期数: ${allIssues.length} 期`);
        console.log(`   - 期号范围: ${firstIssue.Issue} - ${lastIssue.Issue}`);
        console.log(`   - 预期期号对数: ${expectedPairs} 对 (已开奖)`);
        console.log(`   - 加上推算期: ${expectedWithPredicted} 对\n`);

        // 3. 检查实际期号对
        const allRecords = await hwcCollection.find({}).project({ base_issue: 1, target_issue: 1 }).toArray();
        const targetIssues = allRecords.map(r => r.target_issue);
        const baseIssues = allRecords.map(r => r.base_issue);

        const uniqueTargets = new Set(targetIssues);
        const uniqueBases = new Set(baseIssues);

        console.log(`📈 优化表覆盖统计:`);
        console.log(`   - 不同的基准期: ${uniqueBases.size} 个`);
        console.log(`   - 不同的目标期: ${uniqueTargets.size} 个`);
        console.log(`   - 实际期号对数: ${totalRecords} 对\n`);

        // 4. 检查覆盖率
        const coveragePercent = ((totalRecords / expectedWithPredicted) * 100).toFixed(1);
        console.log(`✅ 覆盖率: ${coveragePercent}% (${totalRecords}/${expectedWithPredicted})\n`);

        if (totalRecords >= expectedPairs) {
            console.log('✅ 已开奖期数据完整！\n');
        } else {
            console.log(`⚠️  缺少 ${expectedPairs - totalRecords} 个已开奖期号对\n`);
        }

        // 5. 检查最新期号
        const latestIssue = lastIssue.Issue;
        const predictedIssue = parseInt(latestIssue) + 1;

        const latestRecord = await hwcCollection.findOne({
            target_issue: latestIssue
        });

        const predictedRecord = await hwcCollection.findOne({
            target_issue: String(predictedIssue)
        });

        console.log(`🎯 关键期号检查:`);
        console.log(`   - 最新开奖期 (${latestIssue}): ${latestRecord ? '✅ 有数据' : '❌ 无数据'}`);
        console.log(`   - 推算下一期 (${predictedIssue}): ${predictedRecord ? '✅ 有数据' : '❌ 无数据'}\n`);

        // 6. 检查数据结构
        const sampleRecord = await hwcCollection.findOne({});

        console.log(`📄 数据结构验证:`);
        console.log(`   - 字段: ${Object.keys(sampleRecord).join(', ')}`);

        if (sampleRecord.hot_warm_cold_data) {
            const ratioCount = Object.keys(sampleRecord.hot_warm_cold_data).length;
            const sampleRatios = Object.keys(sampleRecord.hot_warm_cold_data).slice(0, 5);
            console.log(`   - 热温冷比种类: ${ratioCount} 种`);
            console.log(`   - 示例比例: ${sampleRatios.join(', ')}\n`);

            // 检查第一个比例的数据
            const firstRatio = sampleRatios[0];
            const firstRatioData = sampleRecord.hot_warm_cold_data[firstRatio];
            console.log(`   - 比例 "${firstRatio}" 的组合数: ${Array.isArray(firstRatioData) ? firstRatioData.length : 0}`);
        } else {
            console.log(`   ❌ hot_warm_cold_data 字段为空\n`);
        }

        // 7. 性能测试：随机抽取5个期号对查询
        console.log(`\n⚡ 性能测试 (随机5个期号对):`);
        const randomRecords = await hwcCollection.aggregate([
            { $sample: { size: 5 } }
        ]).toArray();

        for (const record of randomRecords) {
            const startTime = Date.now();
            const testQuery = await hwcCollection.findOne({
                base_issue: record.base_issue,
                target_issue: record.target_issue
            });
            const queryTime = Date.now() - startTime;

            const ratioCount = testQuery.hot_warm_cold_data ? Object.keys(testQuery.hot_warm_cold_data).length : 0;
            console.log(`   - ${record.base_issue}→${record.target_issue}: ${queryTime}ms (${ratioCount}种比例)`);
        }

        // 8. 检查期号连续性
        console.log(`\n📊 期号连续性检查:`);
        const sortedRecords = allRecords.sort((a, b) => parseInt(a.target_issue) - parseInt(b.target_issue));

        let missingPairs = [];
        for (let i = 1; i < allIssues.length; i++) {
            const targetIssue = allIssues[i].Issue;
            const exists = sortedRecords.find(r => r.target_issue === targetIssue);
            if (!exists) {
                missingPairs.push(`${allIssues[i-1].Issue}→${targetIssue}`);
            }
        }

        if (missingPairs.length === 0) {
            console.log(`   ✅ 无缺失期号对`);
        } else {
            console.log(`   ⚠️  缺失 ${missingPairs.length} 个期号对:`);
            missingPairs.slice(0, 10).forEach(pair => {
                console.log(`      - ${pair}`);
            });
            if (missingPairs.length > 10) {
                console.log(`      ... 还有 ${missingPairs.length - 10} 个`);
            }
        }

        // 9. 总结
        console.log(`\n═══════════════════════════════════════════════════`);
        if (totalRecords >= expectedPairs && latestRecord && missingPairs.length === 0) {
            console.log('✅ 验证通过！热温冷优化表数据完整且可用！');
            console.log('✅ 性能优化已生效，批量预测速度将显著提升！');
        } else if (totalRecords >= expectedPairs) {
            console.log('⚠️  基本通过，但有少量期号对缺失');
        } else {
            console.log('❌ 验证失败！部分期号对缺失');
        }
        console.log('═══════════════════════════════════════════════════\n');

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyData();
