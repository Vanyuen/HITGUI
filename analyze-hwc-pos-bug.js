/**
 * 深入分析 hwc-pos-20251124-yem 任务的完整数据
 */

const mongoose = require('mongoose');

async function analyzeHwcPosTask() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 已连接到 MongoDB');

    const db = mongoose.connection.db;

    // 1. 查询任务详情
    const taskColl = db.collection('hit_dlt_hwcpositivepredictiontasks');
    const task = await taskColl.findOne({ task_id: 'hwc-pos-20251124-yem' });

    console.log('\n========================================');
    console.log('📋 任务详细配置');
    console.log('========================================');
    console.log(JSON.stringify(task, null, 2));

    // 2. 查询任务结果
    const resultColl = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
    const results = await resultColl.find({ task_id: 'hwc-pos-20251124-yem' })
      .sort({ period: 1 })
      .toArray();

    console.log('\n========================================');
    console.log('📊 任务结果统计');
    console.log('========================================');
    console.log('结果记录数:', results.length);

    if (results.length > 0) {
      console.log('\n各期结果详情:');
      results.forEach((result, index) => {
        console.log(`\n期号 #${index + 1}: ${result.period}`);
        console.log('  result_id:', result.result_id);
        console.log('  is_predicted:', result.is_predicted);
        console.log('  红球组合数:', result.red_combinations?.length || 0);
        console.log('  蓝球组合数:', result.blue_combinations?.length || 0);
        console.log('  总组合数:', result.total_combinations);
        console.log('  排除组合数:', result.excluded_combinations);
        console.log('  has_prize_stats:', !!result.prize_stats);
        console.log('  has_red_hit_stats:', !!result.red_hit_stats);
        console.log('  has_blue_hit_stats:', !!result.blue_hit_stats);

        if (result.prize_stats) {
          console.log('  prize_stats:', JSON.stringify(result.prize_stats, null, 4));
        }
      });
    }

    // 3. 检查数据库中的历史期号 (25115-25124)
    const hitDltsColl = db.collection('hit_dlts');
    console.log('\n========================================');
    console.log('🎲 检查历史期号数据 (25115-25124)');
    console.log('========================================');

    const historicalIssues = await hitDltsColl.find({
      Issue: { $gte: 25115, $lte: 25124 }
    }).sort({ Issue: 1 }).toArray();

    console.log(`\n找到 ${historicalIssues.length} 期历史数据:`);
    historicalIssues.forEach(issue => {
      console.log(`  期号 ${issue.Issue}: 红球 [${issue.RedBall}], 蓝球 [${issue.BlueBall}]`);
    });

    // 4. 分析为什么只生成了推算期的结果
    console.log('\n========================================');
    console.log('🔍 BUG分析: 为什么只有推算期 25125 的结果?');
    console.log('========================================');

    console.log('\n【期号范围配置】');
    console.log('period_range:', JSON.stringify(task.period_range, null, 2));

    console.log('\n【预期行为】');
    console.log('选择 "最近10期+1期推算" 应该生成:');
    console.log('  - 25115-25124: 10期历史数据的预测结果');
    console.log('  - 25125: 1期推算数据的预测结果');
    console.log('  共: 11期结果');

    console.log('\n【实际结果】');
    console.log('  - 只生成了 25125 推算期的结果');
    console.log('  - 缺失了 25115-25124 共10期的历史期结果');

    console.log('\n【问题定位】');
    console.log('1. 任务的 period_range 配置是否正确?');
    console.log('   期号范围:', task.period_range);

    console.log('\n2. 任务执行时是否正确遍历了所有期号?');
    console.log('   - 检查后端 processHwcPositiveBatchPredictionTask 函数');
    console.log('   - 是否有过滤掉历史期的逻辑?');
    console.log('   - 是否只处理了 is_predicted=true 的期号?');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n已断开数据库连接');
  }
}

analyzeHwcPosTask();
