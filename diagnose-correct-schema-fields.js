/**
 * 诊断脚本 - 使用正确的Schema字段结构
 * 解决之前误判字段undefined的问题
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function diagnose() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('🔍 使用正确Schema结构诊断系统\n');
  console.log('='.repeat(80));

  // 1. 检查任务表字段（正确的嵌套结构）
  console.log('\n1️⃣ 任务表字段检查 (使用period_range嵌套结构):');
  const taskColl = db.collection('hit_dlt_hwcpositivepredictiontasks');

  const latestTask = await taskColl.findOne({}, { sort: { created_at: -1 } });

  if (latestTask) {
    console.log(`\n  最新任务: ${latestTask.task_name}`);
    console.log(`  任务ID: ${latestTask.task_id}`);
    console.log(`\n  期号范围 (period_range):`)
    console.log(`    type: ${latestTask.period_range?.type || '❌ undefined'}`);
    console.log(`    start: ${latestTask.period_range?.start || '❌ undefined'}`);
    console.log(`    end: ${latestTask.period_range?.end || '❌ undefined'}`);
    console.log(`    total: ${latestTask.period_range?.total || '❌ undefined'}`);
    console.log(`    predicted_count: ${latestTask.period_range?.predicted_count || 0}`);

    console.log(`\n  正选条件 (positive_selection):`)
    console.log(`    热温冷比: ${JSON.stringify(latestTask.positive_selection?.hwc_ratios || [])}`);
    console.log(`    区间比: ${JSON.stringify(latestTask.positive_selection?.zone_ratios || [])}`);
    console.log(`    奇偶比: ${JSON.stringify(latestTask.positive_selection?.odd_even_ratios || [])}`);

    console.log(`\n  排除条件 (exclusion_conditions):`)
    console.log(`    和值排除: ${latestTask.exclusion_conditions?.sum?.historical?.enabled ? '✅ 启用' : '❌ 未启用'}`);
    console.log(`    热温冷排除: ${latestTask.exclusion_conditions?.hwc?.historical?.enabled ? '✅ 启用' : '❌ 未启用'}`);
    console.log(`    相克对排除: ${latestTask.exclusion_conditions?.conflictPairs?.enabled ? '✅ 启用' : '❌ 未启用'}`);
    console.log(`    同现比排除: ${latestTask.exclusion_conditions?.coOccurrence?.enabled ? '✅ 启用' : '❌ 未启用'}`);

    console.log(`\n  输出配置 (output_config):`)
    console.log(`    启用命中分析: ${latestTask.output_config?.enableHitAnalysis ? '✅ 是' : '❌ 否'}`);
    console.log(`    配对模式: ${latestTask.output_config?.pairingMode || '❌ undefined'}`);

    console.log(`\n  统计信息 (statistics):`)
    console.log(`    总期数: ${latestTask.statistics?.total_periods || 0}`);
    console.log(`    总组合数: ${latestTask.statistics?.total_combinations || 0}`);
    console.log(`    总命中数: ${latestTask.statistics?.total_hits || 0}`);
    console.log(`    平均命中率: ${latestTask.statistics?.avg_hit_rate || 0}%`);
    console.log(`    总奖金: ¥${latestTask.statistics?.total_prize_amount || 0}`);
  } else {
    console.log('  ❌ 无任务数据');
  }

  // 2. 检查结果表字段（正确的嵌套结构）
  console.log('\n2️⃣ 结果表字段检查 (使用paired_combinations和hit_analysis):');
  const resultColl = db.collection('hit_dlt_hwcpositivepredictiontaskresults');

  const totalResults = await resultColl.countDocuments();
  console.log(`  总结果数: ${totalResults}`);

  if (latestTask) {
    const taskResults = await resultColl.find({ task_id: latestTask.task_id })
      .sort({ period: 1 })
      .toArray();

    console.log(`\n  任务 ${latestTask.task_id} 的结果:`);
    console.log(`  结果记录数: ${taskResults.length}`);

    if (taskResults.length > 0) {
      const firstResult = taskResults[0];
      console.log(`\n  第一期结果 (期号 ${firstResult.period}):`);
      console.log(`    组合总数: ${firstResult.combination_count || 0}`);
      console.log(`    是否推算期: ${firstResult.is_predicted ? '是' : '否'}`);

      // 检查paired_combinations
      const pairedCount = firstResult.paired_combinations?.length || 0;
      console.log(`\n    配对组合 (paired_combinations):`);
      console.log(`      配对数量: ${pairedCount}`);
      if (pairedCount > 0) {
        const firstPair = firstResult.paired_combinations[0];
        console.log(`      样本: 红球ID ${firstPair.red_combo_id} [${firstPair.red_balls?.join(',')}] + 蓝球ID ${firstPair.blue_combo_id} [${firstPair.blue_balls?.join(',')}]`);
      } else {
        console.log(`      ⚠️  配对数据为空数组`);
      }

      // 检查hit_analysis
      console.log(`\n    命中分析 (hit_analysis):`);
      console.log(`      红球最高命中: ${firstResult.hit_analysis?.max_red_hit || 0}/5`);
      console.log(`      蓝球最高命中: ${firstResult.hit_analysis?.max_blue_hit || 0}/2`);
      console.log(`      命中率: ${firstResult.hit_analysis?.hit_rate || 0}%`);
      console.log(`      本期总奖金: ¥${firstResult.hit_analysis?.total_prize || 0}`);

      // 检查奖项统计
      console.log(`\n    奖项统计 (prize_stats):`);
      const prizeStats = firstResult.hit_analysis?.prize_stats || {};
      console.log(`      一等奖: ${prizeStats.first_prize?.count || 0} 注`);
      console.log(`      二等奖: ${prizeStats.second_prize?.count || 0} 注`);
      console.log(`      三等奖: ${prizeStats.third_prize?.count || 0} 注`);

      // 检查开奖号码
      console.log(`\n    开奖号码 (winning_numbers):`);
      if (firstResult.winning_numbers) {
        console.log(`      红球: [${firstResult.winning_numbers.red?.join(',') || '无'}]`);
        console.log(`      蓝球: [${firstResult.winning_numbers.blue?.join(',') || '无'}]`);
      } else {
        console.log(`      ❌ 无开奖数据 (可能是推算期)`);
      }

      // 检查排除统计
      console.log(`\n    排除统计 (exclusion_summary):`);
      const exSum = firstResult.exclusion_summary || {};
      console.log(`      正选后组合数: ${exSum.positive_selection_count || 'undefined'}`);
      console.log(`      和值排除: ${exSum.sum_exclude_count || 0}`);
      console.log(`      热温冷排除: ${exSum.hwc_exclude_count || 0}`);
      console.log(`      相克对排除: ${exSum.conflict_exclude_count || 0}`);
      console.log(`      同现比排除: ${exSum.cooccurrence_exclude_count || 0}`);
      console.log(`      最终保留: ${exSum.final_count || 'undefined'}`);
    }
  }

  // 3. 关键诊断：为什么统计数据全为0
  console.log('\n3️⃣ 关键诊断：为什么任务卡面板显示统计数据为0?');

  if (latestTask) {
    const allResults = await resultColl.find({ task_id: latestTask.task_id }).toArray();

    // 统计有命中的期数
    const periodsWithHit = allResults.filter(r =>
      (r.hit_analysis?.max_red_hit || 0) > 0 ||
      (r.hit_analysis?.max_blue_hit || 0) > 0
    );

    const periodsWithPrize = allResults.filter(r =>
      (r.hit_analysis?.total_prize || 0) > 0
    );

    console.log(`\n  任务: ${latestTask.task_name}`);
    console.log(`  总期数: ${allResults.length}`);
    console.log(`  有命中的期数: ${periodsWithHit.length}`);
    console.log(`  有奖金的期数: ${periodsWithPrize.length}`);

    // 检查是否所有期都是推算期
    const predictedPeriods = allResults.filter(r => r.is_predicted);
    console.log(`  推算期数: ${predictedPeriods.length}`);
    console.log(`  已开奖期数: ${allResults.length - predictedPeriods.length}`);

    if (predictedPeriods.length === allResults.length) {
      console.log(`\n  ⚠️  所有期号都是推算期，无法计算命中统计！`);
      console.log(`  这是正常的，因为推算期尚未开奖，没有实际中奖数据。`);
    } else if (periodsWithHit.length === 0) {
      console.log(`\n  ❌ 问题发现：已开奖期没有命中数据！`);
      console.log(`  可能原因:`);
      console.log(`    1. 命中分析功能未执行`);
      console.log(`    2. 开奖号码数据缺失`);
      console.log(`    3. 配对组合数据为空`);

      // 深入检查一个已开奖期
      const drawnResult = allResults.find(r => !r.is_predicted);
      if (drawnResult) {
        console.log(`\n  检查已开奖期 ${drawnResult.period}:`);
        console.log(`    paired_combinations数量: ${drawnResult.paired_combinations?.length || 0}`);
        console.log(`    winning_numbers: ${drawnResult.winning_numbers ? '有' : '无'}`);
        console.log(`    hit_analysis: ${drawnResult.hit_analysis ? '有' : '无'}`);
      }
    } else {
      console.log(`\n  ✅ 有 ${periodsWithHit.length} 期有命中数据`);
    }
  }

  // 4. 检查数据库中的大乐透开奖数据
  console.log('\n4️⃣ 检查大乐透历史开奖数据:');
  const dltColl = db.collection('hit_dlts');
  const latestIssues = await dltColl.find({}).sort({ Issue: -1 }).limit(5).toArray();

  console.log(`  最新5期开奖号码:`);
  latestIssues.forEach(issue => {
    console.log(`    ${issue.Issue}: 红 [${issue.Red1},${issue.Red2},${issue.Red3},${issue.Red4},${issue.Red5}] 蓝 [${issue.Blue1},${issue.Blue2}]`);
  });

  await client.close();
  console.log('\n' + '='.repeat(80));
  console.log('✅ 诊断完成');
}

diagnose().catch(console.error);
