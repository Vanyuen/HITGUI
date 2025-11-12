const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 验证修复后的数据 ===\n');

  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251105-yw1' })
    .sort({ period: 1 })
    .limit(10)
    .toArray();

  console.log(`找到 ${results.length} 条结果\n`);

  results.forEach(r => {
    console.log(`期号 ${r.period}:`);
    console.log(`  红球组合数: ${r.red_combinations?.length || 0}`);
    console.log(`  开奖红球: ${r.winning_info?.red?.join(',') || '无'}`);
    console.log(`  开奖蓝球: ${r.winning_info?.blue?.join(',') || '无'}`);
    console.log(`  红球最高命中: ${r.hit_statistics?.max_red_hit || 0}/5`);
    console.log(`  蓝球最高命中: ${r.hit_statistics?.max_blue_hit || 0}/2`);
    console.log(`  总奖金: ¥${(r.hit_statistics?.total_prize || 0).toLocaleString()}`);
    console.log(`  命中组合数: ${r.hit_statistics?.hit_count || 0}`);
    console.log('');
  });

  await client.close();
})();
