const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 分析蓝球分布 ===\n');

  const result = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .findOne({ task_id: 'hwc-pos-20251105-2dq', period: 25114 });

  console.log('期号25114:');
  console.log('  pairing_mode:', result.pairing_mode);
  console.log('  red_combinations数量:', result.red_combinations?.length);
  console.log('  blue_combinations:', result.blue_combinations);
  console.log('  paired_combinations数量:', result.paired_combinations?.length);

  // 统计所有不同的蓝球组合
  if (result.paired_combinations && result.paired_combinations.length > 0) {
    const blueSet = new Set();
    result.paired_combinations.forEach(pair => {
      const blueKey = pair.blue_balls.join(',');
      blueSet.add(blueKey);
    });

    console.log('\n蓝球组合统计:');
    console.log('  不同蓝球组合数:', blueSet.size);
    console.log('  具体组合:');
    Array.from(blueSet).slice(0, 10).forEach(key => {
      const count = result.paired_combinations.filter(p => p.blue_balls.join(',') === key).length;
      console.log(`    [${key}]: ${count}次`);
    });

    if (blueSet.size > 10) {
      console.log(`    ... 还有${blueSet.size - 10}个组合`);
    }
  }

  // 检查前10个配对
  console.log('\n前10个配对样本:');
  result.paired_combinations?.slice(0, 10).forEach((pair, idx) => {
    console.log(`  ${idx + 1}. 红球[${pair.red_balls}] 蓝球[${pair.blue_balls}]`);
  });

  await client.close();
})();
