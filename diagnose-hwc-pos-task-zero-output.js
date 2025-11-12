const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 1. 检查任务配置 ===');
  const task = await db.collection('PredictionTask').findOne({ task_id: 'hwc-pos-20251105-yw1' });
  if (!task) {
    console.log('❌ 任务不存在！');
    await client.close();
    return;
  }

  console.log('任务名称:', task.task_name);
  console.log('期号范围:', task.base_issue, '-', task.target_issue);
  console.log('任务状态:', task.status);
  console.log('配对模式:', task.pairing_mode);
  console.log('正选条件:', JSON.stringify(task.positive_conditions || {}, null, 2));
  console.log('排除条件:', JSON.stringify(task.exclusion_conditions || {}, null, 2));

  console.log('\n=== 2. 检查期号数据 ===');
  const issues = task.issue_pairs?.map(p => p.target_issue) || [];
  console.log('任务包含期号数:', issues.length);
  console.log('前5期:', issues.slice(0, 5));

  console.log('\n=== 3. 检查开奖数据 ===');
  const issue25074 = await db.collection('HIT_DLT').findOne({ Issue: '25074' });
  const issue25075 = await db.collection('HIT_DLT').findOne({ Issue: '25075' });
  const issue25076 = await db.collection('HIT_DLT').findOne({ Issue: '25076' });

  console.log('期号25074:', issue25074 ?
    `存在 - 红球: ${issue25074.Red || issue25074.red}, 蓝球: ${issue25074.Blue || issue25074.blue}` :
    '❌ 不存在');
  console.log('期号25075:', issue25075 ?
    `存在 - 红球: ${issue25075.Red || issue25075.red}, 蓝球: ${issue25075.Blue || issue25075.blue}` :
    '❌ 不存在');
  console.log('期号25076:', issue25076 ?
    `存在 - 红球: ${issue25076.Red || issue25076.red}, 蓝球: ${issue25076.Blue || issue25076.blue}` :
    '❌ 不存在');

  console.log('\n=== 4. 检查任务结果数据 ===');
  const results = await db.collection('PredictionTaskResult')
    .find({ task_id: 'hwc-pos-20251105-yw1' })
    .sort({ target_issue: 1 })
    .limit(5)
    .toArray();

  console.log('结果记录数:', results.length);
  if (results.length > 0) {
    results.forEach((r, idx) => {
      console.log(`\n--- 结果 ${idx + 1} (期号 ${r.target_issue}) ---`);
      console.log('  retained_count:', r.retained_count);
      console.log('  红球最高命中:', r.max_red_hit);
      console.log('  蓝球最高命中:', r.max_blue_hit);
      console.log('  hit_stats存在:', !!r.hit_stats);
      if (r.hit_stats) {
        console.log('  hit_stats.total_combinations:', r.hit_stats.total_combinations);
        console.log('  hit_stats.total_prize:', r.hit_stats.total_prize);
        console.log('  hit_stats.hit_count:', r.hit_stats.hit_count);
      }
      console.log('  winning_numbers存在:', !!r.winning_numbers);
      if (r.winning_numbers) {
        console.log('  winning_numbers.red:', r.winning_numbers.red);
        console.log('  winning_numbers.blue:', r.winning_numbers.blue);
      }
    });
  }

  console.log('\n=== 5. 检查retained组合样本 ===');
  const sampleRetained = await db.collection('PredictionTaskResult')
    .findOne(
      {
        task_id: 'hwc-pos-20251105-yw1',
        target_issue: '25074'
      },
      { projection: { retained_combinations: { $slice: 2 } } }
    );

  if (sampleRetained && sampleRetained.retained_combinations) {
    console.log('期号25074的retained组合样本 (前2个):');
    sampleRetained.retained_combinations.forEach((combo, idx) => {
      console.log(`\n组合 ${idx + 1}:`);
      console.log('  红球:', combo.red_balls || combo.red);
      console.log('  蓝球:', combo.blue_balls || combo.blue);
      console.log('  红球命中:', combo.red_hit);
      console.log('  蓝球命中:', combo.blue_hit);
      console.log('  中奖等级:', combo.prize_level);
      console.log('  中奖金额:', combo.prize_amount);
    });
  }

  await client.close();
})();
