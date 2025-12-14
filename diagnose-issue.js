const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 检查hit_dlts中的最新几期
  const latestIssues = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(5)
    .toArray();

  console.log('=== hit_dlts最新5期 ===');
  for (const i of latestIssues) {
    console.log('Issue:', i.Issue, '| ID:', i.ID);
  }

  // 检查25042-25142范围
  const count = await db.collection('hit_dlts').countDocuments({
    Issue: { $gte: 25042, $lte: 25142 }
  });
  console.log('\n25042-25142范围内期号数:', count);

  // 检查HWC表
  console.log('\n=== HWC表检查 ===');
  const hwcCol = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

  for (const pair of ['25139-25140', '25140-25141', '25141-25142']) {
    const [base, target] = pair.split('-');
    const hwc = await hwcCol.findOne({
      base_issue: base,
      target_issue: target
    });
    console.log(pair + ':', hwc ? '✅ 有数据, 3:1:1组合数=' + (hwc.hot_warm_cold_data?.['3:1:1']?.length || 0) : '❌ 无数据');
  }

  // 关键检查：preloadData中生成的issuePairs
  // 任务范围25042-25142（101期），但数据库只有100期（25042-25141）
  // 所以issueRecords只有100期，生成的issuePairs是：
  // 25041->25042, 25042->25043, ..., 25140->25141（共100对）
  // 注意：25141->25142不会被生成！因为25142不在数据库中

  console.log('\n=== 模拟preloadData期号对生成 ===');

  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i);
  }
  console.log('targetIssues数量:', targetIssues.length);

  // 查询数据库中存在的期号
  const existingRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  console.log('数据库中存在的期号数:', existingRecords.length);
  console.log('最后3期:', existingRecords.slice(-3).map(r => r.Issue));

  // 模拟期号对生成
  const minID = existingRecords[0].ID;
  const maxID = existingRecords[existingRecords.length - 1].ID;

  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  const issueRecords = allRecords.filter(r => targetIssues.includes(r.Issue));

  console.log('\nissueRecords数量:', issueRecords.length);

  // 生成期号对
  const issuePairs = [];
  for (const record of issueRecords) {
    const baseRecord = idToRecordMap.get(record.ID - 1);
    if (baseRecord) {
      issuePairs.push({
        base_issue: baseRecord.Issue.toString(),
        target_issue: record.Issue.toString()
      });
    }
  }

  console.log('生成的issuePairs数量:', issuePairs.length);
  console.log('最后3对:', issuePairs.slice(-3));

  // 检查25141是否在issuePairs中
  const pair25141 = issuePairs.find(p => p.target_issue === '25141');
  console.log('\n25140->25141在issuePairs中:', pair25141 ? '✅ 是' : '❌ 否');

  // 检查25142是否在issuePairs中
  const pair25142 = issuePairs.find(p => p.target_issue === '25142');
  console.log('25141->25142在issuePairs中:', pair25142 ? '✅ 是' : '❌ 否');

  await client.close();
}
check().catch(console.error);
