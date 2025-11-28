const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const recent30 = await db.collection('hit_dlts')
    .find({})
    .sort({ID: -1})
    .limit(30)
    .toArray();

  console.log('最近30期数据完整性检查:\n');

  recent30.reverse().forEach(d => {
    const red = [d.Red_1, d.Red_2, d.Red_3, d.Red_4, d.Red_5];
    const hasRed = red.every(r => r && r > 0);
    const hasMissing = d.Red_Missing && d.Red_Missing.length === 35;

    const redStatus = hasRed ? '✅' : '❌空';
    const missingStatus = hasMissing ? '✅' : '❌空';

    console.log(`  ${d.Issue} (ID:${d.ID}): 红球=${redStatus}, 缺失值=${missingStatus}`);
  });

  await mongoose.connection.close();
}).catch(console.error);
