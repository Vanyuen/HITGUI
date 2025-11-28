const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));
    const DLT = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    // 1. 检查任务
    const task = await Task.findOne().lean();
    console.log('=== 热温冷批量预测任务 ===');
    console.log('任务ID:', task._id);
    console.log('任务名称:', task.task_name);
    console.log('状态:', task.status);
    console.log('创建时间:', task.created_at);
    console.log('基准期号:', task.base_issue);
    console.log('目标期号列表:', task.target_issues);
    console.log('排除条件:', JSON.stringify(task.exclusion_conditions, null, 2));

    // 2. 检查结果
    const results = await Result.find({ task_id: task._id }).sort({ period: 1 }).lean();
    console.log('\n=== 任务结果 ===');
    console.log('总结果数:', results.length);

    console.log('\n前10个结果详情:');
    for (let i = 0; i < Math.min(10, results.length); i++) {
      const r = results[i];
      console.log(`\n${i + 1}. 期号: ${r.period}`);
      console.log('   保留组合数:', r.retained_count);
      console.log('   排除组合数:', r.excluded_count);
      console.log('   红球最高命中:', r.max_red_hit);
      console.log('   蓝球最高命中:', r.max_blue_hit);
      console.log('   一等奖数:', r.first_prize_count);
      console.log('   命中率:', r.hit_rate);
      console.log('   总奖金:', r.total_prize);

      // 检查是否有开奖数据
      const dltData = await DLT.findOne({ Issue: r.period }).lean();
      console.log('   数据库中有此期:', !!dltData);
      if (dltData) {
        console.log('   Red字段:', dltData.Red);
        console.log('   Blue字段:', dltData.Blue);
        console.log('   所有字段:', Object.keys(dltData));
      }
    }

    // 3. 检查25124期的详细数据
    console.log('\n=== 25124期详细检查 ===');
    const issue25124 = await DLT.findOne({ Issue: '25124' }).lean();
    if (issue25124) {
      console.log('完整数据:', JSON.stringify(issue25124, null, 2));
    }

    // 4. 统计0值结果
    const zeroResults = results.filter(r =>
      r.retained_count === 0 &&
      r.max_red_hit === 0 &&
      r.max_blue_hit === 0 &&
      r.first_prize_count === 0
    );
    console.log('\n=== 统计 ===');
    console.log(`全为0的结果: ${zeroResults.length} / ${results.length}`);

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
