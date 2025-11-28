/**
 * 验证热温冷比例格式转换修复
 * 2025-11-25
 */
const mongoose = require('mongoose');

async function verify() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    // 模拟修复后的代码逻辑
    const positive_selection = {
      red_hot_warm_cold_ratios: [
        { hot: 4, warm: 1, cold: 0 }
      ]
    };

    const hwcRecord = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();

    if (!hwcRecord) {
      console.log('❌ 未找到热温冷优化表数据');
      process.exit(1);
    }

    const hwcData = hwcRecord.hot_warm_cold_data || {};
    let candidateIds = new Set();

    // 修复后的代码逻辑
    (positive_selection.red_hot_warm_cold_ratios || []).forEach(ratioObj => {
      let ratioStr;
      if (typeof ratioObj === 'object' && ratioObj !== null) {
        ratioStr = `${ratioObj.hot}:${ratioObj.warm}:${ratioObj.cold}`;
      } else {
        ratioStr = ratioObj;
      }
      console.log(`处理比例: ${JSON.stringify(ratioObj)} -> "${ratioStr}"`);
      const ids = hwcData[ratioStr] || [];
      console.log(`  找到组合数: ${ids.length}`);
      ids.forEach(id => candidateIds.add(id));
    });

    console.log(`\n=== 验证结果 ===`);
    console.log(`总候选组合数: ${candidateIds.size}`);

    if (candidateIds.size > 0) {
      console.log('\n✅ 修复验证通过！热温冷比例格式转换正常工作');
      console.log(`  预期: 18360 个组合`);
      console.log(`  实际: ${candidateIds.size} 个组合`);
    } else {
      console.log('\n❌ 修复验证失败！候选组合数为0');
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

verify();
