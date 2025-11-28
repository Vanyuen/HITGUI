/**
 * 检查热温冷正选批量预测任务 BUG
 * 任务ID: hwc-pos-20251124-yem
 * 问题: 只有推算期数据，缺少历史期的预测结果
 */

const mongoose = require('mongoose');

async function checkHwcPosTask() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 已连接到 MongoDB');

    // 查询任务基本信息
    const PredictionTask = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' }));

    const task = await PredictionTask.findOne({
      task_id: 'hwc-pos-20251124-yem'
    }).lean();

    if (!task) {
      console.log('❌ 未找到任务');
      return;
    }

    console.log('\n========================================');
    console.log('📋 任务基本信息');
    console.log('========================================');
    console.log('任务ID:', task.task_id);
    console.log('任务名称:', task.task_name);
    console.log('状态:', task.status);
    console.log('创建时间:', task.created_at);
    console.log('完成时间:', task.completed_at);
    console.log('错误信息:', task.error);

    console.log('\n========================================');
    console.log('📊 期号范围配置');
    console.log('========================================');
    console.log('range_type:', task.range_type);
    console.log('recent_count:', task.recent_count);
    console.log('start_issue:', task.start_issue);
    console.log('end_issue:', task.end_issue);
    console.log('predicted_issue:', task.predicted_issue);

    console.log('\n========================================');
    console.log('🎯 期号数组 (issues)');
    console.log('========================================');
    if (task.issues && task.issues.length > 0) {
      console.log('期号数量:', task.issues.length);
      console.log('期号列表:', task.issues);
      console.log('第一期:', task.issues[0]);
      console.log('最后一期:', task.issues[task.issues.length - 1]);
    } else {
      console.log('❌ 期号数组为空或不存在');
    }

    console.log('\n========================================');
    console.log('🔧 排除条件 (exclusion_conditions)');
    console.log('========================================');
    console.log(JSON.stringify(task.exclusion_conditions, null, 2));

    // 查询任务结果
    const PredictionTaskResult = mongoose.model('PredictionTaskResult', new mongoose.Schema({}, { strict: false, collection: 'PredictionTaskResult' }));

    const results = await PredictionTaskResult.find({
      task_id: 'hwc-pos-20251124-yem'
    }).sort({ base_issue: 1 }).lean();

    console.log('\n========================================');
    console.log('📈 任务结果统计');
    console.log('========================================');
    console.log('结果记录数:', results.length);

    if (results.length > 0) {
      console.log('\n各期结果详情:');
      results.forEach((result, index) => {
        console.log(`\n期号 #${index + 1}:`);
        console.log('  base_issue:', result.base_issue);
        console.log('  predicted_issue:', result.predicted_issue);
        console.log('  retained_count:', result.retained_count);
        console.log('  excluded_count:', result.excluded_count);
        console.log('  has_red_hit_stats:', !!result.red_hit_stats);
        console.log('  has_blue_hit_stats:', !!result.blue_hit_stats);
        console.log('  has_prize_stats:', !!result.prize_stats);
        console.log('  has_winning_numbers:', !!result.winning_numbers);
      });
    } else {
      console.log('❌ 没有找到任务结果记录');
    }

    // 检查数据库中的实际历史期号
    const HitDlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    const latestIssues = await HitDlts.find({})
      .sort({ Issue: -1 })
      .limit(15)
      .select('Issue')
      .lean();

    console.log('\n========================================');
    console.log('🎲 数据库中最新的15期期号');
    console.log('========================================');
    latestIssues.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.Issue}`);
    });

    // 检查是否存在 25115-25124 的历史数据
    console.log('\n========================================');
    console.log('🔍 检查 25115-25124 期号是否存在');
    console.log('========================================');
    for (let issue = 25115; issue <= 25124; issue++) {
      const exists = await HitDlts.findOne({ Issue: issue }).lean();
      console.log(`期号 ${issue}:`, exists ? '✅ 存在' : '❌ 不存在');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n已断开数据库连接');
  }
}

checkHwcPosTask();
