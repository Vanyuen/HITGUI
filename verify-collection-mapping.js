/**
 * 验证server.js中的模型定义与实际数据库集合的映射关系
 *
 * 目的: 确认所有模型都能正确访问到对应的数据集合
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

// server.js 中的模型定义 (行号: 模型名 => 期望的集合名)
const MODEL_MAPPINGS = {
  230: { model: 'hit_dlts', schema: 'dltSchema', collection: 'hit_dlts' },
  256: { model: 'HIT_DLT_ComboFeatures', collection: 'hit_dlt_combofeatures' },
  400: { model: 'hit_dlts', collection: 'hit_dlt_redcombinations' },
  416: { model: 'hit_dlts', collection: 'hit_dlts' }, // schema中指定
  462: { model: 'HIT_DLT_RedCombinationsHotWarmColdOptimized', collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' },
  505: { model: 'HIT_DLT_Basictrendchart_redballmissing_history', collection: 'hit_dlt_basictrendchart_redballmissing_histories' },
  519: { model: 'HIT_DLT_Basictrendchart_blueballmissing_history', collection: 'hit_dlts' },
  837: { model: 'HIT_DLT_PredictionTask', collection: 'hit_dlt_predictiontasks' },
  1003: { model: 'HIT_DLT_PredictionTaskResult', collection: 'hit_dlt_predictiontaskresults' },
  1034: { model: 'HIT_DLT_ExclusionDetails', collection: 'hit_dlt_exclusiondetails' },
  1215: { model: 'HIT_DLT_HwcPositivePredictionTask', collection: 'hit_dlt_hwcpositivepredictiontasks' },
  1317: { model: 'HIT_DLT_HwcPositivePredictionTaskResult', collection: 'hit_dlt_hwcpositivepredictiontaskresults' }
};

async function verify() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 获取所有实际存在的集合
    const allCollections = await db.listCollections().toArray();
    const collectionNames = allCollections.map(c => c.name);

    console.log('📋 模型映射验证:');
    console.log('='.repeat(100));
    console.log(`${'行号'.padEnd(6)} ${'模型名'.padEnd(50)} ${'期望集合名'.padEnd(50)} ${'状态'.padEnd(10)}`);
    console.log('='.repeat(100));

    let totalCount = 0;
    let matchCount = 0;
    let mismatchDetails = [];

    for (const [line, { model, collection }] of Object.entries(MODEL_MAPPINGS)) {
      totalCount++;

      const exists = collectionNames.includes(collection);
      const status = exists ? '✅ 存在' : '❌ 不存在';

      console.log(`${line.padEnd(6)} ${model.padEnd(50)} ${collection.padEnd(50)} ${status}`);

      if (exists) {
        matchCount++;
        // 显示记录数
        const count = await db.collection(collection).countDocuments();
        console.log(`${''.padEnd(6)} ${''.padEnd(50)} 记录数: ${count.toLocaleString()}`);
      } else {
        // 查找可能的集合名
        const similar = collectionNames.filter(c =>
          c.toLowerCase().includes(model.toLowerCase().replace('HIT_DLT_', '').slice(0, 10))
        );

        if (similar.length > 0) {
          console.log(`${''.padEnd(6)} ${''.padEnd(50)} 可能的集合: ${similar.join(', ')}`);
          mismatchDetails.push({
            line,
            model,
            expected: collection,
            actual: similar
          });
        }
      }

      console.log('-'.repeat(100));
    }

    console.log('');
    console.log('📊 统计摘要:');
    console.log('='.repeat(100));
    console.log(`  总模型数: ${totalCount}`);
    console.log(`  映射正确: ${matchCount} (${(matchCount/totalCount*100).toFixed(1)}%)`);
    console.log(`  映射错误: ${totalCount - matchCount} (${((totalCount - matchCount)/totalCount*100).toFixed(1)}%)`);
    console.log('');

    if (mismatchDetails.length > 0) {
      console.log('⚠️  发现映射不匹配的情况:');
      console.log('='.repeat(100));

      for (const detail of mismatchDetails) {
        console.log(`\n行 ${detail.line}: ${detail.model}`);
        console.log(`  期望集合: ${detail.expected}`);
        console.log(`  实际集合: ${detail.actual.join(', ')}`);

        // 检查每个可能的集合的数据量
        for (const actualColl of detail.actual) {
          const count = await db.collection(actualColl).countDocuments();
          console.log(`    - ${actualColl}: ${count.toLocaleString()} 条记录`);
        }
      }

      console.log('\n💡 修复建议:');
      console.log('='.repeat(100));
      console.log('在server.js中修复模型定义，添加第三个参数或collection配置：');
      console.log('');

      for (const detail of mismatchDetails) {
        if (detail.actual.length === 1) {
          const actualColl = detail.actual[0];
          console.log(`// 行 ${detail.line}`);
          console.log(`const ${detail.model.replace('HIT_DLT_', '')} = mongoose.model('${detail.model}', schema, '${actualColl}');`);
          console.log('');
        }
      }
    }

    // 特别检查关键集合
    console.log('\n🔍 关键集合检查:');
    console.log('='.repeat(100));

    const keyChecks = [
      { model: 'hit_dlts (主数据表)', expected: 'hit_dlts' },
      { model: 'hit_dlts (红球组合)', expected: 'hit_dlt_redcombinations' },
      { model: 'HIT_DLT_RedCombinationsHotWarmColdOptimized (热温冷优化表)', expected: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }
    ];

    for (const check of keyChecks) {
      const exists = collectionNames.includes(check.expected);
      if (exists) {
        const count = await db.collection(check.expected).countDocuments();
        const status = count > 0 ? '✅ 正常' : '⚠️  空集合';
        console.log(`${status} ${check.model}: ${count.toLocaleString()} 条记录`);
      } else {
        console.log(`❌ ${check.model}: 集合不存在`);
      }
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 验证完成');
  }
}

verify();
