const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 完整模拟preloadHwcOptimizedData流程
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i);
  }

  // 1. 查询数据库中存在的期号
  const existingRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  console.log('存在的期号数:', existingRecords.length);
  console.log('最后3期:', existingRecords.slice(-3).map(r => `Issue=${r.Issue}, ID=${r.ID}`));

  const minID = existingRecords[0].ID;
  const maxID = existingRecords[existingRecords.length - 1].ID;
  console.log(`\nID范围: ${minID} - ${maxID}`);

  // 2. 查询完整ID范围（包含minID-1）
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  // 3. 生成issuePairs（关键步骤）
  const issueRecords = allRecords.filter(r => targetIssues.includes(r.Issue));
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

  console.log('\n生成的issuePairs数量:', issuePairs.length);

  // 检查25140-25141是否在issuePairs中
  const has25140_25141 = issuePairs.some(p => p.base_issue === '25140' && p.target_issue === '25141');
  console.log('25140→25141 在 issuePairs:', has25140_25141 ? '✅ 是' : '❌ 否');

  // 检查25141是否是target_issue
  const pairs25141 = issuePairs.filter(p => p.target_issue === '25141');
  console.log('target_issue=25141的pairs:', pairs25141);

  // 4. 模拟hwcOptimizedCache查询
  const hwcCol = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

  const query = {
    $or: issuePairs.map(p => ({
      base_issue: p.base_issue,
      target_issue: p.target_issue
    }))
  };

  const hwcDataList = await hwcCol.find(query).toArray();
  console.log('\nHWC查询结果数量:', hwcDataList.length);

  // 5. 构建hwcOptimizedCache
  const hwcOptimizedCache = new Map();
  for (const data of hwcDataList) {
    const key = `${data.base_issue}-${data.target_issue}`;
    if (data.hot_warm_cold_data) {
      const hwcMap = new Map();
      for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
        hwcMap.set(ratio, ids);
      }
      hwcOptimizedCache.set(key, hwcMap);
    }
  }

  console.log('hwcOptimizedCache大小:', hwcOptimizedCache.size);

  // 6. 检查关键的期号对
  console.log('\n=== 关键期号对在缓存中的状态 ===');
  for (const key of ['25139-25140', '25140-25141', '25141-25142']) {
    const hwcMap = hwcOptimizedCache.get(key);
    if (hwcMap) {
      const ratio311 = hwcMap.get('3:1:1');
      console.log(`${key}: ✅ 在缓存中, 3:1:1有${ratio311 ? ratio311.length : 0}个组合`);
    } else {
      console.log(`${key}: ❌ 不在缓存中`);
    }
  }

  // 7. 验证问题：为什么25140-25141可能不在缓存中
  console.log('\n=== 问题验证 ===');

  // 检查25141的ID
  const record25141 = existingRecords.find(r => r.Issue === 25141);
  console.log('25141的记录:', record25141 ? `Issue=${record25141.Issue}, ID=${record25141.ID}` : '不存在');

  if (record25141) {
    // 检查25141是否在targetIssues中
    console.log('25141在targetIssues中:', targetIssues.includes(25141) ? '✅ 是' : '❌ 否');

    // 检查25141是否在issueRecords中
    const in_issueRecords = issueRecords.some(r => r.Issue === 25141);
    console.log('25141在issueRecords中:', in_issueRecords ? '✅ 是' : '❌ 否');

    // 检查ID-1是否存在
    const baseRecord = idToRecordMap.get(record25141.ID - 1);
    console.log(`ID-1 (${record25141.ID - 1})的记录:`, baseRecord ? `Issue=${baseRecord.Issue}` : '不存在');
  }

  await client.close();
}
check().catch(console.error);
