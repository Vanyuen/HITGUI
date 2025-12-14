const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 完整模拟批次2（25092-25141）的处理
  const batch2 = [];
  for (let i = 25092; i <= 25141; i++) {
    batch2.push(i.toString());
  }
  console.log('批次2期号数:', batch2.length);
  console.log('批次2最后5期:', batch2.slice(-5));

  // 构建issueToIdMap
  const existingRecords = await db.collection('hit_dlts').find({
    Issue: { $in: batch2.map(i => parseInt(i)) }
  }).sort({ ID: 1 }).toArray();

  const issueToIdMap = new Map();
  for (const r of existingRecords) {
    issueToIdMap.set(r.Issue.toString(), r.ID);
  }

  console.log('\nissueToIdMap大小:', issueToIdMap.size);
  console.log('25140的ID:', issueToIdMap.get('25140'));
  console.log('25141的ID:', issueToIdMap.get('25141'));

  // 构建idToRecordMap（这需要包含ID-1的记录）
  const minID = existingRecords[0].ID;
  const maxID = existingRecords[existingRecords.length - 1].ID;

  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  console.log('\nidToRecordMap大小:', idToRecordMap.size);
  console.log('ID 2808:', idToRecordMap.get(2808)?.Issue);
  console.log('ID 2809:', idToRecordMap.get(2809)?.Issue);

  // 构建issueToIDArray
  const issueToIDArray = batch2.map((issue, index) => {
    const id = issueToIdMap.get(issue);
    return { issue, id: id || null, index };
  });

  // 检查25141在issueToIDArray中的位置
  const idx25141 = issueToIDArray.findIndex(x => x.issue === '25141');
  console.log('\n25141在批次2中的index:', idx25141);
  console.log('25141的ID:', issueToIDArray[idx25141].id);

  // 模拟25141的处理
  console.log('\n=== 模拟25141的处理 ===');
  const i = idx25141;
  const targetIssue = '25141';
  const targetID = issueToIDArray[i].id;

  console.log('i:', i);
  console.log('targetIssue:', targetIssue);
  console.log('targetID:', targetID);

  // 由于 i !== 0，使用ID-1规则
  const baseRecord = idToRecordMap.get(targetID - 1);
  console.log('baseRecord (ID-1):', baseRecord ? `Issue=${baseRecord.Issue}, ID=${baseRecord.ID}` : 'null');

  if (baseRecord) {
    const baseIssue = baseRecord.Issue.toString();
    const hwcKey = `${baseIssue}-${targetIssue}`;
    console.log('hwcKey:', hwcKey);

    // 检查HWC数据是否存在
    const hwcCol = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const hwcData = await hwcCol.findOne({
      base_issue: baseIssue,
      target_issue: targetIssue
    });
    console.log('HWC数据存在:', hwcData ? '✅ 是' : '❌ 否');

    if (hwcData && hwcData.hot_warm_cold_data) {
      const ratio311 = hwcData.hot_warm_cold_data['3:1:1'];
      console.log('3:1:1比例组合数:', ratio311 ? ratio311.length : 0);
    }
  }

  // 检查targetData（开奖数据）
  console.log('\n=== 检查开奖数据 ===');
  const targetData = await db.collection('hit_dlts').findOne({ Issue: parseInt(targetIssue) });
  console.log('25141开奖数据存在:', targetData ? '✅ 是' : '❌ 否');
  if (targetData) {
    console.log('Red:', [targetData.Red1, targetData.Red2, targetData.Red3, targetData.Red4, targetData.Red5]);
    console.log('Blue:', [targetData.Blue1, targetData.Blue2]);
  }

  await client.close();
}
check().catch(console.error);
