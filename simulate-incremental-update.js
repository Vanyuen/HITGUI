/**
 * 模拟增量更新的完整流程，找出 NaN 错误的具体位置
 * 运行: node simulate-incremental-update.js
 */
const mongoose = require('mongoose');

async function simulate() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 模拟增量更新流程，检测 NaN 问题');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ========== 步骤1: 模拟 incrementalUpdateMissingTables ==========
    console.log('📊 步骤1: 检查遗漏值表更新...');

    const latestMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({}, { sort: { ID: -1 } });

    const startID_missing = latestMissing ? latestMissing.ID + 1 : 1;
    console.log(`   遗漏值表最新ID: ${latestMissing?.ID}`);
    console.log(`   startID = ${startID_missing} (isNaN: ${Number.isNaN(startID_missing)})`);

    // 定义 hit_dlts Schema 用于查询
    const dltSchema = new mongoose.Schema({
        ID: { type: Number, required: true },
        Issue: { type: Number },
        Red1: Number, Red2: Number, Red3: Number, Red4: Number, Red5: Number,
        Blue1: Number, Blue2: Number,
        statistics: mongoose.Schema.Types.Mixed
    }, { collection: 'hit_dlts' });

    const HitDlt = mongoose.models.hit_dlts || mongoose.model('hit_dlts', dltSchema);

    const latestDlt = await HitDlt.findOne({}).sort({ ID: -1 }).select('ID Issue').lean();
    console.log(`   hit_dlts最新ID: ${latestDlt?.ID} (期号: ${latestDlt?.Issue})`);

    if (Number.isNaN(startID_missing)) {
        console.log('   ❌ startID 是 NaN! 这会导致后续查询失败!');
    }

    // ========== 步骤2: 模拟 incrementalUpdateStatistics ==========
    console.log('\n📊 步骤2: 检查statistics更新...');

    const latestMissingID = latestMissing ? latestMissing.ID : 0;

    const latestWithStats = await HitDlt.findOne(
        { 'statistics.frontSum': { $exists: true } }
    ).sort({ ID: -1 }).select('ID Issue').lean();

    const lastStatsID = latestWithStats ? latestWithStats.ID : 0;
    const startID_stats = lastStatsID + 1;
    const endID_stats = latestMissingID;

    console.log(`   latestWithStats.ID: ${latestWithStats?.ID}`);
    console.log(`   lastStatsID: ${lastStatsID}`);
    console.log(`   startID: ${startID_stats} (isNaN: ${Number.isNaN(startID_stats)})`);
    console.log(`   endID: ${endID_stats} (isNaN: ${Number.isNaN(endID_stats)})`);

    if (Number.isNaN(startID_stats) || Number.isNaN(endID_stats)) {
        console.log('   ❌ startID 或 endID 是 NaN! 查询会失败!');
    } else {
        // 尝试执行查询
        console.log(`   🧪 测试查询: hit_dlts.find({ ID: { $gte: ${startID_stats}, $lte: ${endID_stats} } })`);
        try {
            const records = await HitDlt.find({
                ID: { $gte: startID_stats, $lte: endID_stats }
            }).sort({ ID: 1 }).lean();
            console.log(`   ✅ 查询成功，找到 ${records.length} 条记录`);

            // 检查每条记录的字段
            for (const r of records) {
                const issues = [];
                if (typeof r.ID !== 'number' || Number.isNaN(r.ID)) issues.push(`ID=${r.ID}`);
                if (typeof r.Red1 !== 'number' || Number.isNaN(r.Red1)) issues.push(`Red1=${r.Red1}`);
                if (typeof r.Red2 !== 'number' || Number.isNaN(r.Red2)) issues.push(`Red2=${r.Red2}`);
                if (typeof r.Red3 !== 'number' || Number.isNaN(r.Red3)) issues.push(`Red3=${r.Red3}`);
                if (typeof r.Red4 !== 'number' || Number.isNaN(r.Red4)) issues.push(`Red4=${r.Red4}`);
                if (typeof r.Red5 !== 'number' || Number.isNaN(r.Red5)) issues.push(`Red5=${r.Red5}`);
                if (typeof r.Blue1 !== 'number' || Number.isNaN(r.Blue1)) issues.push(`Blue1=${r.Blue1}`);
                if (typeof r.Blue2 !== 'number' || Number.isNaN(r.Blue2)) issues.push(`Blue2=${r.Blue2}`);

                if (issues.length > 0) {
                    console.log(`   ❌ 记录 ID=${r.ID}, Issue=${r.Issue} 有问题字段: ${issues.join(', ')}`);
                } else {
                    console.log(`   ✅ 记录 ID=${r.ID}, Issue=${r.Issue} 字段正常`);
                }
            }
        } catch (err) {
            console.log(`   ❌ 查询失败: ${err.message}`);
        }
    }

    // ========== 步骤3: 模拟热温冷优化表更新 ==========
    console.log('\n📊 步骤3: 检查热温冷优化表更新...');

    const hwcCount = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').countDocuments();
    console.log(`   热温冷优化表记录数: ${hwcCount}`);

    if (hwcCount === 0) {
        console.log('   ⚠️  热温冷优化表为空，增量更新将处理所有 2807 期数据！');
        console.log('   这可能需要很长时间，建议先运行全量重建...');

        // 检查第一期（跳过）和第二期（第一个要处理的）
        const allIssues = await HitDlt.find({}).sort({ Issue: 1 }).select('ID Issue').limit(5).lean();
        console.log('\n   前5期数据:');
        allIssues.forEach((r, i) => {
            const status = (typeof r.ID === 'number' && !Number.isNaN(r.ID)) ? '✅' : '❌';
            console.log(`   ${i + 1}. ${status} ID=${r.ID}, Issue=${r.Issue}, ID-1=${r.ID - 1}`);
        });
    }

    // ========== 检查红球组合表 ==========
    console.log('\n📊 检查红球组合表...');
    const redComboCount = await db.collection('hit_dlt_redcombinations').countDocuments();
    console.log(`   红球组合表记录数: ${redComboCount}`);

    if (redComboCount === 0) {
        console.log('   ❌ 红球组合表为空! 热温冷优化表无法生成!');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('诊断完成');
    console.log('═══════════════════════════════════════════════════════════════');

    await mongoose.disconnect();
}

simulate().catch(err => {
    console.error('❌ 模拟失败:', err.message);
    console.error(err.stack);
    process.exit(1);
});
