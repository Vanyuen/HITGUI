const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const latest5 = await db.collection('hit_dlts')
    .find({})
    .sort({ID: -1})
    .limit(5)
    .toArray();

  console.log('最新5期数据:\n');

  latest5.reverse().forEach(d => {
    console.log(`期号 ${d.Issue} (ID: ${d.ID}):`);
    console.log(`  红球: ${d.Red1}, ${d.Red2}, ${d.Red3}, ${d.Red4}, ${d.Red5}`);
    console.log(`  蓝球: ${d.Blue1}, ${d.Blue2}`);
    console.log('');
  });

  await mongoose.connection.close();
}).catch(console.error);
