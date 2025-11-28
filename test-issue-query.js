const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 直接用原生MongoDB查询
  const collection = db.collection('hit_dlts');

  // 检查集合是否存在以及字段名
  const sample = await collection.findOne({});
  console.log('Sample record fields:', Object.keys(sample || {}));
  console.log('Sample Issue:', sample?.Issue, 'Type:', typeof sample?.Issue);
  console.log('Sample ID:', sample?.ID, 'Type:', typeof sample?.ID);

  // 测试查询
  const targetIssues = ['25124', '25123', '25122', '25121', '25120'];
  console.log('\nQuery target issues:', targetIssues);

  const records = await collection.find({ Issue: { $in: targetIssues } }).project({ Issue: 1, ID: 1 }).toArray();
  console.log('Query result count:', records.length);
  if (records.length > 0) {
    console.log('Records found:', records);
  } else {
    // 尝试查询所有期号看格式
    const allIssues = await collection.find({}).project({ Issue: 1 }).limit(5).toArray();
    console.log('Sample issues from DB:', allIssues.map(r => r.Issue));
  }

  mongoose.disconnect();
}).catch(e => console.error('Error:', e));
