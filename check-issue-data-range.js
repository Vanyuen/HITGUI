const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 检查开奖数据范围 ===\n');

  // 获取最新和最旧的期号
  const latest = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(1)
    .toArray();

  const oldest = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: 1 })
    .limit(1)
    .toArray();

  console.log('数据库中的期号范围:');
  console.log('  最早期号:', oldest[0]?.Issue);
  console.log('  最新期号:', latest[0]?.Issue);

  // 检查25074-25125范围内的数据
  console.log('\n检查任务期号范围 (25074-25125):');
  const issuesInRange = await db.collection('hit_dlts')
    .find({
      Issue: {
        $gte: '25074',
        $lte: '25125'
      }
    })
    .sort({ Issue: 1 })
    .toArray();

  console.log('该范围内的期号数量:', issuesInRange.length);
  if (issuesInRange.length > 0) {
    console.log('范围内期号:', issuesInRange.map(i => i.Issue).join(', '));
  } else {
    console.log('❌ 该范围内没有任何开奖数据！');
  }

  // 检查最近的几期
  console.log('\n最近10期开奖数据:');
  const recent = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(10)
    .toArray();

  recent.forEach(r => {
    console.log(`  期号 ${r.Issue}: 红球 ${r.Red || r.red}, 蓝球 ${r.Blue || r.blue}`);
  });

  await client.close();
})();
