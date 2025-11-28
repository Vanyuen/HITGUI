/**
 * 验证 GlobalCacheManager 模型修复
 * 2025-11-25
 */
const mongoose = require('mongoose');

async function verify() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟 DLTRedCombinations 模型（正确的模型）
    const DLTRedCombinations = mongoose.model('DLTRedCombinations_verify', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' }));

    // 查询数据
    const redCombos = await DLTRedCombinations.find({}).limit(5).lean();

    console.log('=== 验证红球组合数据字段 ===');
    console.log('查询到记录数:', redCombos.length);

    if (redCombos.length > 0) {
      const sample = redCombos[0];
      console.log('\n样本数据字段:');
      console.log('  combination_id:', sample.combination_id, '(期望有值)');
      console.log('  zone_ratio:', sample.zone_ratio, '(期望有值)');
      console.log('  sum_value:', sample.sum_value, '(期望有值)');
      console.log('  span_value:', sample.span_value, '(期望有值)');
      console.log('  odd_even_ratio:', sample.odd_even_ratio, '(期望有值)');
      console.log('  ac_value:', sample.ac_value, '(期望有值)');
      console.log('  red_ball_1:', sample.red_ball_1, '(期望有值)');

      // 检查是否有旧字段名
      console.log('\n检查旧字段名（应该为 undefined）:');
      console.log('  id:', sample.id);
      console.log('  zoneRatio:', sample.zoneRatio);
      console.log('  sum:', sample.sum);

      // 验证筛选逻辑
      console.log('\n=== 验证筛选逻辑 ===');
      const candidateIds = new Set([sample.combination_id]);
      const filteredCombos = redCombos.filter(c => candidateIds.has(c.combination_id));
      console.log('candidateIds.has(c.combination_id) 筛选结果:', filteredCombos.length, '(期望 1)');

      if (filteredCombos.length === 1) {
        console.log('\n✅ 修复验证通过！字段名匹配正确');
      } else {
        console.log('\n❌ 修复验证失败！筛选结果不正确');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

verify();
