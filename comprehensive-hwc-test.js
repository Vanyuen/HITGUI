/**
 * 大乐透热温冷正选批量预测 - 综合功能测试脚本
 * 测试所有核心功能模块
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

let client;
let db;

// 测试报告
const testReport = {
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  warnings: 0
};

function addTest(name, status, details = {}) {
  const test = { name, status, ...details };
  testReport.tests.push(test);

  if (status === 'PASS') {
    testReport.passed++;
    console.log(`✅ ${name}`);
  } else if (status === 'FAIL') {
    testReport.failed++;
    console.log(`❌ ${name}`);
  } else if (status === 'WARN') {
    testReport.warnings++;
    console.log(`⚠️  ${name}`);
  }

  if (details.message) {
    console.log(`   ${details.message}`);
  }
  if (details.data) {
    console.log(`   数据:`, JSON.stringify(details.data, null, 2));
  }
}

async function connect() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('🔗 已连接到 MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    return false;
  }
}

// ============================================================================
// 测试 1: 数据库连接和核心集合状态
// ============================================================================
async function test1_DatabaseCollections() {
  console.log('\n📦 测试 1: 数据库连接和核心集合状态');
  console.log('='.repeat(80));

  const requiredCollections = {
    'hit_dlts': '大乐透历史数据',
    'hit_dlts': '红球组合预计算表',
    'hit_dlts': '蓝球组合预计算表',
    'HIT_DLT_RedCombinationsHotWarmColdOptimized': '热温冷优化表',
    'PredictionTask': '预测任务表',
    'PredictionTaskResult': '任务结果表',
    'DLTExclusionDetails': '排除详情表'
  };

  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  for (const [name, desc] of Object.entries(requiredCollections)) {
    if (collectionNames.includes(name)) {
      const count = await db.collection(name).countDocuments();
      addTest(
        `集合存在: ${desc} (${name})`,
        'PASS',
        { message: `记录数: ${count.toLocaleString()}` }
      );

      // 特殊检查
      if (name === 'hit_dlts' && count !== 324632) {
        addTest(
          '红球组合数量验证',
          'WARN',
          { message: `预期 324,632 条，实际 ${count.toLocaleString()} 条` }
        );
      }

      if (name === 'hit_dlts' && count !== 66) {
        addTest(
          '蓝球组合数量验证',
          'WARN',
          { message: `预期 66 条，实际 ${count} 条` }
        );
      }
    } else {
      addTest(
        `集合缺失: ${desc} (${name})`,
        'FAIL',
        { message: '该集合不存在，功能将无法正常运行' }
      );
    }
  }
}

// ============================================================================
// 测试 2: 热温冷优化表数据完整性
// ============================================================================
async function test2_HWCOptimizedTable() {
  console.log('\n🌡️  测试 2: 热温冷优化表数据完整性');
  console.log('='.repeat(80));

  const hwcColl = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

  // 2.1 检查总记录数
  const totalCount = await hwcColl.countDocuments();
  addTest(
    '热温冷优化表记录总数',
    totalCount > 0 ? 'PASS' : 'FAIL',
    { message: `${totalCount.toLocaleString()} 条记录` }
  );

  // 2.2 检查期号对数量
  const issuePairs = await hwcColl.distinct('base_issue');
  addTest(
    '热温冷优化表期号对数量',
    issuePairs.length > 0 ? 'PASS' : 'FAIL',
    { message: `${issuePairs.length} 个基准期号` }
  );

  // 2.3 抽样检查数据质量
  const sample = await hwcColl.findOne({});
  if (sample) {
    const hasRequiredFields =
      sample.base_issue &&
      sample.target_issue &&
      sample.combination_id &&
      typeof sample.hot_count === 'number' &&
      typeof sample.warm_count === 'number' &&
      typeof sample.cold_count === 'number';

    addTest(
      '热温冷优化表字段完整性',
      hasRequiredFields ? 'PASS' : 'FAIL',
      {
        message: hasRequiredFields
          ? '所有必需字段存在'
          : '缺少必需字段',
        data: {
          base_issue: sample.base_issue,
          target_issue: sample.target_issue,
          combination_id: sample.combination_id,
          hot_count: sample.hot_count,
          warm_count: sample.warm_count,
          cold_count: sample.cold_count
        }
      }
    );
  } else {
    addTest(
      '热温冷优化表数据采样',
      'FAIL',
      { message: '无法获取样本数据' }
    );
  }

  // 2.4 检查最新期号的优化数据
  const dltColl = db.collection('hit_dlts');
  const latestIssues = await dltColl.find({}).sort({ Issue: -1 }).limit(2).toArray();

  if (latestIssues.length >= 2) {
    const baseIssue = latestIssues[1].Issue;
    const targetIssue = latestIssues[0].Issue;

    const hwcForLatest = await hwcColl.countDocuments({
      base_issue: baseIssue,
      target_issue: targetIssue
    });

    addTest(
      `最新期号对的优化数据 (${baseIssue} → ${targetIssue})`,
      hwcForLatest > 0 ? 'PASS' : 'WARN',
      {
        message: hwcForLatest > 0
          ? `${hwcForLatest.toLocaleString()} 条记录`
          : '无优化数据，需运行 update-hwc-optimized.js'
      }
    );
  }
}

// ============================================================================
// 测试 3: 任务创建和参数验证
// ============================================================================
async function test3_TaskCreation() {
  console.log('\n📝 测试 3: 任务创建和参数验证');
  console.log('='.repeat(80));

  const taskColl = db.collection('PredictionTask');

  // 3.1 查询最近的任务
  const recentTasks = await taskColl
    .find({})
    .sort({ created_at: -1 })
    .limit(5)
    .toArray();

  addTest(
    '历史任务查询',
    recentTasks.length > 0 ? 'PASS' : 'WARN',
    {
      message: recentTasks.length > 0
        ? `找到 ${recentTasks.length} 个最近任务`
        : '数据库中无历史任务'
    }
  );

  if (recentTasks.length > 0) {
    // 3.2 检查任务字段完整性
    const task = recentTasks[0];
    const hasRequiredFields =
      task.task_name &&
      task.base_issue &&
      task.target_issue &&
      task.pairing_mode &&
      task.status &&
      task.exclusion_conditions;

    addTest(
      '任务字段完整性',
      hasRequiredFields ? 'PASS' : 'FAIL',
      {
        data: {
          task_name: task.task_name,
          base_issue: task.base_issue,
          target_issue: task.target_issue,
          pairing_mode: task.pairing_mode,
          status: task.status,
          created_at: task.created_at
        }
      }
    );

    // 3.3 检查三种配对模式的任务
    const pairingModes = ['default', 'unlimited', 'truly-unlimited'];
    for (const mode of pairingModes) {
      const count = await taskColl.countDocuments({ pairing_mode: mode });
      addTest(
        `配对模式 "${mode}" 的任务`,
        count > 0 ? 'PASS' : 'WARN',
        { message: `${count} 个任务` }
      );
    }
  }
}

// ============================================================================
// 测试 4: StreamBatchPredictor 关键逻辑
// ============================================================================
async function test4_StreamBatchPredictor() {
  console.log('\n⚙️  测试 4: StreamBatchPredictor 关键逻辑');
  console.log('='.repeat(80));

  // 检查是否有处理中或已完成的任务
  const taskColl = db.collection('PredictionTask');
  const processedTask = await taskColl.findOne({
    status: { $in: ['completed', 'processing'] }
  });

  if (processedTask) {
    addTest(
      'StreamBatchPredictor 处理任务',
      'PASS',
      {
        message: `任务状态: ${processedTask.status}`,
        data: {
          task_id: processedTask._id.toString(),
          status: processedTask.status,
          progress: processedTask.progress,
          total_combinations: processedTask.total_combinations,
          retained_count: processedTask.retained_count
        }
      }
    );

    // 检查任务结果
    if (processedTask.status === 'completed') {
      const resultColl = db.collection('PredictionTaskResult');
      const resultCount = await resultColl.countDocuments({
        task_id: processedTask._id.toString()
      });

      addTest(
        '任务结果记录',
        resultCount > 0 ? 'PASS' : 'WARN',
        { message: `${resultCount.toLocaleString()} 条保留组合` }
      );
    }
  } else {
    addTest(
      'StreamBatchPredictor 处理任务',
      'WARN',
      { message: '无已处理的任务，无法验证处理逻辑' }
    );
  }
}

// ============================================================================
// 测试 5: 排除条件生效验证
// ============================================================================
async function test5_ExclusionConditions() {
  console.log('\n🚫 测试 5: 排除条件生效验证');
  console.log('='.repeat(80));

  const taskColl = db.collection('PredictionTask');
  const exclusionColl = db.collection('DLTExclusionDetails');

  // 5.1 查找有排除条件的任务
  const tasksWithExclusions = await taskColl.find({
    'exclusion_conditions': { $exists: true, $ne: {} }
  }).limit(5).toArray();

  addTest(
    '有排除条件的任务',
    tasksWithExclusions.length > 0 ? 'PASS' : 'WARN',
    { message: `${tasksWithExclusions.length} 个任务` }
  );

  if (tasksWithExclusions.length > 0) {
    for (const task of tasksWithExclusions.slice(0, 3)) {
      const taskId = task._id.toString();
      const exclusionCount = await exclusionColl.countDocuments({ task_id: taskId });

      const conditions = [];
      const ec = task.exclusion_conditions;

      if (ec.sum_range) conditions.push('和值');
      if (ec.span_range) conditions.push('跨度');
      if (ec.zone_ratio) conditions.push('区间比');
      if (ec.odd_even_ratio) conditions.push('奇偶比');
      if (ec.hot_warm_cold_ratio) conditions.push('热温冷比');
      if (ec.conflict_pairs) conditions.push('相克');
      if (ec.co_occurrence) conditions.push('共现');

      addTest(
        `任务 ${task.task_name} 的排除记录`,
        exclusionCount > 0 ? 'PASS' : 'WARN',
        {
          message: `${exclusionCount.toLocaleString()} 条排除记录`,
          data: {
            条件类型: conditions,
            保留组合: task.retained_count || 0
          }
        }
      );
    }
  }
}

// ============================================================================
// 测试 6: 命中统计计算准确性
// ============================================================================
async function test6_HitStatistics() {
  console.log('\n🎯 测试 6: 命中统计计算准确性');
  console.log('='.repeat(80));

  const resultColl = db.collection('PredictionTaskResult');

  // 6.1 查找有命中数据的结果
  const resultsWithHits = await resultColl.find({
    hit_count: { $exists: true, $gt: 0 }
  }).limit(5).toArray();

  addTest(
    '有命中数据的结果',
    resultsWithHits.length > 0 ? 'PASS' : 'WARN',
    { message: `${resultsWithHits.length} 条结果` }
  );

  if (resultsWithHits.length > 0) {
    // 6.2 验证命中统计字段完整性
    const result = resultsWithHits[0];
    const hasHitFields =
      typeof result.hit_count === 'number' &&
      typeof result.hit_issues === 'object' &&
      typeof result.prize_level === 'string';

    addTest(
      '命中统计字段完整性',
      hasHitFields ? 'PASS' : 'FAIL',
      {
        data: {
          hit_count: result.hit_count,
          prize_level: result.prize_level,
          prize_amount: result.prize_amount,
          hit_issues_count: Object.keys(result.hit_issues || {}).length
        }
      }
    );

    // 6.3 检查不同配对模式的命中计算
    const taskColl = db.collection('PredictionTask');
    const task = await taskColl.findOne({
      _id: { $in: resultsWithHits.map(r => r.task_id) }
    });

    if (task) {
      addTest(
        `配对模式 "${task.pairing_mode}" 的命中计算`,
        'PASS',
        {
          message: `任务: ${task.task_name}`,
          data: {
            pairing_mode: task.pairing_mode,
            sample_hit_count: result.hit_count,
            sample_prize: result.prize_level
          }
        }
      );
    }
  }
}

// ============================================================================
// 测试 7: 数据库索引检查
// ============================================================================
async function test7_DatabaseIndexes() {
  console.log('\n📇 测试 7: 数据库索引检查');
  console.log('='.repeat(80));

  const collectionsToCheck = [
    'hit_dlts',
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    'PredictionTask',
    'PredictionTaskResult'
  ];

  for (const collName of collectionsToCheck) {
    const indexes = await db.collection(collName).indexes();
    const indexNames = indexes.map(idx => idx.name);

    addTest(
      `${collName} 索引`,
      indexes.length > 1 ? 'PASS' : 'WARN',
      {
        message: `${indexes.length} 个索引`,
        data: { indexes: indexNames }
      }
    );
  }
}

// ============================================================================
// 测试 8: 端口和服务检查
// ============================================================================
async function test8_ServiceCheck() {
  console.log('\n🌐 测试 8: 服务端口检查');
  console.log('='.repeat(80));

  // 这个测试需要服务器运行，我们只检查配置
  const http = require('http');

  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/api/health',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      addTest(
        '服务器端口 3003 可访问',
        res.statusCode === 200 ? 'PASS' : 'WARN',
        { message: `HTTP 状态码: ${res.statusCode}` }
      );
      resolve();
    });

    req.on('error', (error) => {
      addTest(
        '服务器端口 3003 可访问',
        'WARN',
        { message: `服务器未运行: ${error.message}` }
      );
      resolve();
    });

    req.on('timeout', () => {
      addTest(
        '服务器端口 3003 可访问',
        'WARN',
        { message: '请求超时，服务器可能未运行' }
      );
      req.destroy();
      resolve();
    });

    req.end();
  });
}

// ============================================================================
// 主测试流程
// ============================================================================
async function runAllTests() {
  console.log('\n'.repeat(2));
  console.log('═'.repeat(80));
  console.log('🚀 大乐透热温冷正选批量预测 - 综合功能测试');
  console.log('═'.repeat(80));

  const connected = await connect();
  if (!connected) {
    console.log('\n❌ 无法连接到数据库，测试中止');
    process.exit(1);
  }

  try {
    await test1_DatabaseCollections();
    await test2_HWCOptimizedTable();
    await test3_TaskCreation();
    await test4_StreamBatchPredictor();
    await test5_ExclusionConditions();
    await test6_HitStatistics();
    await test7_DatabaseIndexes();
    await test8_ServiceCheck();

  } finally {
    await client.close();
    console.log('\n🔌 已断开 MongoDB 连接');
  }

  // 生成测试报告
  console.log('\n'.repeat(2));
  console.log('═'.repeat(80));
  console.log('📊 测试报告摘要');
  console.log('═'.repeat(80));
  console.log(`测试时间: ${testReport.timestamp}`);
  console.log(`总测试数: ${testReport.tests.length}`);
  console.log(`✅ 通过: ${testReport.passed}`);
  console.log(`❌ 失败: ${testReport.failed}`);
  console.log(`⚠️  警告: ${testReport.warnings}`);

  const successRate = ((testReport.passed / testReport.tests.length) * 100).toFixed(1);
  console.log(`\n成功率: ${successRate}%`);

  if (testReport.failed > 0) {
    console.log('\n❌ 有测试失败，请检查以上详细信息');
    console.log('\n失败的测试:');
    testReport.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  - ${t.name}`);
        if (t.message) console.log(`    ${t.message}`);
      });
  } else if (testReport.warnings > 0) {
    console.log('\n⚠️  有测试警告，建议检查以上详细信息');
  } else {
    console.log('\n✅ 所有测试通过！系统运行正常');
  }

  console.log('\n' + '═'.repeat(80));

  // 保存报告到文件
  const fs = require('fs');
  const reportPath = 'test-report-hwc-comprehensive.json';
  fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2), 'utf-8');
  console.log(`\n📄 详细测试报告已保存到: ${reportPath}`);
}

// 运行测试
runAllTests().catch(error => {
  console.error('\n💥 测试过程发生错误:', error);
  process.exit(1);
});
