/**
 * 大乐透热温冷正选批量预测 - 完整系统测试
 * 使用正确的集合名称（Mongoose生成的小写+复数形式）
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

let client;
let db;

// 正确的集合名映射
const COLLECTIONS = {
  DLT_HISTORY: 'hit_dlts',                                    // 大乐透历史数据
  RED_COMBINATIONS: 'hit_dlt_redcombinations',               // 红球组合表
  BLUE_COMBINATIONS: 'hit_dlts',             // 蓝球组合表
  HWC_OPTIMIZED: 'hit_dlt_redcombinationshotwarmcoldoptimizeds', // 热温冷优化表
  TASKS: 'hit_dlt_hwcpositivepredictiontasks',               // 热温冷正选任务表
  RESULTS: 'hit_dlt_hwcpositivepredictiontaskresults',       // 任务结果表
  EXCLUSION_DETAILS: 'hit_dlt_exclusiondetails'              // 排除详情表
};

// 测试报告
const report = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { passed: 0, failed: 0, warnings: 0 }
};

function log(icon, message, data = null) {
  console.log(`${icon} ${message}`);
  if (data) {
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`   ${data}`);
    }
  }
}

function addTest(name, status, details = {}) {
  const test = { name, status, ...details };
  report.tests.push(test);

  const icons = { PASS: '✅', FAIL: '❌', WARN: '⚠️' };
  log(icons[status], name, details.message || details.data);

  report.summary[status.toLowerCase() + (status === 'WARN' ? 'ings' : status === 'PASS' ? 'ed' : 'ed')]++;
}

async function connect() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    log('🔗', '已连接到 MongoDB');
    return true;
  } catch (error) {
    log('❌', `MongoDB 连接失败: ${error.message}`);
    return false;
  }
}

// ============================================================================
// 测试 1: 数据库集合和数据完整性
// ============================================================================
async function test1_DatabaseIntegrity() {
  console.log('\n' + '='.repeat(80));
  console.log('📦 测试 1: 数据库集合和数据完整性');
  console.log('='.repeat(80) + '\n');

  // 1.1 大乐透历史数据
  const dltCount = await db.collection(COLLECTIONS.DLT_HISTORY).countDocuments();
  addTest(
    '大乐透历史数据',
    dltCount > 0 ? 'PASS' : 'FAIL',
    { message: `${dltCount} 期历史数据` }
  );

  if (dltCount > 0) {
    const latest = await db.collection(COLLECTIONS.DLT_HISTORY)
      .find({}).sort({ issue: -1 }).limit(1).toArray();
    addTest(
      '最新期号',
      'PASS',
      { message: `第 ${latest[0].issue} 期` }
    );
  }

  // 1.2 红球组合表
  const redCount = await db.collection(COLLECTIONS.RED_COMBINATIONS).countDocuments();
  addTest(
    '红球组合预计算表',
    redCount === 324632 ? 'PASS' : redCount > 0 ? 'WARN' : 'FAIL',
    { message: `${redCount.toLocaleString()} 条 (预期 324,632)` }
  );

  // 1.3 蓝球组合表
  const blueCount = await db.collection(COLLECTIONS.BLUE_COMBINATIONS).countDocuments();
  addTest(
    '蓝球组合预计算表',
    blueCount === 66 ? 'PASS' : blueCount > 0 ? 'WARN' : 'FAIL',
    { message: `${blueCount} 条 (预期 66)` }
  );

  // 1.4 热温冷优化表
  const hwcCount = await db.collection(COLLECTIONS.HWC_OPTIMIZED).countDocuments();
  addTest(
    '热温冷优化表',
    hwcCount > 0 ? 'PASS' : 'WARN',
    { message: `${hwcCount.toLocaleString()} 条优化记录` }
  );

  if (hwcCount > 0) {
    const sample = await db.collection(COLLECTIONS.HWC_OPTIMIZED).findOne({});
    const hasRequiredFields =
      sample.base_issue &&
      sample.combination_id &&
      typeof sample.hot_count === 'number';

    addTest(
      '热温冷优化表字段完整性',
      hasRequiredFields ? 'PASS' : 'FAIL',
      {
        data: {
          base_issue: sample.base_issue,
          combination_id: sample.combination_id,
          hot: sample.hot_count,
          warm: sample.warm_count,
          cold: sample.cold_count
        }
      }
    );
  }
}

// ============================================================================
// 测试 2: 任务系统功能
// ============================================================================
async function test2_TaskSystem() {
  console.log('\n' + '='.repeat(80));
  console.log('📝 测试 2: 任务系统功能');
  console.log('='.repeat(80) + '\n');

  // 2.1 任务总数
  const taskCount = await db.collection(COLLECTIONS.TASKS).countDocuments();
  addTest(
    '任务总数',
    taskCount > 0 ? 'PASS' : 'WARN',
    { message: `${taskCount} 个任务` }
  );

  if (taskCount > 0) {
    // 2.2 任务状态分布
    const statusCounts = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    addTest(
      '任务状态分布',
      'PASS',
      {
        data: {
          pending: statusMap.pending || 0,
          processing: statusMap.processing || 0,
          completed: statusMap.completed || 0,
          failed: statusMap.failed || 0
        }
      }
    );

    // 2.3 最近任务详情
    const recentTasks = await db.collection(COLLECTIONS.TASKS)
      .find({}).sort({ created_at: -1 }).limit(3).toArray();

    for (const task of recentTasks) {
      addTest(
        `任务: ${task.task_name}`,
        task.status === 'completed' ? 'PASS' : task.status === 'failed' ? 'FAIL' : 'WARN',
        {
          data: {
            ID: task._id.toString().substring(0, 8),
            基准期号: task.base_issue,
            目标期号: task.target_issue,
            状态: task.status,
            进度: `${task.progress || 0}%`,
            保留组合: task.retained_count || 0
          }
        }
      );
    }

    // 2.4 配对模式分析
    const pairingModes = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $group: { _id: '$pairing_mode', count: { $sum: 1 } } }
    ]).toArray();

    const modeMap = {};
    pairingModes.forEach(p => { modeMap[p._id] = p.count; });

    addTest(
      '配对模式使用情况',
      'PASS',
      {
        data: {
          default: modeMap.default || 0,
          unlimited: modeMap.unlimited || 0,
          'truly-unlimited': modeMap['truly-unlimited'] || 0
        }
      }
    );
  }
}

// ============================================================================
// 测试 3: 排除条件和过滤逻辑
// ============================================================================
async function test3_ExclusionLogic() {
  console.log('\n' + '='.repeat(80));
  console.log('🚫 测试 3: 排除条件和过滤逻辑');
  console.log('='.repeat(80) + '\n');

  const exclusionCount = await db.collection(COLLECTIONS.EXCLUSION_DETAILS).countDocuments();
  addTest(
    '排除详情记录总数',
    exclusionCount > 0 ? 'PASS' : 'WARN',
    { message: `${exclusionCount.toLocaleString()} 条排除记录` }
  );

  if (exclusionCount > 0) {
    // 3.1 按排除类型统计
    const typeDistribution = await db.collection(COLLECTIONS.EXCLUSION_DETAILS).aggregate([
      { $group: { _id: '$exclusion_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    const typeMap = {};
    typeDistribution.forEach(t => { typeMap[t._id] = t.count; });

    addTest(
      '排除类型分布',
      'PASS',
      {
        data: {
          和值: typeMap.sum_value || 0,
          跨度: typeMap.span_value || 0,
          区间比: typeMap.zone_ratio || 0,
          奇偶比: typeMap.odd_even_ratio || 0,
          热温冷比: typeMap.hot_warm_cold_ratio || 0,
          相克: typeMap.conflict_pair || 0,
          共现: typeMap.co_occurrence || 0
        }
      }
    );

    // 3.2 检查排除详情完整性
    const sample = await db.collection(COLLECTIONS.EXCLUSION_DETAILS).findOne({});
    const hasFields =
      sample.task_id &&
      sample.combination_id &&
      sample.exclusion_type &&
      sample.reason;

    addTest(
      '排除详情字段完整性',
      hasFields ? 'PASS' : 'FAIL',
      {
        data: {
          task_id: sample.task_id.substring(0, 8),
          combination_id: sample.combination_id,
          type: sample.exclusion_type,
          reason: sample.reason
        }
      }
    );
  }
}

// ============================================================================
// 测试 4: 命中统计和结果数据
// ============================================================================
async function test4_HitStatistics() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 测试 4: 命中统计和结果数据');
  console.log('='.repeat(80) + '\n');

  const resultCount = await db.collection(COLLECTIONS.RESULTS).countDocuments();
  addTest(
    '任务结果总数',
    resultCount > 0 ? 'PASS' : 'WARN',
    { message: `${resultCount.toLocaleString()} 条保留组合` }
  );

  if (resultCount > 0) {
    // 4.1 有命中的结果
    const withHits = await db.collection(COLLECTIONS.RESULTS).countDocuments({
      hit_count: { $gt: 0 }
    });

    addTest(
      '有命中的组合',
      withHits > 0 ? 'PASS' : 'WARN',
      { message: `${withHits.toLocaleString()} 个组合有命中` }
    );

    // 4.2 命中统计字段检查
    const sampleWithHit = await db.collection(COLLECTIONS.RESULTS).findOne({
      hit_count: { $gt: 0 }
    });

    if (sampleWithHit) {
      const hasHitFields =
        typeof sampleWithHit.hit_count === 'number' &&
        typeof sampleWithHit.hit_issues === 'object';

      addTest(
        '命中统计字段完整性',
        hasHitFields ? 'PASS' : 'FAIL',
        {
          data: {
            hit_count: sampleWithHit.hit_count,
            hit_issues: Object.keys(sampleWithHit.hit_issues || {}).length,
            prize_level: sampleWithHit.prize_level,
            prize_amount: sampleWithHit.prize_amount
          }
        }
      );

      // 4.3 奖级分布
      const prizeDistribution = await db.collection(COLLECTIONS.RESULTS).aggregate([
        { $match: { prize_level: { $exists: true, $ne: '未中奖' } } },
        { $group: { _id: '$prize_level', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      if (prizeDistribution.length > 0) {
        const prizeMap = {};
        prizeDistribution.forEach(p => { prizeMap[p._id] = p.count; });

        addTest(
          '中奖等级分布',
          'PASS',
          { data: prizeMap }
        );
      }
    }

    // 4.4 按任务统计结果
    const taskResults = await db.collection(COLLECTIONS.RESULTS).aggregate([
      { $group: { _id: '$task_id', count: { $sum: 1 }, hits: { $sum: '$hit_count' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();

    addTest(
      '前5个任务的结果统计',
      'PASS',
      {
        data: taskResults.map(t => ({
          task_id: t._id.substring(0, 8),
          保留组合: t.count,
          总命中: t.hits
        }))
      }
    );
  }
}

// ============================================================================
// 测试 5: 性能和索引
// ============================================================================
async function test5_PerformanceAndIndexes() {
  console.log('\n' + '='.repeat(80));
  console.log('⚡ 测试 5: 性能和索引');
  console.log('='.repeat(80) + '\n');

  const collectionsToCheck = [
    { name: COLLECTIONS.RED_COMBINATIONS, desc: '红球组合表' },
    { name: COLLECTIONS.HWC_OPTIMIZED, desc: '热温冷优化表' },
    { name: COLLECTIONS.TASKS, desc: '任务表' },
    { name: COLLECTIONS.RESULTS, desc: '结果表' }
  ];

  for (const coll of collectionsToCheck) {
    const indexes = await db.collection(coll.name).indexes();

    addTest(
      `${coll.desc} 索引`,
      indexes.length > 1 ? 'PASS' : 'WARN',
      {
        message: `${indexes.length} 个索引`,
        data: indexes.map(idx => idx.name)
      }
    );
  }

  // 数据库总大小
  const stats = await db.stats();
  addTest(
    '数据库大小',
    'PASS',
    { message: `${(stats.dataSize / 1024 / 1024 / 1024).toFixed(2)} GB` }
  );
}

// ============================================================================
// 测试 6: 数据一致性检查
// ============================================================================
async function test6_DataConsistency() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 测试 6: 数据一致性检查');
  console.log('='.repeat(80) + '\n');

  // 6.1 任务和结果关联
  const tasksWithResults = await db.collection(COLLECTIONS.TASKS).aggregate([
    {
      $lookup: {
        from: COLLECTIONS.RESULTS,
        localField: '_id',
        foreignField: 'task_id',
        as: 'results'
      }
    },
    {
      $match: { status: 'completed' }
    },
    {
      $project: {
        task_name: 1,
        status: 1,
        retained_count: 1,
        result_count: { $size: '$results' }
      }
    },
    { $limit: 5 }
  ]).toArray();

  let consistencyPass = true;
  for (const task of tasksWithResults) {
    const match = task.retained_count === task.result_count;
    if (!match) consistencyPass = false;

    addTest(
      `任务结果一致性: ${task.task_name}`,
      match ? 'PASS' : 'WARN',
      {
        data: {
          声称保留: task.retained_count,
          实际结果: task.result_count,
          匹配: match ? '✓' : '✗'
        }
      }
    );
  }

  // 6.2 热温冷优化表覆盖检查
  const dltIssues = await db.collection(COLLECTIONS.DLT_HISTORY)
    .find({}).sort({ issue: -1 }).limit(10).toArray();

  if (dltIssues.length >= 2) {
    const baseIssue = dltIssues[1].issue;
    const targetIssue = dltIssues[0].issue;

    const hwcForLatest = await db.collection(COLLECTIONS.HWC_OPTIMIZED).countDocuments({
      base_issue: baseIssue
    });

    addTest(
      `最新期号的HWC优化数据 (${baseIssue})`,
      hwcForLatest > 0 ? 'PASS' : 'WARN',
      {
        message: hwcForLatest > 0
          ? `${hwcForLatest.toLocaleString()} 条优化记录`
          : '无优化数据，需运行 update-hwc-optimized.js'
      }
    );
  }
}

// ============================================================================
// 主测试流程
// ============================================================================
async function runAllTests() {
  console.log('\n'.repeat(2));
  console.log('═'.repeat(80));
  console.log('🚀 大乐透热温冷正选批量预测 - 完整系统测试');
  console.log('═'.repeat(80));
  console.log(`\n测试时间: ${new Date().toLocaleString('zh-CN')}\n`);

  const connected = await connect();
  if (!connected) {
    console.log('\n❌ 无法连接到数据库，测试中止');
    process.exit(1);
  }

  try {
    await test1_DatabaseIntegrity();
    await test2_TaskSystem();
    await test3_ExclusionLogic();
    await test4_HitStatistics();
    await test5_PerformanceAndIndexes();
    await test6_DataConsistency();

  } finally {
    await client.close();
    console.log('\n🔌 已断开 MongoDB 连接');
  }

  // 生成测试报告
  console.log('\n'.repeat(2));
  console.log('═'.repeat(80));
  console.log('📊 测试报告摘要');
  console.log('═'.repeat(80));

  const total = report.tests.length;
  const passed = report.tests.filter(t => t.status === 'PASS').length;
  const failed = report.tests.filter(t => t.status === 'FAIL').length;
  const warnings = report.tests.filter(t => t.status === 'WARN').length;

  console.log(`\n总测试数: ${total}`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⚠️  警告: ${warnings}`);

  const successRate = ((passed / total) * 100).toFixed(1);
  console.log(`\n成功率: ${successRate}%`);

  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    report.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}`));
  }

  if (warnings > 0) {
    console.log('\n⚠️  警告的测试:');
    report.tests
      .filter(t => t.status === 'WARN')
      .forEach(t => console.log(`  - ${t.name}`));
  }

  console.log('\n' + '═'.repeat(80));

  // 保存报告
  const fs = require('fs');
  fs.writeFileSync(
    'hwc-system-test-report.json',
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('\n📄 详细报告已保存到: hwc-system-test-report.json');

  // 返回状态码
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(error => {
  console.error('\n💥 测试过程发生错误:', error);
  process.exit(1);
});
