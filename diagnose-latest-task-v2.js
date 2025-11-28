const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));

    // 查找最新的任务
    const latestTask = await Task.findOne().sort({ created_at: -1 }).lean();
    console.log('=== 最新任务 ===');
    console.log('任务ID:', latestTask?.task_id);
    console.log('任务名称:', latestTask?.task_name);
    console.log('状态:', latestTask?.status);
    console.log('创建时间:', latestTask?.created_at);
    console.log('issue_pairs:', JSON.stringify(latestTask?.issue_pairs, null, 2));
    console.log('positive_selection:', JSON.stringify(latestTask?.positive_selection, null, 2));
    console.log('progress:', latestTask?.progress);
    console.log('statistics:', latestTask?.statistics);
    console.log('error_message:', latestTask?.error_message);

    // 查询该任务的结果
    if (latestTask?.task_id) {
      const results = await Result.find({ task_id: latestTask.task_id }).sort({ period: -1 }).lean();
      console.log('\n=== 任务结果 ===');
      console.log('结果数量:', results.length);

      if (results.length > 0) {
        console.log('\n前5条结果详情:');
        results.slice(0, 5).forEach((r, idx) => {
          console.log(`\n${idx + 1}. 期号: ${r.period}`);
          console.log('   combination_count:', r.combination_count);
          console.log('   is_predicted:', r.is_predicted);
          console.log('   red_combinations长度:', r.red_combinations?.length);
          console.log('   paired_combinations长度:', r.paired_combinations?.length);
          console.log('   hit_analysis:', JSON.stringify(r.hit_analysis, null, 4));
          console.log('   positive_selection_details:', JSON.stringify(r.positive_selection_details, null, 4));
        });
      }
    }

    // 检查所有任务
    const allTasks = await Task.find().sort({ created_at: -1 }).limit(5).lean();
    console.log('\n=== 所有任务列表 ===');
    allTasks.forEach((t, idx) => {
      console.log(`${idx + 1}. [${t.status}] ${t.task_name} (${t.task_id})`);
      console.log(`   创建: ${t.created_at}, issue_pairs数: ${t.issue_pairs?.length || 0}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
