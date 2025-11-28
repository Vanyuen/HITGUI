const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' }));
    const Result = mongoose.model('PredictionTaskResult', new mongoose.Schema({}, { strict: false, collection: 'PredictionTaskResult' }));
    const DLT = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    // 查找所有任务并按时间排序
    const allTasks = await Task.find({}).sort({ created_at: -1 }).limit(10).lean();

    console.log('=== 最近10个任务 ===');
    allTasks.forEach((task, idx) => {
      console.log(`${idx + 1}. [${task.status}] ${task.task_name}`);
      console.log(`   ID: ${task._id}`);
      console.log(`   创建时间: ${task.created_at}`);
    });

    // 查找有结果的任务
    const resultsGrouped = await Result.aggregate([
      { $group: { _id: '$task_id', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 5 }
    ]);

    console.log('\n=== 有结果的任务 ===');
    for (const group of resultsGrouped) {
      const task = await Task.findById(group._id).lean();
      console.log(`\n任务: ${task?.task_name || '未知'}`);
      console.log(`任务ID: ${group._id}`);
      console.log(`结果数量: ${group.count}`);

      const results = await Result.find({ task_id: group._id }).sort({ period: 1 }).limit(5).lean();

      console.log('前5个结果:');
      for (const r of results) {
        // 检查是否有开奖数据
        const dltData = await DLT.findOne({ Issue: r.period }).lean();
        console.log(`  期号: ${r.period}`);
        console.log(`    保留组合数: ${r.retained_count}`);
        console.log(`    红球命中: ${r.max_red_hit}, 蓝球命中: ${r.max_blue_hit}`);
        console.log(`    一等奖: ${r.first_prize_count}, 命中率: ${r.hit_rate}, 总奖金: ${r.total_prize}`);
        console.log(`    有开奖数据: ${!!dltData}`);
        if (dltData) {
          console.log(`    开奖号码: 红球 ${dltData.Red}, 蓝球 ${dltData.Blue}`);
        }
      }

      // 统计0值情况
      const allResults = await Result.find({ task_id: group._id }).lean();
      const zeroCount = allResults.filter(r =>
        r.retained_count === 0 && r.max_red_hit === 0 && r.max_blue_hit === 0
      ).length;
      console.log(`  全为0的结果: ${zeroCount} / ${allResults.length}`);
    }

    // 检查最新的大乐透数据
    const latestDLT = await DLT.findOne().sort({ Issue: -1 }).lean();
    console.log('\n=== 最新大乐透数据 ===');
    console.log('最新期号:', latestDLT?.Issue);
    console.log('开奖号码: 红球', latestDLT?.Red, '蓝球', latestDLT?.Blue);

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
