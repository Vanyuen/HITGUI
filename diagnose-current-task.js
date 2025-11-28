const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));
    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    // 查询当前任务的结果（task_id: hwc-pos-20251125-w6c）
    const currentTaskId = 'hwc-pos-20251125-w6c';
    const currentResults = await Result.find({ task_id: currentTaskId }).lean();
    console.log(`=== 当前任务(${currentTaskId})结果 ===`);
    console.log('结果数量:', currentResults.length);

    if (currentResults.length > 0) {
      currentResults.forEach((r, idx) => {
        console.log(`\n${idx + 1}. 期号: ${r.period}, 组合数: ${r.combination_count}`);
        console.log('   is_predicted:', r.is_predicted);
        console.log('   hit_analysis:', r.hit_analysis);
      });
    }

    // 检查热温冷优化表中是否有 25124 -> 25125 的数据
    console.log('\n=== 检查期号对 25124 -> 25125 的热温冷数据 ===');
    const hwcRecord = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();

    if (hwcRecord) {
      console.log('找到热温冷数据!');
      console.log('base_issue:', hwcRecord.base_issue);
      console.log('target_issue:', hwcRecord.target_issue);
      console.log('hot_warm_cold_data keys:', Object.keys(hwcRecord.hot_warm_cold_data));

      // 检查 4:1:0 比例（用户选择的正选条件）
      const ratio = '4:1:0';
      const ids = hwcRecord.hot_warm_cold_data[ratio];
      console.log(`\n比例 ${ratio} 的组合数:`, ids ? ids.length : 0);
      if (ids && ids.length > 0) {
        console.log('前5个组合ID:', ids.slice(0, 5));
      }
    } else {
      console.log('❌ 未找到热温冷数据!');
    }

    // 检查热温冷优化表中最新的记录
    console.log('\n=== 热温冷优化表最新记录 ===');
    const latestHwc = await HwcOptimized.find({}).sort({ target_issue: -1 }).limit(5).lean();
    latestHwc.forEach(h => {
      console.log(`base: ${h.base_issue} -> target: ${h.target_issue}`);
    });

    // 检查数字与字符串问题
    console.log('\n=== 检查类型问题 ===');
    const hwcByNumber = await HwcOptimized.findOne({
      base_issue: 25124,
      target_issue: 25125
    }).lean();
    console.log('使用数字查询:', !!hwcByNumber);

    const hwcByString = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();
    console.log('使用字符串查询:', !!hwcByString);

    // 检查热温冷优化表中的base_issue类型
    const sampleHwc = await HwcOptimized.findOne().lean();
    console.log('\n样本记录 base_issue 类型:', typeof sampleHwc?.base_issue);
    console.log('样本记录 target_issue 类型:', typeof sampleHwc?.target_issue);

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
