const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 检查几个关键期号对
  console.log('=== 检查关键期号对 ===');
  const testPairs = [
    { base: '25026', target: '25027' },
    { base: '25027', target: '25028' },
    { base: '25109', target: '25110' },
    { base: '25138', target: '25139' },
    { base: '25139', target: '25140' }
  ];

  for (const pair of testPairs) {
    const hwc = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
      base_issue: pair.base,
      target_issue: pair.target
    });

    if (hwc) {
      const count = hwc.hot_warm_cold_data?.['4:1:0']?.length || 0;
      console.log(pair.base + '->' + pair.target + ': 存在, 4:1:0=' + count);
    } else {
      console.log(pair.base + '->' + pair.target + ': 不存在！');
    }
  }

  // 检查HWC优化表的target_id范围
  console.log('\n=== 检查target_id范围 ===');
  const firstRecord = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({}, { sort: { target_id: 1 }, projection: { base_issue: 1, target_issue: 1, target_id: 1 } });
  const lastRecord = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({}, { sort: { target_id: -1 }, projection: { base_issue: 1, target_issue: 1, target_id: 1 } });

  console.log('最早记录:', firstRecord?.base_issue + '->' + firstRecord?.target_issue, 'target_id=' + firstRecord?.target_id);
  console.log('最新记录:', lastRecord?.base_issue + '->' + lastRecord?.target_issue, 'target_id=' + lastRecord?.target_id);

  // 检查hit_dlts表中25027对应的ID
  console.log('\n=== 检查hit_dlts表 ===');
  const issue25027 = await db.collection('hit_dlts').findOne({ Issue: 25027 });
  const issue25110 = await db.collection('hit_dlts').findOne({ Issue: 25110 });
  const issue25139 = await db.collection('hit_dlts').findOne({ Issue: 25139 });

  console.log('Issue 25027 -> ID:', issue25027?.ID);
  console.log('Issue 25110 -> ID:', issue25110?.ID);
  console.log('Issue 25139 -> ID:', issue25139?.ID);

  mongoose.disconnect();
});
