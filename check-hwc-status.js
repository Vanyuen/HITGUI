/**
 * 检查热温冷优化表的状态和数据完整性
 * 运行: node check-hwc-status.js
 */
const mongoose = require('mongoose');

async function check() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 检查热温冷优化表状态');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const hwcCollection = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
    const dltCollection = db.collection('hit_dlts');

    // 1. 基本统计
    const hwcCount = await hwcCollection.countDocuments();
    const dltCount = await dltCollection.countDocuments();

    console.log(`📊 基本统计:`);
    console.log(`   hit_dlts 总记录数: ${dltCount}`);
    console.log(`   热温冷优化表记录数: ${hwcCount}`);
    console.log(`   预期记录数: ${dltCount - 1} (跳过第一期) + 1 (推算期) = ${dltCount}`);

    if (hwcCount === 0) {
        console.log('\n⚠️  热温冷优化表为空!');
        await mongoose.disconnect();
        return;
    }

    // 2. 检查已开奖期和推算期
    const drawnCount = await hwcCollection.countDocuments({ 'hit_analysis.is_drawn': true });
    const predictedCount = await hwcCollection.countDocuments({ 'hit_analysis.is_drawn': false });

    console.log(`\n📈 记录类型分布:`);
    console.log(`   已开奖期: ${drawnCount}`);
    console.log(`   推算期: ${predictedCount}`);

    // 3. 检查期号范围
    const firstRecord = await hwcCollection.findOne({}, { sort: { target_issue: 1 } });
    const lastDrawnRecord = await hwcCollection.findOne(
        { 'hit_analysis.is_drawn': true },
        { sort: { target_issue: -1 } }
    );
    const lastPredictedRecord = await hwcCollection.findOne(
        { 'hit_analysis.is_drawn': false },
        { sort: { target_issue: -1 } }
    );

    console.log(`\n📋 期号范围:`);
    console.log(`   最早期号: ${firstRecord?.target_issue} (base: ${firstRecord?.base_issue})`);
    console.log(`   最新已开奖期: ${lastDrawnRecord?.target_issue} (base: ${lastDrawnRecord?.base_issue})`);
    console.log(`   推算期: ${lastPredictedRecord?.target_issue || '无'}`);

    // 4. 检查 hit_dlts 的期号范围
    const firstDlt = await dltCollection.findOne({}, { sort: { Issue: 1 } });
    const lastDlt = await dltCollection.findOne({}, { sort: { Issue: -1 } });

    console.log(`\n📋 hit_dlts 期号范围:`);
    console.log(`   最早期号: ${firstDlt?.Issue} (ID: ${firstDlt?.ID})`);
    console.log(`   最新期号: ${lastDlt?.Issue} (ID: ${lastDlt?.ID})`);

    // 5. 检查缺失的期号
    console.log(`\n🔍 检查缺失的期号...`);

    const allDltIssues = await dltCollection.find({})
        .sort({ Issue: 1 })
        .project({ Issue: 1, ID: 1 })
        .toArray();

    const hwcTargetIssues = new Set();
    const allHwc = await hwcCollection.find({ 'hit_analysis.is_drawn': true })
        .project({ target_issue: 1 })
        .toArray();
    allHwc.forEach(r => hwcTargetIssues.add(r.target_issue.toString()));

    const missingIssues = [];
    // 从第二期开始检查（第一期没有上一期，所以跳过）
    for (let i = 1; i < allDltIssues.length; i++) {
        const issue = allDltIssues[i].Issue.toString();
        if (!hwcTargetIssues.has(issue)) {
            missingIssues.push({
                issue: issue,
                id: allDltIssues[i].ID
            });
        }
    }

    if (missingIssues.length > 0) {
        console.log(`   ❌ 缺失 ${missingIssues.length} 个期号!`);
        console.log(`   前10个缺失期号:`);
        missingIssues.slice(0, 10).forEach(m => {
            console.log(`      - Issue: ${m.issue}, ID: ${m.id}`);
        });
        if (missingIssues.length > 10) {
            console.log(`      ... 还有 ${missingIssues.length - 10} 个`);
        }
    } else {
        console.log(`   ✅ 所有期号都已处理`);
    }

    // 6. 检查数据完整性（随机抽查几条记录）
    console.log(`\n🔍 抽查记录完整性...`);

    const sampleRecords = await hwcCollection.aggregate([
        { $sample: { size: 5 } }
    ]).toArray();

    for (const record of sampleRecords) {
        const issues = [];

        if (!record.base_issue) issues.push('缺少 base_issue');
        if (!record.target_issue) issues.push('缺少 target_issue');
        if (!record.hot_warm_cold_data) issues.push('缺少 hot_warm_cold_data');
        if (!record.total_combinations) issues.push('缺少 total_combinations');
        if (!record.hit_analysis) issues.push('缺少 hit_analysis');

        if (record.hot_warm_cold_data) {
            const ratioCount = Object.keys(record.hot_warm_cold_data).length;
            if (ratioCount === 0) issues.push('hot_warm_cold_data 为空');
        }

        if (issues.length > 0) {
            console.log(`   ❌ 期号 ${record.target_issue}: ${issues.join(', ')}`);
        } else {
            console.log(`   ✅ 期号 ${record.target_issue}: 数据完整`);
        }
    }

    // 7. 检查是否有重复记录
    console.log(`\n🔍 检查重复记录...`);

    const duplicates = await hwcCollection.aggregate([
        { $group: { _id: '$target_issue', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 10 }
    ]).toArray();

    if (duplicates.length > 0) {
        console.log(`   ❌ 发现 ${duplicates.length} 个重复的期号:`);
        duplicates.forEach(d => {
            console.log(`      - 期号 ${d._id}: ${d.count} 条记录`);
        });
    } else {
        console.log(`   ✅ 没有重复记录`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    // 总结
    const expectedDrawn = dltCount - 1; // 跳过第一期
    const isComplete = drawnCount === expectedDrawn && missingIssues.length === 0;

    if (isComplete) {
        console.log('✅ 热温冷优化表数据完整');
    } else {
        console.log('❌ 热温冷优化表数据不完整:');
        if (drawnCount !== expectedDrawn) {
            console.log(`   - 已开奖期记录数不匹配: 期望 ${expectedDrawn}, 实际 ${drawnCount}`);
        }
        if (missingIssues.length > 0) {
            console.log(`   - 缺失 ${missingIssues.length} 个期号`);
        }
    }

    console.log('═══════════════════════════════════════════════════════════════');

    await mongoose.disconnect();
}

check().catch(err => {
    console.error('❌ 检查失败:', err.message);
    process.exit(1);
});
