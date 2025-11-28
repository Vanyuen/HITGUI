const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));
    const RedCombinations = mongoose.model('hit_dlt_redcombinations', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' }));

    // 获取任务
    const task = await Task.findOne({ task_id: 'hwc-pos-20251125-w6c' }).lean();
    console.log('=== 任务正选条件 ===');
    console.log('red_hot_warm_cold_ratios:', JSON.stringify(task.positive_selection.red_hot_warm_cold_ratios));
    console.log();

    // ⚠️ 关键：用户选择的是对象格式 {hot: 4, warm: 1, cold: 0}
    // 但热温冷优化表存储的是字符串格式 "4:1:0"
    const userSelectedRatios = task.positive_selection.red_hot_warm_cold_ratios;
    console.log('用户选择的比例类型:', typeof userSelectedRatios[0]);
    console.log('是对象吗?', typeof userSelectedRatios[0] === 'object');

    // 转换为字符串格式
    const ratioStrings = userSelectedRatios.map(r => `${r.hot}:${r.warm}:${r.cold}`);
    console.log('转换后的字符串格式:', ratioStrings);

    // 检查热温冷优化表
    const hwcRecord = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();

    if (hwcRecord) {
      console.log('\n=== 热温冷优化表数据 ===');
      console.log('存储的比例键:', Object.keys(hwcRecord.hot_warm_cold_data));

      // 使用转换后的字符串查询
      for (const ratioStr of ratioStrings) {
        const ids = hwcRecord.hot_warm_cold_data[ratioStr];
        console.log(`比例 "${ratioStr}" 的组合数:`, ids ? ids.length : 0);
      }
    }

    // ⚠️ 问题定位：在服务端代码中，positive_selection.red_hot_warm_cold_ratios 是对象数组
    // 但在 processHwcPositivePredictionTask 函数中，直接使用对象作为 hwcData[ratio] 的键
    // 这会导致 hwcData[{hot:4, warm:1, cold:0}] 返回 undefined

    console.log('\n=== 模拟服务端代码行为 ===');
    const hwcData = hwcRecord?.hot_warm_cold_data || {};

    // 错误方式：直接用对象作为键
    console.log('错误方式 - 使用对象作为键:');
    userSelectedRatios.forEach(ratio => {
      const ids = hwcData[ratio];
      console.log(`  hwcData[${JSON.stringify(ratio)}]:`, ids ? ids.length : 'undefined');
    });

    // 正确方式：转换为字符串
    console.log('\n正确方式 - 转换为字符串后:');
    ratioStrings.forEach(ratioStr => {
      const ids = hwcData[ratioStr];
      console.log(`  hwcData["${ratioStr}"]:`, ids ? ids.length : 'undefined');
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
