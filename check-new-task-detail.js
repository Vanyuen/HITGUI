const { MongoClient } = require('mongodb');

async function checkNewTask() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 检查新任务的详细信息
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251126-tt6' });

    console.log('=== 任务详情 ===');
    console.log('task_id:', task.task_id);
    console.log('task_name:', task.task_name);
    console.log('created_at:', task.created_at);
    console.log('status:', task.status);
    console.log('period_range:', JSON.stringify(task.period_range));

    // 检查issue_pairs
    console.log('\n=== 期号对 (issue_pairs) ===');
    if (task.issue_pairs && task.issue_pairs.length > 0) {
        console.log('期号对数量:', task.issue_pairs.length);
        console.log('前5个期号对:');
        for (const pair of task.issue_pairs.slice(0, 5)) {
            console.log('  target:', pair.target_issue || pair.target,
                       '| base:', pair.base_issue || pair.base,
                       '| is_predicted:', pair.is_predicted !== undefined ? pair.is_predicted : pair.isPredicted);
        }
    } else {
        console.log('没有issue_pairs数据');
    }

    // 检查任务结果中的is_predicted
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251126-tt6', period: '25125' })
        .toArray();

    console.log('\n=== 期号25125的结果记录 ===');
    if (results.length > 0) {
        const r = results[0];
        console.log('period:', r.period);
        console.log('is_predicted:', r.is_predicted);
        console.log('combination_count:', r.combination_count);
        console.log('hit_analysis:', JSON.stringify(r.hit_analysis));
    }

    // 检查数据库最新期号
    const latestRecord = await db.collection('hit_dlts').find({}).sort({ ID: -1 }).limit(1).toArray();
    console.log('\n=== 数据库最新期号 ===');
    console.log('Issue:', latestRecord[0]?.Issue);
    console.log('ID:', latestRecord[0]?.ID);

    await client.close();
}

checkNewTask().catch(console.error);
