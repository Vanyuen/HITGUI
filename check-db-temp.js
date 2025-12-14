const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const records = await db.collection('hit_dlts').find({Issue: {$gte: 25130, $lte: 25140}}).sort({Issue: 1}).toArray();
  console.log('Records in 25130-25140:', records.length);
  records.forEach(r => console.log('Issue:', r.Issue, 'ID:', r.ID));
  const sample = await db.collection('hit_dlts').find({}).sort({ID: -1}).limit(5).toArray();
  console.log('Latest 5 by ID:');
  sample.forEach(r => console.log('Issue:', r.Issue, 'ID:', r.ID));
  mongoose.disconnect();
});
