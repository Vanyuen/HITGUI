const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 检查ID和Issue的映射关系
  console.log('=== 检查ID-Issue映射 ===');
  const records = await db.collection('hit_dlts')
    .find({ Issue: { $gte: 25138, $lte: 25142 } })
    .sort({ ID: 1 })
    .toArray();

  console.log('期号范围内的记录:');
  records.forEach(r => {
    console.log(`  ID: ${r.ID}, Issue: ${r.Issue}`);
  });

  // 2. 检查最新期号和下一期推算
  const latestRecord = await db.collection('hit_dlts')
    .findOne({}, { sort: { ID: -1 } });
  console.log('\n最新记录:');
  console.log(`  ID: ${latestRecord.ID}, Issue: ${latestRecord.Issue}`);
  console.log(`  推算下一期: ${latestRecord.Issue + 1} (期号), ID: ${latestRecord.ID + 1}`);

  // 3. 检查期号对: 要预测25141期，需要用25140期的遗漏数据
  console.log('\n=== 期号对关系 ===');
  console.log('预测目标25140: 基准期=25139的遗漏数据');
  console.log('预测目标25141: 基准期=25140的遗漏数据');
  console.log('预测目标25142: 基准期=25141的遗漏数据');

  // 4. 检查实际遗漏数据
  const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

  for (const issue of ['25139', '25140', '25141']) {
    const missing = await missingColl.findOne({ Issue: issue });
    if (missing) {
      // 计算一个示例球号的热温冷分类
      const sample1 = missing['1'] || 0;
      const sample10 = missing['10'] || 0;
      const sample20 = missing['20'] || 0;
      const sample35 = missing['35'] || 0;
      console.log(`\n${issue}期遗漏数据样本:`);
      console.log(`  球1遗漏=${sample1} (${sample1 <= 4 ? '热' : sample1 <= 9 ? '温' : '冷'})`);
      console.log(`  球10遗漏=${sample10} (${sample10 <= 4 ? '热' : sample10 <= 9 ? '温' : '冷'})`);
      console.log(`  球20遗漏=${sample20} (${sample20 <= 4 ? '热' : sample20 <= 9 ? '温' : '冷'})`);
      console.log(`  球35遗漏=${sample35} (${sample35 <= 4 ? '热' : sample35 <= 9 ? '温' : '冷'})`);
    } else {
      console.log(`${issue}期: ❌ 没有遗漏数据`);
    }
  }

  await client.close();
}

diagnose().catch(console.error);
