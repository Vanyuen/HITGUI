/**
 * 检查最新的热温冷正选任务数据
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkLatestTask() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 获取最新的任务
    const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();

    if (latestTask.length === 0) {
      console.log('❌ 没有找到任务');
      return;
    }

    const task = latestTask[0];

    console.log('📋 最新任务信息:');
    console.log('='.repeat(100));
    console.log(`任务ID: ${task.task_id}`);
    console.log(`任务名称: ${task.task_name}`);
    console.log(`状态: ${task.status}`);
    console.log(`创建时间: ${task.created_at}`);
    console.log('');

    console.log('正选条件:');
    console.log(`  热温冷比: ${JSON.stringify(task.positive_selection?.hwc_ratios)}`);
    console.log(`  区间比: ${JSON.stringify(task.positive_selection?.zone_ratios)}`);
    console.log(`  奇偶比: ${JSON.stringify(task.positive_selection?.odd_even_ratios)}`);
    console.log(`  和值范围: ${JSON.stringify(task.positive_selection?.sum_ranges)}`);
    console.log(`  跨度范围: ${JSON.stringify(task.positive_selection?.span_ranges)}`);
    console.log(`  AC值: ${JSON.stringify(task.positive_selection?.ac_values)}`);
    console.log('');

    console.log('任务统计:');
    console.log(`  statistics: ${JSON.stringify(task.statistics, null, 2)}`);
    console.log('');

    // 获取该任务的结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: task.task_id })
      .toArray();

    console.log('📊 任务结果统计:');
    console.log('='.repeat(100));
    console.log(`总结果数: ${results.length}`);
    console.log('');

    if (results.length > 0) {
      // 按期号分组
      const byPeriod = {};
      for (const result of results) {
        if (!byPeriod[result.period]) {
          byPeriod[result.period] = {
            count: 0,
            red_combinations: [],
            blue_combinations: [],
            hit_analysis: null,
            winning_numbers: null
          };
        }
        byPeriod[result.period].count++;
        byPeriod[result.period].red_combinations = result.red_combinations || [];
        byPeriod[result.period].blue_combinations = result.blue_combinations || [];
        byPeriod[result.period].hit_analysis = result.hit_analysis || {};
        byPeriod[result.period].winning_numbers = result.winning_numbers || {};
      }

      console.log('各期结果明细:');
      const periods = Object.keys(byPeriod).sort((a, b) => parseInt(a) - parseInt(b));

      for (const period of periods.slice(0, 5)) {  // 只显示前5期
        const data = byPeriod[period];
        console.log(`\n期号 ${period}:`);
        console.log(`  红球组合数: ${data.red_combinations.length}`);
        console.log(`  蓝球组合数: ${data.blue_combinations.length}`);
        console.log(`  总组合数: ${data.red_combinations.length * (data.blue_combinations.length || 1)}`);
        console.log(`  命中分析: ${JSON.stringify(data.hit_analysis)}`);
        console.log(`  开奖号码: ${JSON.stringify(data.winning_numbers)}`);
      }

      if (periods.length > 5) {
        console.log(`\n... 还有 ${periods.length - 5} 期数据未显示`);
      }

      // 计算总组合数和命中统计
      let totalCombinations = 0;
      let totalHits = 0;
      let prizeStats = {
        first: 0,
        second: 0,
        third: 0
      };

      for (const period of periods) {
        const data = byPeriod[period];
        const combos = data.red_combinations.length * (data.blue_combinations.length || 1);
        totalCombinations += combos;

        if (data.hit_analysis) {
          if (data.hit_analysis.prize_stats) {
            prizeStats.first += data.hit_analysis.prize_stats.first_prize?.count || 0;
            prizeStats.second += data.hit_analysis.prize_stats.second_prize?.count || 0;
            prizeStats.third += data.hit_analysis.prize_stats.third_prize?.count || 0;
          }
        }
      }

      console.log('\n📈 总体统计:');
      console.log('='.repeat(100));
      console.log(`总期数: ${periods.length}`);
      console.log(`总组合数: ${totalCombinations.toLocaleString()}`);
      console.log(`一等奖: ${prizeStats.first}`);
      console.log(`二等奖: ${prizeStats.second}`);
      console.log(`三等奖: ${prizeStats.third}`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkLatestTask();
