const mongoose = require('mongoose');

async function simulatePreloadRange() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  // 模拟任务1的targetIssues（字符串数组转数字）
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  console.log('=== 模拟preloadData数据加载范围 ===');
  console.log('targetIssues长度:', targetIssues.length);

  // 1. 查询目标期号记录
  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  console.log('targetRecords长度:', targetRecords.length);
  console.log('targetRecords[0]:', targetRecords[0]);
  console.log('targetRecords[最后]:', targetRecords[targetRecords.length - 1]);

  // 2. 计算ID范围
  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log('\nID范围: minID=' + minID + ', maxID=' + maxID);

  // 3. 加载allRecords
  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  console.log('allRecords长度:', allRecords.length);
  console.log('allRecords ID范围:', allRecords[0].ID, '-', allRecords[allRecords.length - 1].ID);

  // 4. 构建idToRecordMap
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  console.log('idToRecordMap大小:', idToRecordMap.size);

  // 5. 检查关键期号的ID-1是否在map中
  const criticalIssues = [25091, 25141, 25142];
  console.log('\n=== 检查关键期号的ID-1 ===');

  for (const issue of criticalIssues) {
    const record = await DLT.findOne({ Issue: issue }).lean();
    if (!record) {
      console.log(`${issue}期: 不在数据库中(推算期)`);
      continue;
    }

    const targetID = record.ID;
    const baseRecord = idToRecordMap.get(targetID - 1);

    console.log(`${issue}期: targetID=${targetID}, ID-1=${targetID - 1}, baseRecord存在=${!!baseRecord}`);
    if (baseRecord) {
      console.log(`  baseRecord.Issue=${baseRecord.Issue}`);
    }
  }

  // 6. 检查issueRecords（用于生成issuePairs）
  const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
  console.log('\nissueRecords长度:', issueRecords.length);
  console.log('issueRecords最后几期:', issueRecords.slice(-3).map(r => r.Issue));

  // 7. 检查25091和25141是否在issueRecords中
  const has25091 = issueRecords.some(r => r.Issue === 25091);
  const has25141 = issueRecords.some(r => r.Issue === 25141);
  console.log('issueRecords包含25091:', has25091);
  console.log('issueRecords包含25141:', has25141);

  await mongoose.disconnect();
}

simulatePreloadRange().catch(e => { console.error(e); process.exit(1); });
