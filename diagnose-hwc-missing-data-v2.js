const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 检查遗漏值表的总数和最新数据
  console.log('=== 检查红球遗漏值表结构 ===');
  const redMissingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

  const totalCount = await redMissingColl.countDocuments();
  console.log('总记录数:', totalCount);

  // 按Issue数值排序（转为数字）
  const allIssues = await redMissingColl.distinct('Issue');
  const sortedIssues = allIssues.map(i => parseInt(i)).sort((a, b) => b - a).slice(0, 10);
  console.log('最新10期Issue (数值排序):', sortedIssues);

  // 2. 检查25139-25141的遗漏数据详情
  console.log('\n=== 25139-25141遗漏数据详情 ===');
  for (const issue of ['25139', '25140', '25141']) {
    const missing = await redMissingColl.findOne({ Issue: issue });
    if (missing) {
      console.log(`\nIssue ${issue}:`);
      console.log('  数据键:', Object.keys(missing).slice(0, 10), '...');
      console.log('  示例: 1号球遗漏=', missing['1'], ', 35号球遗漏=', missing['35']);
    } else {
      console.log(`Issue ${issue}: ❌ 没有数据`);
    }
  }

  // 3. 检查DLTRedMissing模型使用的集合
  console.log('\n=== 检查可能的遗漏值集合 ===');
  const collections = [
    'hit_dlt_basictrendchart_redballmissing_histories',
    'DLTRedMissing',
    'dltredmissings',
    'hit_dlt_redmissings'
  ];

  for (const coll of collections) {
    const count = await db.collection(coll).countDocuments();
    if (count > 0) {
      console.log(`${coll}: ${count} records`);
      const sample = await db.collection(coll).findOne({ Issue: '25140' });
      console.log('  25140期:', sample ? '有' : '无');
    }
  }

  await client.close();
}

diagnose().catch(console.error);
