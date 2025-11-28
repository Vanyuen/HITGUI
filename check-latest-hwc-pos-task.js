const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));

    // 查找最新任务
    const latestTask = await Task.findOne().sort({ created_at: -1 }).lean();

    if (!latestTask) {
      console.log('❌ 未找到任何任务');
      process.exit(1);
    }

    console.log('=== 最新任务信息 ===');
    console.log('任务ID:', latestTask.task_id);
    console.log('任务名称:', latestTask.task_name);
    console.log('状态:', latestTask.status);
    console.log('期号范围:', latestTask.periods?.slice(0, 3), '...', latestTask.periods?.slice(-2));
    console.log('总期数:', latestTask.periods?.length);

    // 查询结果
    const results = await Result.find({ task_id: latestTask.task_id }).sort({ period: 1 }).lean();

    console.log('\n=== 任务结果统计 ===');
    console.log('结果总数:', results.length);

    // 分类统计
    const drawnResults = results.filter(r => !r.is_predicted);
    const predictedResults = results.filter(r => r.is_predicted);

    console.log('已开奖期:', drawnResults.length, '个');
    console.log('推算期:', predictedResults.length, '个');

    console.log('\n=== 已开奖期样本（前3个）===');
    drawnResults.slice(0, 3).forEach(r => {
      console.log(`\n期号: ${r.period}`);
      console.log('  is_predicted:', r.is_predicted);
      console.log('  combination_count:', r.combination_count);
      console.log('  red_combinations.length:', r.red_combinations?.length || 0);
      console.log('  paired_combinations.length:', r.paired_combinations?.length || 0);

      const psd = r.positive_selection_details;
      if (psd) {
        console.log('  正选统计:');
        console.log('    step1_count:', psd.step1_count);
        console.log('    step2_retained_count:', psd.step2_retained_count);
        console.log('    step3_retained_count:', psd.step3_retained_count);
        console.log('    step4_retained_count:', psd.step4_retained_count);
        console.log('    step5_retained_count:', psd.step5_retained_count);
        console.log('    step6_retained_count:', psd.step6_retained_count);
        console.log('    final_retained_count:', psd.final_retained_count);
      }
    });

    console.log('\n=== 推算期样本 ===');
    predictedResults.forEach(r => {
      console.log(`\n期号: ${r.period}`);
      console.log('  is_predicted:', r.is_predicted);
      console.log('  combination_count:', r.combination_count);
      console.log('  red_combinations.length:', r.red_combinations?.length || 0);
      console.log('  paired_combinations.length:', r.paired_combinations?.length || 0);

      const psd = r.positive_selection_details;
      if (psd) {
        console.log('  正选统计:');
        console.log('    step1_count:', psd.step1_count);
        console.log('    final_retained_count:', psd.final_retained_count);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
