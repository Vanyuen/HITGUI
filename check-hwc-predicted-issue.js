const mongoose = require('mongoose');

async function simulatePredictedPeriod() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  // 模拟推算期处理
  const targetIssue = '25142';
  const baseIssue = '25141';

  console.log(`\n=== 模拟推算期处理: ${baseIssue} → ${targetIssue} ===\n`);

  // 1. 检查HWC缓存key是否存在
  const hwcKey = `${baseIssue}-${targetIssue}`;
  console.log('1. HWC缓存key:', hwcKey);

  // 查询HWC优化表
  const hwcData = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({ base_issue: baseIssue, target_issue: targetIssue });

  if (hwcData) {
    console.log('   ✅ HWC数据存在于数据库中');
    const ratio311 = hwcData.hot_warm_cold_data?.['3:1:1'];
    console.log(`   3:1:1比例组合数: ${ratio311?.length || 0}`);
  } else {
    console.log('   ❌ HWC数据不存在于数据库中!');
  }

  // 2. 检查遗漏数据
  console.log('\n2. 遗漏数据检查 (baseIssue=' + baseIssue + '):');
  const missingData = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories')
    .findOne({ Issue: baseIssue });

  if (missingData) {
    console.log('   ✅ 遗漏数据存在');
    // 计算热温冷统计
    let hotCount = 0, warmCount = 0, coldCount = 0;
    for (let ball = 1; ball <= 35; ball++) {
      const missing = missingData[String(ball)] || 0;
      if (missing <= 4) hotCount++;
      else if (missing >= 5 && missing <= 9) warmCount++;
      else coldCount++;
    }
    console.log(`   热/温/冷球数: ${hotCount}/${warmCount}/${coldCount}`);
  } else {
    console.log('   ❌ 遗漏数据不存在!');
  }

  // 3. 检查target_issue在数据库中是否存在
  console.log('\n3. 推算期存在性检查:');
  const targetRecord = await mongoose.connection.db.collection('hit_dlts')
    .findOne({ Issue: parseInt(targetIssue) });

  if (targetRecord) {
    console.log('   ⚠️ 期号', targetIssue, '在数据库中存在 (这是已开奖期号，不是推算期)');
  } else {
    console.log('   ✅ 期号', targetIssue, '不在数据库中 (这是推算期)');
  }

  // 4. 检查preloadData会生成什么期号对
  console.log('\n4. preloadData会生成的期号对:');

  // 假设目标期号列表是 [25141, 25142]
  const targetIssues = [25141, 25142];
  console.log('   输入期号列表:', targetIssues);

  // 查询存在于数据库中的期号
  const existingRecords = await mongoose.connection.db.collection('hit_dlts')
    .find({ Issue: { $in: targetIssues } })
    .toArray();

  console.log('   数据库中存在的期号:', existingRecords.map(r => r.Issue));
  console.log('   推算期(不存在):', targetIssues.filter(i => !existingRecords.find(r => r.Issue === i)));

  // 模拟issueRecords过滤
  const issueRecords = existingRecords.filter(r => targetIssues.includes(r.Issue));
  console.log('   issueRecords过滤结果:', issueRecords.map(r => r.Issue));
  console.log('   ⚠️ 推算期25142不会被加入issueRecords，所以不会预加载HWC缓存!');

  await mongoose.disconnect();
}
simulatePredictedPeriod().catch(console.error);
