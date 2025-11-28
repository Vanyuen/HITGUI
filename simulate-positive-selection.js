/**
 * 模拟任务执行，诊断数据流问题
 */
const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));
    const RedCombinations = mongoose.model('hit_dlt_redcombinations', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' }));

    // 模拟任务的正选条件
    const positive_selection = {
      red_hot_warm_cold_ratios: [{ hot: 4, warm: 1, cold: 0 }],
      zone_ratios: ['2:1:2'],
      sum_ranges: [{ min: 60, max: 90 }, { min: 91, max: 120 }],
      span_ranges: [{ min: 18, max: 25 }, { min: 26, max: 32 }],
      odd_even_ratios: ['2:3', '3:2'],
      ac_values: [4, 5, 6]
    };

    // 模拟期号对: 25124 -> 25125
    const baseIssue = '25124';
    const targetIssue = '25125';

    console.log('=== 模拟正选筛选过程 ===');
    console.log(`期号对: ${baseIssue} -> ${targetIssue}`);
    console.log('正选条件:', JSON.stringify(positive_selection, null, 2));

    // Step 1: 获取热温冷数据
    const hwcRecord = await HwcOptimized.findOne({
      base_issue: baseIssue,
      target_issue: targetIssue
    }).lean();

    if (!hwcRecord) {
      console.log('❌ 未找到热温冷数据');
      process.exit(1);
    }

    const hwcData = hwcRecord.hot_warm_cold_data || {};

    // 转换热温冷比格式并查找组合ID
    let candidateIds = new Set();
    for (const ratioObj of positive_selection.red_hot_warm_cold_ratios) {
      const ratioStr = `${ratioObj.hot}:${ratioObj.warm}:${ratioObj.cold}`;
      const ids = hwcData[ratioStr] || [];
      console.log(`\nStep 1: 热温冷比 "${ratioStr}" -> ${ids.length} 个组合ID`);
      ids.forEach(id => candidateIds.add(id));
    }
    console.log(`Step 1 总计: ${candidateIds.size} 个候选组合`);

    // Step 2: 查询红球组合详情
    const candidateIdArray = Array.from(candidateIds);
    console.log(`\n查询 DLTRedCombinations, ID数量: ${candidateIdArray.length}`);

    const combinations = await RedCombinations.find({
      combination_id: { $in: candidateIdArray }
    }).lean();

    console.log(`查询结果: ${combinations.length} 条记录`);

    if (combinations.length === 0) {
      console.log('❌ 未找到任何红球组合数据！');

      // 检查红球组合表
      const sampleCombo = await RedCombinations.findOne().lean();
      console.log('\n红球组合表样本:', sampleCombo ? JSON.stringify(sampleCombo, null, 2) : '空');

      const totalCount = await RedCombinations.countDocuments();
      console.log('红球组合表总记录数:', totalCount);

      // 检查ID是否匹配
      console.log('\n候选ID样本:', candidateIdArray.slice(0, 5));
      console.log('样本ID类型:', typeof candidateIdArray[0]);
      console.log('数据库ID字段类型:', typeof sampleCombo?.combination_id);

      process.exit(1);
    }

    // Step 3: 应用后续筛选
    let filteredCombos = combinations;

    // 区间比筛选
    if (positive_selection.zone_ratios?.length > 0) {
      const zoneSet = new Set(positive_selection.zone_ratios);
      const beforeCount = filteredCombos.length;
      filteredCombos = filteredCombos.filter(c => zoneSet.has(c.zone_ratio));
      console.log(`\nStep 2 区间比筛选: ${beforeCount} -> ${filteredCombos.length}`);
    }

    // 和值筛选
    if (positive_selection.sum_ranges?.length > 0) {
      const beforeCount = filteredCombos.length;
      filteredCombos = filteredCombos.filter(c =>
        positive_selection.sum_ranges.some(r => c.sum_value >= r.min && c.sum_value <= r.max)
      );
      console.log(`Step 3 和值筛选: ${beforeCount} -> ${filteredCombos.length}`);
    }

    // 跨度筛选
    if (positive_selection.span_ranges?.length > 0) {
      const beforeCount = filteredCombos.length;
      filteredCombos = filteredCombos.filter(c =>
        positive_selection.span_ranges.some(r => c.span_value >= r.min && c.span_value <= r.max)
      );
      console.log(`Step 4 跨度筛选: ${beforeCount} -> ${filteredCombos.length}`);
    }

    // 奇偶比筛选
    if (positive_selection.odd_even_ratios?.length > 0) {
      const oeSet = new Set(positive_selection.odd_even_ratios);
      const beforeCount = filteredCombos.length;
      filteredCombos = filteredCombos.filter(c => oeSet.has(c.odd_even_ratio));
      console.log(`Step 5 奇偶比筛选: ${beforeCount} -> ${filteredCombos.length}`);
    }

    // AC值筛选
    if (positive_selection.ac_values?.length > 0) {
      const acSet = new Set(positive_selection.ac_values);
      const beforeCount = filteredCombos.length;
      filteredCombos = filteredCombos.filter(c => acSet.has(c.ac_value));
      console.log(`Step 6 AC值筛选: ${beforeCount} -> ${filteredCombos.length}`);
    }

    console.log(`\n=== 最终结果 ===`);
    console.log(`筛选后组合数: ${filteredCombos.length}`);

    if (filteredCombos.length > 0) {
      console.log('\n前3个组合样本:');
      filteredCombos.slice(0, 3).forEach((c, idx) => {
        console.log(`${idx + 1}. ID=${c.combination_id}, 红球=[${c.red_ball_1},${c.red_ball_2},${c.red_ball_3},${c.red_ball_4},${c.red_ball_5}]`);
        console.log(`   zone=${c.zone_ratio}, sum=${c.sum_value}, span=${c.span_value}, oe=${c.odd_even_ratio}, ac=${c.ac_value}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
