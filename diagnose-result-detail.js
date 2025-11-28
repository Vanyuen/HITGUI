const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));

    // 查找最新任务的结果
    const results = await Result.find({ task_id: 'hwc-pos-20251125-1mg' }).sort({ period: -1 }).limit(3).lean();

    console.log('=== 最新任务结果详情 ===');
    console.log('结果数量:', results.length);

    for (const r of results) {
      console.log(`\n期号: ${r.period}`);
      console.log('  is_predicted:', r.is_predicted);
      console.log('  red_combinations (存储类型):', Array.isArray(r.red_combinations) ? 'Array' : typeof r.red_combinations);
      console.log('  red_combinations 长度:', r.red_combinations?.length || 0);
      console.log('  combination_count (保存值):', r.combination_count);
      console.log('  paired_combinations 长度:', r.paired_combinations?.length || 0);

      // 检查正选统计详情
      console.log('  positive_selection_details:');
      const psd = r.positive_selection_details;
      if (psd) {
        console.log('    step1_count:', psd.step1_count);
        console.log('    step2_retained_count:', psd.step2_retained_count);
        console.log('    step3_retained_count:', psd.step3_retained_count);
        console.log('    step4_retained_count:', psd.step4_retained_count);
        console.log('    step5_retained_count:', psd.step5_retained_count);
        console.log('    step6_retained_count:', psd.step6_retained_count);
        console.log('    final_retained_count:', psd.final_retained_count);
        console.log('    step1_base_combination_ids 长度:', psd.step1_base_combination_ids?.length || 0);
      }

      // 检查hit_analysis
      console.log('  hit_analysis.max_red_hit:', r.hit_analysis?.max_red_hit);
      console.log('  hit_analysis.total_prize:', r.hit_analysis?.total_prize);

      // 如果有配对数据，显示前3个
      if (r.paired_combinations && r.paired_combinations.length > 0) {
        console.log('  前3个配对:');
        r.paired_combinations.slice(0, 3).forEach((p, idx) => {
          console.log(`    ${idx + 1}. 红球: ${p.red_balls?.join(',')}, 蓝球: ${p.blue_balls?.join(',')}`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
