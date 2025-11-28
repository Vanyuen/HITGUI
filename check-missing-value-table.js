const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 检查遗漏值表数据范围...\n');

  const collection = 'hit_dlt_basictrendchart_redballmissing_histories';

  const totalCount = await db.collection(collection).countDocuments();
  console.log(`遗漏值表总记录数: ${totalCount.toLocaleString()}\n`);

  // 检查最新记录
  const latest = await db.collection(collection)
    .find({})
    .sort({ Issue: -1 })
    .limit(5)
    .toArray();

  console.log('最新5期遗漏值数据:');
  latest.forEach(r => {
    console.log(`  期号 ${r.Issue} (ID: ${r.ID})`);
  });

  // 检查是否有 9153-25124 的数据
  console.log('\n📊 检查关键期号范围的遗漏值数据...');

  const checkIssues = [9153, 15000, 20000, 25114, 25120, 25124];
  for (const issue of checkIssues) {
    const record = await db.collection(collection).findOne({ Issue: issue });
    if (record) {
      console.log(`  期号 ${issue}: ✅ 存在`);
    } else {
      console.log(`  期号 ${issue}: ❌ 不存在`);
    }
  }

  // 统计有数据的期号范围
  const minIssue = await db.collection(collection).findOne({}, { sort: { Issue: 1 } });
  const maxIssue = await db.collection(collection).findOne({}, { sort: { Issue: -1 } });

  console.log(`\n📊 遗漏值表期号范围:`);
  console.log(`  最小期号: ${minIssue?.Issue || '无'}`);
  console.log(`  最大期号: ${maxIssue?.Issue || '无'}`);

  await mongoose.connection.close();
}).catch(console.error);
