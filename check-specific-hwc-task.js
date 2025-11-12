/**
 * 检查特定的热温冷正选任务详情
 * 任务ID: hwc-pos-20251105-cg2
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkSpecificTask() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 1. 查找任务
    console.log('🔍 步骤1: 查找任务 hwc-pos-20251105-cg2');
    console.log('='.repeat(100));

    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({
      task_id: 'hwc-pos-20251105-cg2'
    });

    if (!task) {
      console.log('❌ 未找到该任务！');
      return;
    }

    console.log('✅ 找到任务\n');
    console.log('任务信息:');
    console.log(`  - 任务ID: ${task.task_id}`);
    console.log(`  - 任务名称: ${task.task_name}`);
    console.log(`  - 状态: ${task.status}`);
    console.log(`  - 创建时间: ${task.created_at}`);
    console.log(`  - 完成时间: ${task.completed_at || 'N/A'}`);
    console.log(`  - 期号列表长度: ${task.issue_list?.length || 0}`);
    console.log('');

    if (task.issue_list && task.issue_list.length > 0) {
      console.log(`期号列表 (${task.issue_list.length}期):`);
      console.log(`  ${task.issue_list.join(', ')}`);
      console.log('');
    }

    console.log('正选条件:');
    console.log(`  - 热温冷比: ${JSON.stringify(task.hot_warm_cold_ratio)}`);
    console.log(`  - 区间比: ${JSON.stringify(task.zone_ratio)}`);
    console.log(`  - 奇偶比: ${JSON.stringify(task.odd_even_ratio)}`);
    console.log('');

    // 2. 检查结果数据
    console.log('🔍 步骤2: 检查任务结果数据');
    console.log('='.repeat(100));

    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: task.task_id })
      .toArray();

    console.log(`✅ 找到 ${results.length} 条结果记录\n`);

    if (results.length > 0) {
      // 按期号分组统计
      const byIssue = {};
      results.forEach(r => {
        if (!byIssue[r.issue]) {
          byIssue[r.issue] = [];
        }
        byIssue[r.issue].push(r);
      });

      console.log('各期结果统计:');
      Object.keys(byIssue).sort().forEach(issue => {
        const issueResults = byIssue[issue];
        console.log(`  期号 ${issue}: ${issueResults.length} 个组合`);
      });
      console.log('');

      // 显示前3个结果示例
      console.log('结果示例 (前3个):');
      results.slice(0, 3).forEach((r, idx) => {
        console.log(`  ${idx + 1}. 期号: ${r.issue}`);
        console.log(`     红球: ${r.red_combination.join(', ')}`);
        console.log(`     蓝球: ${r.blue_combination.join(', ')}`);
        console.log(`     热温冷比: ${r.hot_warm_cold_ratio || 'N/A'}`);
        console.log(`     区间比: ${r.zone_ratio || 'N/A'}`);
        console.log(`     命中情况: ${r.prize_level || '未中奖'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  没有找到任何结果记录！');
      console.log('   这意味着任务执行过程中没有生成任何组合');
      console.log('');
    }

    // 3. 检查这些期号在数据库中是否存在
    console.log('🔍 步骤3: 检查期号在数据库中的存在性');
    console.log('='.repeat(100));

    if (task.issue_list && task.issue_list.length > 0) {
      for (const issue of task.issue_list) {
        // 尝试不同的查询方式
        const issueInt = parseInt(issue);
        const issueStr = String(issue);

        const foundInt = await db.collection('hit_dlts').findOne({ Issue: issueInt });
        const foundStr = await db.collection('hit_dlts').findOne({ Issue: issueStr });

        const exists = foundInt || foundStr;
        const status = exists ? '✅ 存在' : '❌ 不存在';

        console.log(`  期号 ${issue} (int: ${issueInt}, str: "${issueStr}"): ${status}`);

        if (exists) {
          const record = foundInt || foundStr;
          const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
          const blueBalls = [record.Blue1, record.Blue2];
          const hasStats = record.statistics && record.statistics.frontHotWarmColdRatio;

          console.log(`    开奖号码: 红[${redBalls.join(',')}] 蓝[${blueBalls.join(',')}]`);
          console.log(`    统计数据: ${hasStats ? '✅ ' + record.statistics.frontHotWarmColdRatio : '❌ 无'}`);
        }
      }
    }
    console.log('');

    // 4. 检查热温冷优化表数据
    console.log('🔍 步骤4: 检查热温冷优化表数据');
    console.log('='.repeat(100));

    if (task.issue_list && task.issue_list.length >= 2) {
      const firstIssue = task.issue_list[0];
      const lastIssue = task.issue_list[task.issue_list.length - 1];

      console.log(`查询优化表: base_issue = ${firstIssue}, target_issue = ${lastIssue}`);

      const optimizedData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
          base_issue: { $in: task.issue_list.map(i => parseInt(i)) },
          target_issue: { $in: task.issue_list.map(i => parseInt(i)) }
        })
        .limit(10)
        .toArray();

      console.log(`✅ 找到 ${optimizedData.length} 条优化表记录`);

      if (optimizedData.length > 0) {
        console.log('\n示例记录:');
        optimizedData.slice(0, 3).forEach((record, idx) => {
          console.log(`  ${idx + 1}. base_issue: ${record.base_issue}, target_issue: ${record.target_issue}`);
          console.log(`     combination_id: ${record.combination_id}`);
          console.log(`     hwc_ratio: ${record.hwc_ratio}`);
        });
      } else {
        console.log('⚠️  优化表中没有这些期号的数据！');
        console.log('   这可能是导致0组合输出的原因');
      }
    }
    console.log('');

    // 5. 总结分析
    console.log('📊 问题分析总结');
    console.log('='.repeat(100));

    const issues = [];

    if (!task.issue_list || task.issue_list.length === 0) {
      issues.push('❌ 任务的期号列表为空');
    }

    if (results.length === 0) {
      issues.push('❌ 任务执行后没有生成任何组合结果');
    }

    // 检查期号是否都存在于数据库
    if (task.issue_list && task.issue_list.length > 0) {
      let missingCount = 0;
      for (const issue of task.issue_list) {
        const exists = await db.collection('hit_dlts').findOne({
          $or: [
            { Issue: parseInt(issue) },
            { Issue: String(issue) }
          ]
        });
        if (!exists) missingCount++;
      }

      if (missingCount > 0) {
        issues.push(`⚠️  ${missingCount}/${task.issue_list.length} 个期号在数据库中不存在`);
      }
    }

    if (issues.length > 0) {
      console.log('发现以下问题:');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ 未发现明显问题');
    }
    console.log('');

    console.log('💡 可能的原因:');
    console.log('1. 期号范围中包含未开奖的期号（25115-25125中部分期号超出了数据库最新期号25121）');
    console.log('2. 热温冷比4:1:0的条件过于严格，没有组合能够满足');
    console.log('3. 优化表数据缺失或不完整');
    console.log('4. 任务执行逻辑中的筛选条件过滤掉了所有组合');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkSpecificTask();
