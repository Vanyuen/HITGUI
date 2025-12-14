const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 检查遗漏值表
  console.log('=== 检查红球遗漏值表 ===');
  const redMissingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

  // 检查最新的遗漏数据
  const latestMissing = await redMissingColl
    .find({})
    .sort({ Issue: -1 })
    .limit(5)
    .toArray();

  console.log('最新5期遗漏数据:');
  latestMissing.forEach(m => {
    console.log('  Issue:', m.Issue);
  });

  // 2. 检查25139, 25140, 25141是否有遗漏数据
  console.log('\n=== 检查25139-25141的遗漏数据 ===');
  for (const issue of ['25139', '25140', '25141']) {
    const missing = await redMissingColl.findOne({ Issue: issue });
    console.log(`Issue ${issue}: ${missing ? '有遗漏数据' : '❌ 没有遗漏数据'}`);
  }

  // 3. 检查数据库中最新期号
  console.log('\n=== 检查hit_dlts最新期号 ===');
  const latestDlt = await db.collection('hit_dlts')
    .findOne({}, { sort: { Issue: -1 } });
  console.log('最新期号:', latestDlt?.Issue);
  console.log('最新ID:', latestDlt?.ID);

  await client.close();
}

diagnose().catch(console.error);
