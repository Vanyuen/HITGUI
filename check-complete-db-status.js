const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 数据库集合列表 ===');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('集合数量:', collections.length);

    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      console.log(`  ${coll.name}: ${count} 条记录`);
    }

    // 检查大乐透数据
    const DLT = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));
    const dltCount = await DLT.countDocuments();
    const latestDLT = await DLT.findOne().sort({ Issue: -1 }).lean();
    const oldestDLT = await DLT.findOne().sort({ Issue: 1 }).lean();

    console.log('\n=== 大乐透数据 ===');
    console.log('总记录数:', dltCount);
    console.log('最早期号:', oldestDLT?.Issue);
    console.log('最新期号:', latestDLT?.Issue);

    // 检查25124期数据
    const issue25124 = await DLT.findOne({ Issue: '25124' }).lean();
    console.log('\n期号25124存在:', !!issue25124);
    if (issue25124) {
      console.log('  红球:', issue25124.Red);
      console.log('  蓝球:', issue25124.Blue);
    }

    // 检查25125期数据
    const issue25125 = await DLT.findOne({ Issue: '25125' }).lean();
    console.log('期号25125存在:', !!issue25125);
    if (issue25125) {
      console.log('  红球:', issue25125.Red);
      console.log('  蓝球:', issue25125.Blue);
    }

    // 检查Issue字段类型
    const sampleIssues = await DLT.find({}).limit(5).lean();
    console.log('\n=== Issue字段类型检查 ===');
    sampleIssues.forEach(item => {
      console.log(`期号: ${item.Issue}, 类型: ${typeof item.Issue}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
