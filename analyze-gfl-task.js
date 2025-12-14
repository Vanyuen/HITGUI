const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const taskId = 'hwc-pos-20251203-gfl';

    // 1. 查询任务的所有结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: taskId })
        .project({
            result_id: 1,
            period: 1,
            is_predicted: 1,
            has_exclusion_details: 1,
            'hit_analysis.max_red_hit': 1,
            'exclusion_summary': 1,
            'exclusions_to_save': 1
        })
        .sort({ period: -1 })
        .limit(20)
        .toArray();

    console.log('=== gfl任务最近20期结果 ===\n');

    // 统计
    let withHitAnalysis = 0;
    let withExclusionsToSave = 0;
    let withExclusionSummary = 0;

    for (const r of results) {
        const maxHit = r.hit_analysis?.max_red_hit;
        const hasExclusions = r.exclusions_to_save ? 'YES' : 'NO';
        const hasSummary = r.exclusion_summary && Object.keys(r.exclusion_summary).length > 0 ? 'YES' : 'NO';

        console.log(`期号: ${r.period}, is_predicted: ${r.is_predicted}, max_red_hit: ${maxHit || 'N/A'}, exclusions_to_save: ${hasExclusions}, exclusion_summary: ${hasSummary}`);

        if (maxHit !== undefined) withHitAnalysis++;
        if (r.exclusions_to_save) withExclusionsToSave++;
        if (r.exclusion_summary && Object.keys(r.exclusion_summary).length > 0) withExclusionSummary++;
    }

    console.log('\n=== 统计 ===');
    console.log('有hit_analysis:', withHitAnalysis);
    console.log('有exclusions_to_save:', withExclusionsToSave);
    console.log('有exclusion_summary:', withExclusionSummary);

    // 2. 检查命中最多的期号
    console.log('\n=== 命中最多的5期 ===');
    const topHit = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: taskId, is_predicted: false })
        .sort({ 'hit_analysis.max_red_hit': -1 })
        .limit(5)
        .project({ period: 1, 'hit_analysis.max_red_hit': 1 })
        .toArray();

    topHit.forEach(r => {
        console.log(`期号: ${r.period}, max_red_hit: ${r.hit_analysis?.max_red_hit}`);
    });

    await mongoose.disconnect();
}

analyze().catch(e => console.error(e));
