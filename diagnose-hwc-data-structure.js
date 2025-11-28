const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds',
      new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' })
    );

    console.log('=== 诊断已开奖期 vs 推算期的热温冷数据 ===\n');

    // 测试25115 (已开奖期)
    const hwc25115 = await HwcOptimized.findOne({
      base_issue: '25114',
      target_issue: '25115'
    }).lean();

    console.log('1. 期号对 25114 -> 25115 (已开奖期):');
    if (hwc25115) {
      console.log('  ✅ 数据存在');
      console.log('  is_predicted:', hwc25115.is_predicted);
      console.log('  hot_warm_cold_data 类型:', typeof hwc25115.hot_warm_cold_data);
      console.log('  hot_warm_cold_data 是否存在:', !!hwc25115.hot_warm_cold_data);

      if (hwc25115.hot_warm_cold_data) {
        const keys = Object.keys(hwc25115.hot_warm_cold_data);
        console.log('  包含', keys.length, '种热温冷比');
        console.log('  "4:1:0" 存在:', hwc25115.hot_warm_cold_data.hasOwnProperty('4:1:0'));
        if (hwc25115.hot_warm_cold_data['4:1:0']) {
          console.log('  "4:1:0" 组合数:', hwc25115.hot_warm_cold_data['4:1:0'].length);
        }
      } else {
        console.log('  ❌ hot_warm_cold_data 字段不存在!');
      }
    } else {
      console.log('  ❌ 数据不存在');
    }

    // 测试25116 (已开奖期)
    const hwc25116 = await HwcOptimized.findOne({
      base_issue: '25115',
      target_issue: '25116'
    }).lean();

    console.log('\n2. 期号对 25115 -> 25116 (已开奖期):');
    if (hwc25116) {
      console.log('  ✅ 数据存在');
      console.log('  is_predicted:', hwc25116.is_predicted);
      console.log('  hot_warm_cold_data 类型:', typeof hwc25116.hot_warm_cold_data);
      console.log('  hot_warm_cold_data 是否存在:', !!hwc25116.hot_warm_cold_data);

      if (hwc25116.hot_warm_cold_data) {
        const keys = Object.keys(hwc25116.hot_warm_cold_data);
        console.log('  包含', keys.length, '种热温冷比');
        console.log('  "4:1:0" 存在:', hwc25116.hot_warm_cold_data.hasOwnProperty('4:1:0'));
        if (hwc25116.hot_warm_cold_data['4:1:0']) {
          console.log('  "4:1:0" 组合数:', hwc25116.hot_warm_cold_data['4:1:0'].length);
        }
      } else {
        console.log('  ❌ hot_warm_cold_data 字段不存在!');
      }
    } else {
      console.log('  ❌ 数据不存在');
    }

    // 测试25125 (推算期)
    const hwc25125 = await HwcOptimized.findOne({
      base_issue: '25124',
      target_issue: '25125'
    }).lean();

    console.log('\n3. 期号对 25124 -> 25125 (推算期):');
    if (hwc25125) {
      console.log('  ✅ 数据存在');
      console.log('  is_predicted:', hwc25125.is_predicted);
      console.log('  hot_warm_cold_data 类型:', typeof hwc25125.hot_warm_cold_data);
      console.log('  hot_warm_cold_data 是否存在:', !!hwc25125.hot_warm_cold_data);

      if (hwc25125.hot_warm_cold_data) {
        const keys = Object.keys(hwc25125.hot_warm_cold_data);
        console.log('  包含', keys.length, '种热温冷比');
        console.log('  "4:1:0" 存在:', hwc25125.hot_warm_cold_data.hasOwnProperty('4:1:0'));
        if (hwc25125.hot_warm_cold_data['4:1:0']) {
          console.log('  "4:1:0" 组合数:', hwc25125.hot_warm_cold_data['4:1:0'].length);
        }
      } else {
        console.log('  ❌ hot_warm_cold_data 字段不存在!');
      }
    } else {
      console.log('  ❌ 数据不存在');
    }

    console.log('\n=== 关键对比 ===');
    console.log('如果已开奖期和推算期的数据结构一致，但结果不同，');
    console.log('说明问题不在数据，而在代码的处理逻辑中！');

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
