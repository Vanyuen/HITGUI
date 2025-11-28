const mongoose = require('mongoose');

console.log('🔍 分析热温冷优化表集合名称混淆问题\n');
console.log('═══════════════════════════════════════════════════════════════\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 列出所有可能混淆的集合名称
  const hwcRelatedPatterns = [
    'hotwarmcold',
    'hwc',
    'optimized'
  ];

  const allCollections = await db.listCollections().toArray();

  console.log('📊 所有与热温冷相关的集合名称:\n');

  const hwcCollections = allCollections.filter(coll => {
    const name = coll.name.toLowerCase();
    return hwcRelatedPatterns.some(pattern => name.includes(pattern));
  });

  console.log(`找到 ${hwcCollections.length} 个相关集合:\n`);

  for (const coll of hwcCollections) {
    const count = await db.collection(coll.name).countDocuments();

    // 获取一条示例记录查看结构
    const sample = await db.collection(coll.name).findOne({});

    console.log(`📁 ${coll.name}`);
    console.log(`   记录数: ${count}`);

    if (sample) {
      const fields = Object.keys(sample).filter(k => k !== '_id' && k !== '__v');
      console.log(`   字段: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);

      // 检查是否有 base_issue 和 target_issue 字段
      if (sample.base_issue && sample.target_issue) {
        console.log(`   最新期号对: ${sample.base_issue}→${sample.target_issue}`);
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 关键发现\n');

  const correctCollection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
  const correctData = await db.collection(correctCollection).countDocuments();

  console.log(`✅ 正确的集合: ${correctCollection}`);
  console.log(`   记录数: ${correctData}\n`);

  // 找出所有空集合（容易被误认为是正确的）
  const emptyCollections = hwcCollections.filter(coll => {
    const name = coll.name;
    return name !== correctCollection;
  });

  if (emptyCollections.length > 0) {
    console.log('❌ 容易混淆的空集合（这些都不是正确的！）:\n');
    for (const coll of emptyCollections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`   - ${coll.name} (${count}条)`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💡 混淆原因分析\n');

  const namingVariants = [
    { name: 'hit_dlt_redcombinationshotwarmcoldoptimizeds', desc: '✅ 正确（复数形式，全小写）', count: correctData },
    { name: 'hit_dlt_redcombinationshotwarmcoldoptimized', desc: '❌ 错误（单数形式）', count: await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized').countDocuments() },
    { name: 'hit_dlt_redcombinationshwcoptimized', desc: '❌ 错误（缩写版本）', count: await db.collection('hit_dlt_redcombinationshwcoptimized').countDocuments() },
    { name: 'dltredcombinationshotwarmcoldoptimizeds', desc: '❌ 错误（缺少hit_前缀）', count: await db.collection('dltredcombinationshotwarmcoldoptimizeds').countDocuments() },
    { name: 'HIT_DLT_RedCombinationsHotWarmColdOptimized', desc: '❌ 错误（大写版本，单数）', count: await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').countDocuments() },
    { name: 'HIT_DLT_RedCombinationsHWCOptimized', desc: '❌ 错误（大写缩写版本）', count: await db.collection('HIT_DLT_RedCombinationsHWCOptimized').countDocuments() },
    { name: 'HIT_DLT_HotWarmColdOptimized', desc: '❌ 错误（缺少RedCombinations）', count: await db.collection('HIT_DLT_HotWarmColdOptimized').countDocuments() },
    { name: 'HIT_DLT_HWCOptimized', desc: '❌ 错误（极简版本）', count: await db.collection('HIT_DLT_HWCOptimized').countDocuments() }
  ];

  console.log('可能的命名变体及其记录数:\n');
  namingVariants.forEach(variant => {
    console.log(`${variant.desc}`);
    console.log(`   集合名: ${variant.name}`);
    console.log(`   记录数: ${variant.count}\n`);
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 代码中的引用检查\n');

  console.log('建议搜索代码中所有引用热温冷优化表的位置，确保都使用正确的集合名：');
  console.log(`   ${correctCollection}\n`);

  console.log('常见错误模式:');
  console.log('   1. 使用单数而非复数（optimized vs optimizeds）');
  console.log('   2. 使用缩写（hwc vs hotwarmcold）');
  console.log('   3. 使用大写（HIT_DLT vs hit_dlt）');
  console.log('   4. 缺少前缀（dlt vs hit_dlt）\n');

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
