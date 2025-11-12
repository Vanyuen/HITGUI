const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 检查蓝球配对数据 ===\n');

  const result = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .findOne({ task_id: 'hwc-pos-20251105-2dq', period: 25114 });

  console.log('红球组合ID (前5个):', result.red_combinations?.slice(0, 5));
  console.log('蓝球组合ID (前5个):', result.blue_combinations?.slice(0, 5));
  console.log('\npaired_combinations存在:', !!result.paired_combinations);

  if (result.paired_combinations && result.paired_combinations.length > 0) {
    console.log('\npaired_combinations数量:', result.paired_combinations.length);
    console.log('\n前3个配对样本:');
    result.paired_combinations.slice(0, 3).forEach((pair, idx) => {
      console.log(`\n配对 ${idx + 1}:`);
      console.log('  红球:', pair.red_balls);
      console.log('  蓝球:', pair.blue_balls);
    });
  } else {
    console.log('\n❌ 没有paired_combinations数据');
    console.log('\n尝试查询蓝球组合数据...');

    if (result.blue_combinations && result.blue_combinations.length > 0) {
      const blueComboIds = result.blue_combinations.slice(0, 5);
      console.log('查询蓝球组合ID:', blueComboIds);

      const blueCombos = await db.collection('hit_dlt_bluecombinations')
        .find({ combination_id: { $in: blueComboIds } })
        .toArray();

      console.log('\n找到蓝球组合:', blueCombos.length, '个');
      blueCombos.forEach(bc => {
        console.log(`  组合ID ${bc.combination_id}: 蓝球 [${bc.blue_ball_1}, ${bc.blue_ball_2}]`);
      });
    }
  }

  await client.close();
})();
