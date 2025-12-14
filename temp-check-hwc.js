const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const hitDlts = mongoose.connection.db.collection('hit_dlts');
  const hwcCol = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

  console.log('========== 主表 (hit_dlts) ==========');
  const firstDLT = await hitDlts.findOne({}, { sort: { ID: 1 } });
  console.log('第一条记录: ID=' + firstDLT?.ID + ', Issue=' + firstDLT?.Issue);

  const lastDLT = await hitDlts.findOne({}, { sort: { ID: -1 } });
  console.log('最后一条: ID=' + lastDLT?.ID + ', Issue=' + lastDLT?.Issue);

  const dltCount = await hitDlts.countDocuments();
  console.log('总记录数:', dltCount);

  console.log('\n========== HWC表 ==========');
  const sampleHWC = await hwcCol.findOne({});
  const fields = Object.keys(sampleHWC || {}).filter(k => !k.startsWith('_'));
  console.log('现有字段:', fields.join(', '));
  console.log('是否有 target_id 字段:', sampleHWC?.target_id !== undefined ? '有' : '无');
  console.log('是否有 base_id 字段:', sampleHWC?.base_id !== undefined ? '有' : '无');

  const firstHWC = await hwcCol.findOne({}, { sort: { created_at: 1 } });
  console.log('\n第一条HWC记录:');
  console.log('  base_issue:', firstHWC?.base_issue);
  console.log('  target_issue:', firstHWC?.target_issue);
  console.log('  target_id:', firstHWC?.target_id);
  console.log('  is_drawn:', firstHWC?.hit_analysis?.is_drawn);

  const lastHWC = await hwcCol.findOne({}, { sort: { created_at: -1 } });
  console.log('\n最后一条HWC记录:');
  console.log('  base_issue:', lastHWC?.base_issue);
  console.log('  target_issue:', lastHWC?.target_issue);
  console.log('  target_id:', lastHWC?.target_id);
  console.log('  is_drawn:', lastHWC?.hit_analysis?.is_drawn);

  const hwcCount = await hwcCol.countDocuments();
  console.log('\nHWC总记录数:', hwcCount);

  const hwc7001 = await hwcCol.findOne({ target_issue: '7001' });
  console.log('\ntarget_issue=7001 的记录:', hwc7001 ? '存在' : '不存在');

  const hwc7002 = await hwcCol.findOne({ target_issue: '7002' });
  console.log('target_issue=7002 的记录:', hwc7002 ? '存在 (base=' + hwc7002.base_issue + ')' : '不存在');

  mongoose.disconnect();
}).catch(err => console.error(err));
