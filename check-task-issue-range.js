const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 检查任务期号范围数据 ===\n');

  // 检查25074-25125范围
  const issues = await db.collection('hit_dlts')
    .find({
      Issue: { $gte: 25074, $lte: 25125 }
    })
    .sort({ Issue: 1 })
    .toArray();

  console.log('期号25074-25125范围内的数据:', issues.length, '条');

  if (issues.length > 0) {
    console.log('\n前10期:');
    issues.slice(0, 10).forEach(i => {
      console.log(`  期号 ${i.Issue}: 红球 ${i.Red1},${i.Red2},${i.Red3},${i.Red4},${i.Red5} 蓝球 ${i.Blue1},${i.Blue2}`);
    });
  }

  // 专门检查25074
  const issue25074 = await db.collection('hit_dlts').findOne({ Issue: 25074 });
  console.log('\n期号25074:', issue25074 ? '✅ 存在' : '❌ 不存在');
  if (issue25074) {
    console.log('  红球:', `${issue25074.Red1},${issue25074.Red2},${issue25074.Red3},${issue25074.Red4},${issue25074.Red5}`);
    console.log('  蓝球:', `${issue25074.Blue1},${issue25074.Blue2}`);
  }

  // 检查25075
  const issue25075 = await db.collection('hit_dlts').findOne({ Issue: 25075 });
  console.log('\n期号25075:', issue25075 ? '✅ 存在' : '❌ 不存在');
  if (issue25075) {
    console.log('  红球:', `${issue25075.Red1},${issue25075.Red2},${issue25075.Red3},${issue25075.Red4},${issue25075.Red5}`);
    console.log('  蓝球:', `${issue25075.Blue1},${issue25075.Blue2}`);
  }

  await client.close();
})();
