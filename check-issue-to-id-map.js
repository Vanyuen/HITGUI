const mongoose = require('mongoose');

async function simulateIssueToIdMap() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  // 模拟任务1的处理流程
  console.log('=== 模拟issueToIdMap构建 ===');

  // 1. 模拟targetIssues
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  // 2. 模拟preloadData中的数据加载
  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;

  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  // 3. 构建issueToIdMap（关键！）
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }

  console.log('issueToIdMap大小:', issueToIdMap.size);

  // 4. 模拟批次2的issuesBatch (25092-25141)
  const batch2Issues = [];
  for (let i = 25092; i <= 25141; i++) {
    batch2Issues.push(i.toString());
  }

  console.log('\n=== 模拟批次2的issueToIDArray构建 ===');
  console.log('批次2期号数:', batch2Issues.length);

  // 5. 模拟processBatch中的issueToIDArray构建
  const issueToIDArray = batch2Issues.map((issue, index) => {
    const issueStr = issue.toString();
    const id = issueToIdMap.get(issueStr);
    if (!id) {
      console.log(`⚠️ Issue ${issueStr} 没有对应的ID`);
    }
    return { issue: issueStr, id: id || null, index };
  });

  // 6. 检查批次2最后几期
  console.log('\n批次2最后5期的issueToIDArray:');
  const last5 = issueToIDArray.slice(-5);
  for (const item of last5) {
    console.log(`  期号${item.issue}: id=${item.id}, index=${item.index}`);
  }

  // 7. 检查关键问题：25091在issueToIdMap中吗？
  console.log('\n=== 关键期号在issueToIdMap中的查找 ===');
  const criticalIssues = ['25090', '25091', '25140', '25141', '25142'];
  for (const issue of criticalIssues) {
    const id = issueToIdMap.get(issue);
    console.log(`${issue}期: id=${id || 'null'}`);
  }

  await mongoose.disconnect();
}

simulateIssueToIdMap().catch(e => { console.error(e); process.exit(1); });
