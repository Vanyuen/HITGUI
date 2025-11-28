const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const coll = db.collection('hit_dlts');
  const latest = await coll.find({}).sort({Issue: -1}).limit(20).toArray();
  console.log('最新20期:');
  latest.forEach(d => console.log('期号:', d.Issue));
  await mongoose.disconnect();
});
