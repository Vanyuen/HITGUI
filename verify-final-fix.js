const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 最终验证：期号25114和25115 ===\n');

  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({
      task_id: 'hwc-pos-20251105-yw1',
      period: { $in: [25114, 25115] }
    })
    .toArray();

  results.forEach(r => {
    console.log(`期号 ${r.period}:`);
    console.log('  组合数:', r.combination_count);
    console.log('  红球最高命中:', `${r.hit_analysis?.max_red_hit || 0}/5`);
    console.log('  蓝球最高命中:', `${r.hit_analysis?.max_blue_hit || 0}/2`);
    console.log('  一等奖:', r.hit_analysis?.prize_stats?.first_prize?.count || 0);
    console.log('  二等奖:', r.hit_analysis?.prize_stats?.second_prize?.count || 0);
    console.log('  三等奖:', r.hit_analysis?.prize_stats?.third_prize?.count || 0);
    console.log('  六等奖:', r.hit_analysis?.prize_stats?.sixth_prize?.count || 0);
    console.log('  八等奖:', r.hit_analysis?.prize_stats?.eighth_prize?.count || 0);
    console.log('  九等奖:', r.hit_analysis?.prize_stats?.ninth_prize?.count || 0);
    console.log('  命中率:', `${(r.hit_analysis?.hit_rate || 0).toFixed(2)}%`);
    console.log('  总奖金:', `¥${(r.hit_analysis?.total_prize || 0).toLocaleString()}`);
    console.log('');
  });

  await client.close();
})();
