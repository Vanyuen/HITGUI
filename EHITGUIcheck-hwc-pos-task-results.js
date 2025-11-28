const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({task_id: 'hwc-pos-20251120-f4e'})
    .toArray();
  
  console.log('任务结果统计:');
  console.log('总期号数:', results.length);
  console.log('');
  
  const stats = results.map(r => ({
    period: r.period,
    is_predicted: r.is_predicted,
    red_count: r.red_combinations?.length || 0,
    blue_count: r.blue_combinations?.length || 0,
    paired_count: r.paired_combinations?.length || 0,
    combination_count: r.combination_count || 0
  }));
  
  stats.sort((a, b) => a.period - b.period);
  
  console.log('前30个期号的组合数统计:');
  stats.slice(0, 30).forEach(s => {
    const pred = s.is_predicted ? '(推算)' : '';
    console.log('  期号', s.period, pred, ': 红球=', s.red_count, ', 蓝球=', s.blue_count, ', 配对=', s.paired_count);
  });
  
  const zeroRedCount = stats.filter(s => s.red_count === 0).length;
  const zeroPairedCount = stats.filter(s => s.paired_count === 0).length;
  
  console.log('\n零组合统计:');
  console.log('  红球组合为0的期号数:', zeroRedCount);
  console.log('  配对组合为0的期号数:', zeroPairedCount);
  
  if (zeroRedCount > 0) {
    console.log('\n红球组合为0的期号:');
    stats.filter(s => s.red_count === 0).slice(0, 10).forEach(s => {
      console.log('  ', s.period, s.is_predicted ? '(推算)' : '');
    });
  }
  
  await mongoose.connection.close();
}).catch(console.error);
