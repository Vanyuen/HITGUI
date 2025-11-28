const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 倒序查找第一个有效数据的期号
  const all = await db.collection('hit_dlts').find({}).sort({ID: -1}).toArray();

  console.log('查找最后一个有完整数据的期号:\n');

  let lastValidIndex = -1;
  for (let i = 0; i < all.length; i++) {
    const d = all[i];
    const red = [d.Red_1, d.Red_2, d.Red_3, d.Red_4, d.Red_5];
    const hasRed = red.every(r => r && r > 0);
    const hasMissing = d.Red_Missing && d.Red_Missing.length === 35;

    if (hasRed) {
      console.log(`最后一个有红球数据的期号: ${d.Issue} (ID: ${d.ID})`);
      console.log(`  红球: ${red.join(', ')}`);
      console.log(`  蓝球: ${d.Blue_1}, ${d.Blue_2}`);
      console.log(`  有缺失值: ${hasMissing ? '是' : '否'}`);
      if (hasMissing) {
        console.log(`  缺失值前5个: ${d.Red_Missing.slice(0, 5).join(',')}`);
      }
      lastValidIndex = i;
      break;
    }
  }

  if (lastValidIndex >= 0) {
    const invalidCount = lastValidIndex;
    console.log(`\n从最新期往前，有 ${invalidCount} 期数据不完整`);

    console.log('\n数据不完整的期号:');
    for (let i = 0; i < Math.min(10, invalidCount); i++) {
      console.log(`  ${all[i].Issue} (ID: ${all[i].ID})`);
    }
    if (invalidCount > 10) {
      console.log(`  ... 还有 ${invalidCount - 10} 期`);
    }
  }

  await mongoose.connection.close();
}).catch(console.error);
