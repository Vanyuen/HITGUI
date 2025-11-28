const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 检查热温冷优化表中 25115-25124 期号对的数据...\n');

  // 检查期号对：25114→25115, 25115→25116, ..., 25123→25124, 25124→25125
  const issuePairs = [];
  for (let i = 25114; i <= 25124; i++) {
    issuePairs.push({
      base: i,
      target: i + 1
    });
  }

  console.log(`检查 ${issuePairs.length} 个期号对:\n`);

  for (const pair of issuePairs) {
    const records = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized')
      .find({
        base_issue: pair.base,
        target_issue: pair.target
      })
      .toArray();

    if (records.length > 0) {
      const record = records[0];
      const hwcDataKeys = record.hot_warm_cold_data ? Object.keys(record.hot_warm_cold_data).length : 0;
      const isPredicted = record.is_predicted;

      console.log(`  ${pair.base} → ${pair.target}: ✅ 找到${records.length}条记录`);
      console.log(`    is_predicted: ${isPredicted}`);
      console.log(`    热温冷比种类: ${hwcDataKeys}`);

      if (hwcDataKeys > 0 && record.hot_warm_cold_data) {
        // 检查 4:1:0 比例的数据
        const ratio410 = record.hot_warm_cold_data['4:1:0'];
        if (ratio410) {
          console.log(`    4:1:0 比例组合数: ${ratio410.length}`);
        } else {
          console.log(`    ⚠️ 缺少 4:1:0 比例数据`);
        }
      }
    } else {
      console.log(`  ${pair.base} → ${pair.target}: ❌ 未找到记录`);
    }
  }

  console.log('\n✅ 结论:');
  console.log('  如果所有期号对都有数据，说明优化表完整');
  console.log('  如果缺少记录或 is_predicted 字段，说明需要重新生成优化表');

  await mongoose.connection.close();
}).catch(console.error);
