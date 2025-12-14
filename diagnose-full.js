const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 完整模拟preloadHwcOptimizedData的查询
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i);
  }

  // 1. 查询数据库中存在的期号
  const existingRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  const minID = existingRecords[0].ID;
  const maxID = existingRecords[existingRecords.length - 1].ID;

  // 2. 查询完整ID范围
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  // 3. 生成issuePairs（这是preloadHwcOptimizedData的输入）
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

  console.log('生成的issuePairs数量:', issuePairs.length);
  console.log('包含25141:', issuePairs.some(p => p.target_issue === '25141'));

  // 4. 模拟preloadHwcOptimizedData查询
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
  console.log('\n=== 关键期号对检查 ===');
  for (const key of ['25139-25140', '25140-25141', '25141-25142']) {
    const hwcMap = hwcOptimizedCache.get(key);
    console.log(key + ':', hwcMap ? '✅ 在缓存中' : '❌ 不在缓存中');
  }

  // 7. 模拟批次划分（batchSize=50）
  console.log('\n=== 批次划分 ===');
  const batchSize = 50;
  const allIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    allIssues.push(i.toString());
  }

  const batches = [];
  for (let i = 0; i < allIssues.length; i += batchSize) {
    batches.push(allIssues.slice(i, i + batchSize));
  }

  console.log('批次数:', batches.length);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`批次${i + 1}: ${batch[0]} - ${batch[batch.length - 1]} (${batch.length}期)`);
  }

  // 8. 检查最后一个批次的处理
  console.log('\n=== 检查最后批次（批次3） ===');
  const lastBatch = batches[batches.length - 1];
  console.log('最后批次内容:', lastBatch);

  // 在processBatch中，对于批次3的第一个期号（25142）：
  // - i === 0，所以使用 firstIssuePreviousRecord
  // - 但 firstIssuePreviousRecord 是针对整个任务的第一个期号（25042）设置的
  // - 对于25142，它应该使用25141作为baseIssue

  // 实际情况：
  // 批次3只有一个期号 25142
  // 当 i === 0 时，代码会使用 firstIssuePreviousRecord
  // 但 firstIssuePreviousRecord 的值是 25041（整个任务的第一个期号25042的上一期）
  // 所以 hwcKey = "25041-25142"，这个key不存在于hwcOptimizedCache中！

  console.log('\n⚠️ 问题分析:');
  console.log('批次3的第一个期号是25142（也是唯一一个）');
  console.log('当i===0时，代码使用firstIssuePreviousRecord');
  console.log('firstIssuePreviousRecord是针对整个任务第一期（25042）的上一期');
  console.log('所以25142会错误地使用25041作为baseIssue');
  console.log('hwcKey = "25041-25142"，但这个key不在hwcOptimizedCache中');

  // 但等等，25141的问题呢？
  // 25141在批次2中，而且不是批次2的第一个期号
  // 让我检查批次2
  console.log('\n=== 检查批次2 ===');
  const batch2 = batches[1];
  console.log('批次2范围:', batch2[0], '-', batch2[batch2.length - 1]);
  console.log('批次2包含25141:', batch2.includes('25141'));

  // 25141是批次2的最后一个期号
  // 对于25141（非第一个期号），代码使用ID-1规则
  // targetID = 2809, targetID - 1 = 2808
  // idToRecordMap.get(2808) = 25140期
  // 所以 hwcKey = "25140-25141"，这个应该存在于hwcOptimizedCache中

  console.log('\n检查25140-25141在hwcOptimizedCache中:', hwcOptimizedCache.has('25140-25141'));

  await client.close();
}
check().catch(console.error);
