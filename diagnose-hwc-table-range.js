// 诊断：检查推算期的HWC优化表状态

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  console.log('=== 诊断推算期HWC优化表 ===\n');

  const db = mongoose.connection.db;

  // 1. 获取期号25140的上一期
  const dlt25140 = await db.collection('hit_dlts').findOne({ Issue: 25140 });
  console.log('期号25140在数据库中:', dlt25140 ? '存在(已开奖)' : '不存在(推算期)');

  // 2. 检查25139的数据
  const dlt25139 = await db.collection('hit_dlts').findOne({ Issue: 25139 });
  console.log('期号25139在数据库中:', dlt25139 ? `存在 (ID=${dlt25139.ID})` : '不存在');

  // 3. 查找最新开奖期号
  const latestIssue = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(1)
    .toArray();
  console.log('\n最新开奖期号:', latestIssue[0]?.Issue, '(ID:', latestIssue[0]?.ID + ')');

  // 4. 检查HWC优化表中是否有推算期的数据
  console.log('\n=== 检查HWC优化表 ===');

  // 检查target_issue=25140的数据
  const hwc25140 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({ target_issue: '25140' });
  console.log('target_issue=25140:', hwc25140 ? '存在' : '不存在');

  // 检查最新的几条HWC记录
  const latestHwc = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .find({})
    .sort({ target_id: -1 })
    .limit(3)
    .toArray();

  console.log('\n最新3条HWC记录:');
  for (const h of latestHwc) {
    console.log(`  base_issue=${h.base_issue} -> target_issue=${h.target_issue} (target_id=${h.target_id})`);
  }

  // 5. 检查HWC优化表的target_id范围
  const minMax = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').aggregate([
    {
      $group: {
        _id: null,
        minTargetId: { $min: '$target_id' },
        maxTargetId: { $max: '$target_id' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  console.log('\nHWC优化表统计:');
  console.log('  总记录数:', minMax[0]?.count);
  console.log('  target_id范围:', minMax[0]?.minTargetId, '-', minMax[0]?.maxTargetId);

  // 6. 检查期号25027-25140对应的ID范围
  console.log('\n=== 检查期号ID映射 ===');
  const issue25027 = await db.collection('hit_dlts').findOne({ Issue: 25027 });
  const issue25139actual = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(1)
    .toArray();

  console.log('期号25027 ID:', issue25027?.ID);
  console.log('最新期号', issue25139actual[0]?.Issue, 'ID:', issue25139actual[0]?.ID);

  // 7. 检查HWC表中有多少期号在25027-25139范围内
  const hwcInRange = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .find({ target_id: { $gte: issue25027?.ID, $lte: issue25139actual[0]?.ID } })
    .count();
  console.log('\nHWC表中期号范围内记录数:', hwcInRange);

  mongoose.disconnect();
});
