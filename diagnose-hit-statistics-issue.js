/**
 * 诊断命中统计功能为什么全部为0
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function diagnose() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('🔍 诊断命中统计功能\n');
  console.log('='.repeat(80));

  // 1. 检查结果表数据
  console.log('\n1️⃣ 检查结果表数据:');
  const resultColl = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
  const totalResults = await resultColl.countDocuments();
  console.log(`  总结果数: ${totalResults}`);

  const resultsWithHit = await resultColl.countDocuments({ hit_count: { $gt: 0 } });
  console.log(`  有命中的结果: ${resultsWithHit}`);

  // 抽样查看结果数据
  const sampleResults = await resultColl.find({}).limit(5).toArray();
  console.log('\n  样本结果数据:');
  sampleResults.forEach((r, i) => {
    console.log(`  [${i + 1}] Task: ${r.task_id}`);
    console.log(`      Red: ${r.red_balls || '未定义'}`);
    console.log(`      Blue: ${r.blue_balls || '未定义'}`);
    console.log(`      hit_count: ${r.hit_count || 0}`);
    console.log(`      hit_issues: ${JSON.stringify(r.hit_issues || {})}`);
    console.log(`      prize_level: ${r.prize_level || '未定义'}`);
  });

  // 2. 检查任务数据
  console.log('\n2️⃣ 检查任务数据:');
  const taskColl = db.collection('hit_dlt_hwcpositivepredictiontasks');

  const tasksSample = await taskColl.find({}).sort({ created_at: -1 }).limit(3).toArray();
  console.log(`  最近3个任务:`);
  for (const task of tasksSample) {
    console.log(`\n  任务ID: ${task._id.toString()}`);
    console.log(`    任务名: ${task.task_name}`);
    console.log(`    基准期号: ${task.base_issue}`);
    console.log(`    目标期号: ${task.target_issue}`);
    console.log(`    状态: ${task.status}`);
    console.log(`    保留组合: ${task.retained_count || 0}`);

    // 检查该任务的结果
    const taskResults = await resultColl.find({ task_id: task._id.toString() }).limit(3).toArray();
    console.log(`    实际结果数: ${taskResults.length}`);

    if (taskResults.length > 0) {
      console.log(`    样本结果:`);
      taskResults.slice(0, 2).forEach((r, i) => {
        console.log(`      [${i + 1}] ${r.red_balls || '?'} + ${r.blue_balls || '?'}`);
        console.log(`          hit_count: ${r.hit_count || 0}`);
      });
    }
  }

  // 3. 检查历史数据范围
  console.log('\n3️⃣ 检查历史数据范围:');
  const dltColl = db.collection('hit_dlts');

  const latestIssues = await dltColl.find({}).sort({ Issue: -1 }).limit(5).toArray();
  console.log('  最近5期:');
  latestIssues.forEach(issue => {
    console.log(`    期号 ${issue.Issue}: 红球 [${issue.Red1},${issue.Red2},${issue.Red3},${issue.Red4},${issue.Red5}] 蓝球 [${issue.Blue1},${issue.Blue2}]`);
  });

  // 4. 关键诊断：检查任务的target_issue是否在历史数据中
  console.log('\n4️⃣ 关键诊断：任务目标期号是否有开奖数据?');
  for (const task of tasksSample) {
    const targetIssue = parseInt(task.target_issue);
    const hasDrawn = await dltColl.findOne({ Issue: targetIssue });

    const status = hasDrawn ? '✅ 有开奖数据' : '❌ 未开奖';
    console.log(`  ${task.task_name} (${task.target_issue}): ${status}`);

    if (hasDrawn) {
      console.log(`    开奖号码: 红 [${hasDrawn.Red1},${hasDrawn.Red2},${hasDrawn.Red3},${hasDrawn.Red4},${hasDrawn.Red5}] 蓝 [${hasDrawn.Blue1},${hasDrawn.Blue2}]`);
    }
  }

  // 5. 检查结果字段完整性
  console.log('\n5️⃣ 结果字段完整性检查:');
  const sampleResult = await resultColl.findOne({});
  if (sampleResult) {
    console.log('  样本结果字段:');
    console.log(`    _id: ${sampleResult._id ? '✅' : '❌'}`);
    console.log(`    task_id: ${sampleResult.task_id ? '✅' : '❌'}`);
    console.log(`    red_balls: ${sampleResult.red_balls ? '✅' : '❌'}`);
    console.log(`    blue_balls: ${sampleResult.blue_balls ? '✅' : '❌'}`);
    console.log(`    hit_count: ${typeof sampleResult.hit_count === 'number' ? '✅' : '❌'}`);
    console.log(`    hit_issues: ${sampleResult.hit_issues ? '✅' : '❌'}`);
    console.log(`    prize_level: ${sampleResult.prize_level ? '✅' : '❌'}`);
    console.log(`    prize_amount: ${sampleResult.prize_amount !== undefined ? '✅' : '❌'}`);
  }

  // 6. 尝试手动计算一个组合的命中
  console.log('\n6️⃣ 手动命中计算测试:');
  const testTask = tasksSample[0];
  const testResult = await resultColl.findOne({ task_id: testTask._id.toString() });

  if (testResult && testResult.red_balls && testResult.blue_balls) {
    console.log(`  测试组合: 红 ${testResult.red_balls} 蓝 ${testResult.blue_balls}`);

    // 获取目标期号范围
    const targetIssue = parseInt(testTask.target_issue);
    const drawnData = await dltColl.findOne({ Issue: targetIssue });

    if (drawnData) {
      const redBalls = testResult.red_balls.split(',').map(Number);
      const blueBalls = testResult.blue_balls.split(',').map(Number);

      const drawnRed = [drawnData.Red1, drawnData.Red2, drawnData.Red3, drawnData.Red4, drawnData.Red5];
      const drawnBlue = [drawnData.Blue1, drawnData.Blue2];

      const redHit = redBalls.filter(ball => drawnRed.includes(ball)).length;
      const blueHit = blueBalls.filter(ball => drawnBlue.includes(ball)).length;

      console.log(`  开奖号码: 红 ${drawnRed} 蓝 ${drawnBlue}`);
      console.log(`  命中情况: ${redHit}红 + ${blueHit}蓝`);

      // 判断奖级
      let prize = '未中奖';
      if (redHit === 5 && blueHit === 2) prize = '一等奖';
      else if (redHit === 5 && blueHit === 1) prize = '二等奖';
      else if (redHit === 5 && blueHit === 0) prize = '三等奖';
      else if (redHit === 4 && blueHit === 2) prize = '四等奖';
      else if (redHit === 4 && blueHit === 1) prize = '五等奖';
      else if (redHit === 3 && blueHit === 2) prize = '六等奖';
      else if (redHit === 4 && blueHit === 0) prize = '七等奖';
      else if ((redHit === 3 && blueHit === 1) || (redHit === 2 && blueHit === 2)) prize = '八等奖';
      else if ((redHit === 3 && blueHit === 0) || (redHit === 1 && blueHit === 2) || (redHit === 2 && blueHit === 1) || (redHit === 0 && blueHit === 2)) prize = '九等奖';

      console.log(`  应得奖级: ${prize}`);
      console.log(`  实际记录: hit_count=${testResult.hit_count || 0}, prize_level=${testResult.prize_level || '无'}`);

      if (prize !== '未中奖' && testResult.hit_count === 0) {
        console.log(`\n  ❌ 发现问题：此组合应该中奖但记录为0！`);
      }
    } else {
      console.log(`  ⚠️  目标期号 ${targetIssue} 无开奖数据，无法计算命中`);
    }
  }

  // 7. 总结和建议
  console.log('\n7️⃣ 问题总结:');

  const issuesFound = [];

  if (resultsWithHit === 0) {
    issuesFound.push('所有结果的 hit_count 为 0');
  }

  // 检查是否所有任务的target_issue都未开奖
  let allUndrawn = true;
  for (const task of tasksSample) {
    const hasDrawn = await dltColl.findOne({ Issue: parseInt(task.target_issue) });
    if (hasDrawn) {
      allUndrawn = false;
      break;
    }
  }

  if (allUndrawn) {
    issuesFound.push('所有任务的目标期号都未开奖');
  }

  if (issuesFound.length > 0) {
    console.log('  发现的问题:');
    issuesFound.forEach((issue, i) => {
      console.log(`    ${i + 1}. ${issue}`);
    });
  }

  console.log('\n  可能原因:');
  console.log('    1. 命中分析功能未执行（processHwcPositiveTask中未调用）');
  console.log('    2. 目标期号范围超出已开奖数据');
  console.log('    3. 结果保存时未包含命中统计字段');
  console.log('    4. 命中计算逻辑有误');

  await client.close();
  console.log('\n' + '='.repeat(80));
  console.log('✅ 诊断完成');
}

diagnose().catch(console.error);
