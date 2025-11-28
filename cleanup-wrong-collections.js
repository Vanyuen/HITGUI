const mongoose = require('mongoose');
const { COLLECTIONS } = require('./constants/collections');

console.log('🧹 清理错误的空集合\n');

// 所有错误的集合名列表
const WRONG_COLLECTIONS = [
  // 单复数错误
  'hit_dlt_redcombinationshotwarmcoldoptimized',  // 缺少's'

  // 缺少 'optimized' 关键字
  'hit_dlt_redcombinationshotwarmcolds',  // 缺少'optimized'

  // 缩写版本
  'hit_dlt_redcombinationshwcoptimized',
  'hit_dlt_hwcoptimized',
  'hit_dlt_hotwarmcoldoptimized',  // 缺少'redcombinations'

  // 大写版本
  'HIT_DLT_RedCombinationsHotWarmColdOptimized',
  'HIT_DLT_RedCombinationsHWCOptimized',
  'HIT_DLT_HotWarmColdOptimized',
  'HIT_DLT_HWCOptimized',

  // 缺少前缀
  'dltredcombinationshotwarmcoldoptimizeds',

  // 测试用或错误命名
  'wronghwcoptimizeds',

  // 其他空集合（非优化表，但容易混淆）
  // 'HwcPositivePredictionTaskResult',  // 这个保留，可能是Mongoose自动创建的
  // 'hwcpositivepredictiontaskresults',  // 这个保留
];

async function cleanupWrongCollections() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 检查错误集合');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allCollections = await db.listCollections().toArray();
    const existingCollections = allCollections.map(c => c.name);

    console.log(`找到 ${WRONG_COLLECTIONS.length} 个潜在的错误集合名\n`);

    const toCleanup = [];
    const skipped = [];

    for (const wrongName of WRONG_COLLECTIONS) {
      if (existingCollections.includes(wrongName)) {
        const count = await db.collection(wrongName).countDocuments();

        if (count === 0) {
          toCleanup.push({ name: wrongName, count });
        } else {
          skipped.push({ name: wrongName, count });
          console.log(`⚠️  ${wrongName}: ${count}条记录 - 需要人工确认`);
        }
      }
    }

    console.log('');

    if (skipped.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('⚠️  需要人工确认的集合（有数据）');
      console.log('═══════════════════════════════════════════════════════════════\n');

      skipped.forEach(coll => {
        console.log(`   ${coll.name}: ${coll.count}条`);
      });

      console.log('\n⚠️  这些集合有数据，请手动检查后决定是否删除！\n');
    }

    if (toCleanup.length === 0) {
      console.log('✅ 没有需要清理的空集合\n');
      await mongoose.connection.close();
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🧹 准备清理 ${toCleanup.length} 个空集合`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    toCleanup.forEach((coll, idx) => {
      console.log(`   ${idx + 1}. ${coll.name}`);
    });

    console.log('\n确认删除这些集合？(按Ctrl+C取消)\n');

    // 等待3秒后开始删除
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('开始清理...\n');

    let deleted = 0;
    for (const coll of toCleanup) {
      try {
        await db.collection(coll.name).drop();
        console.log(`   ✅ 已删除: ${coll.name}`);
        deleted++;
      } catch (err) {
        console.log(`   ❌ 删除失败: ${coll.name} - ${err.message}`);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 清理结果');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`✅ 成功删除: ${deleted}个集合`);
    console.log(`⚠️  需要人工确认: ${skipped.length}个集合`);
    console.log(`❌ 删除失败: ${toCleanup.length - deleted}个集合\n`);

    // 验证正确的集合仍然存在
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 验证正确的集合');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const correctCount = await db.collection(COLLECTIONS.HWC_OPTIMIZED).countDocuments();
    console.log(`✅ 正确的集合: ${COLLECTIONS.HWC_OPTIMIZED}`);
    console.log(`   记录数: ${correctCount.toLocaleString()}条\n`);

    if (correctCount > 0) {
      console.log('🎉 清理完成！正确的集合数据完好！\n');
    } else {
      console.log('❌ 警告！正确的集合为空或不存在！\n');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ 清理失败:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupWrongCollections();
