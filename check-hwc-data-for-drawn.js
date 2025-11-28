const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    console.log('=== 检查已开奖期的热温冷数据 ===');

    // 检查25115-25124的期号对
    for (let i = 25115; i <= 25124; i++) {
      const baseIssue = (i - 1).toString();
      const targetIssue = i.toString();

      const hwcRecord = await HwcOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
      }).lean();

      console.log(`\n${baseIssue} -> ${targetIssue}:`);
      if (hwcRecord) {
        console.log('  ✅ 存在热温冷数据');
        console.log('  is_predicted:', hwcRecord.is_predicted);

        const hwcData = hwcRecord.hot_warm_cold_data || {};
        const ratio410 = hwcData['4:1:0'] || [];
        console.log('  hot_warm_cold_data["4:1:0"].length:', ratio410.length);
      } else {
        console.log('  ❌ 不存在热温冷数据');
      }
    }

    // 检查推算期25125
    console.log('\n=== 检查推算期的热温冷数据 ===');
    const hwcRecord25125 = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();

    console.log('25124 -> 25125:');
    if (hwcRecord25125) {
      console.log('  ✅ 存在热温冷数据');
      console.log('  is_predicted:', hwcRecord25125.is_predicted);

      const hwcData = hwcRecord25125.hot_warm_cold_data || {};
      const ratio410 = hwcData['4:1:0'] || [];
      console.log('  hot_warm_cold_data["4:1:0"].length:', ratio410.length);
    } else {
      console.log('  ❌ 不存在热温冷数据');
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
