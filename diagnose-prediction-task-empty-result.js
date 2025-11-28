const mongoose = require('mongoose');

async function diagnosePredictionTaskEmptyResult(taskId) {
  console.log(`🔍 开始诊断任务 ${taskId} 结果为空的原因`);

  try {
    // 1. 获取任务详情
    const tasksCollection = mongoose.connection.db.collection('PredictionTask');

    // 尝试多种查询方式
    const task = await tasksCollection.findOne({
      $or: [
        { _id: taskId },
        { taskId: taskId },
        { name: taskId }
      ]
    });

    if (!task) {
      console.error(`❌ 未找到任务 ID: ${taskId}`);

      // 列出所有任务，帮助诊断
      const allTasks = await tasksCollection.find().toArray();
      console.log('🔍 系统中的所有任务:');
      allTasks.forEach(t => {
        console.log(`- 任务ID: ${t._id}, 名称: ${t.name || '未命名'}, 状态: ${t.status}`);
      });

      return;
    }

    console.log('📋 任务基本信息:', {
      baseIssue: task.baseIssue,
      targetIssue: task.targetIssue,
      status: task.status,
      taskId: task._id
    });

    // 2. 检查期号有效性
    const issueValidation = await validateIssueRange(task.baseIssue, task.targetIssue);
    console.log('🔢 期号验证结果:', JSON.stringify(issueValidation, null, 2));

    // 3. 分析排除条件
    const exclusionAnalysis = await analyzeExclusionConditions(task);
    console.log('🚫 排除条件分析:', JSON.stringify(exclusionAnalysis, null, 2));

    // 4. 组合生成诊断
    const combinationDiagnosis = await diagnoseCombinationGeneration(task);
    console.log('📊 组合生成诊断:', JSON.stringify(combinationDiagnosis, null, 2));

  } catch (error) {
    console.error('💥 诊断过程中发生错误:', error);
  }
}

async function validateIssueRange(baseIssue, targetIssue) {
  const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');

  const baseIssueExists = await hitDltsCollection.findOne({ Issue: baseIssue });
  const targetIssueExists = await hitDltsCollection.findOne({ Issue: targetIssue });

  return {
    baseIssueFound: !!baseIssueExists,
    targetIssueFound: !!targetIssueExists,
    totalHistoricalIssues: await hitDltsCollection.countDocuments(),
    baseIssueDetails: baseIssueExists,
    targetIssueDetails: targetIssueExists
  };
}

async function analyzeExclusionConditions(task) {
  const redCombosCollection = mongoose.connection.db.collection('hit_dlt_redcombinations');
  const blueCombosCollection = mongoose.connection.db.collection('hit_dlt_bluecombinations');

  // 分析各种排除条件的影响
  return {
    hotWarmColdRatio: task.hotWarmColdRatio || '未指定',
    sumRange: task.sumRange || '未指定',
    spanRange: task.spanRange || '未指定',
    parityRatio: task.parityRatio || '未指定',
    acValue: task.acValue || '未指定',
    historicalExclusion: {
      sumExclusion: task.historicalSumExclusion || '未指定',
      spanExclusion: task.historicalSpanExclusion || '未指定',
      serialNumberExclusion: task.serialNumberExclusion || '未指定'
    },
    redCombosBeforeExclusion: await redCombosCollection.countDocuments(),
    blueCombosBeforeExclusion: await blueCombosCollection.countDocuments()
  };
}

async function diagnoseCombinationGeneration(task) {
  const redCombosCollection = mongoose.connection.db.collection('hit_dlt_redcombinations');
  const blueCombosCollection = mongoose.connection.db.collection('hit_dlt_bluecombinations');

  // 模拟组合筛选过程的详细分析
  const totalRedCombos = await redCombosCollection.countDocuments();
  const totalBlueCombos = await blueCombosCollection.countDocuments();

  // 抽样分析
  const sampleRedCombo = await redCombosCollection.findOne();
  const sampleBlueCombo = await blueCombosCollection.findOne();

  // 检查热温冷优化表
  const hwcOptimizedCollection = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimizeds');
  const hwcOptimizedCount = await hwcOptimizedCollection.countDocuments();

  return {
    totalRedCombinations: totalRedCombos,
    totalBlueCombinations: totalBlueCombos,
    sampleRedCombo,
    sampleBlueCombo,
    hotWarmColdOptimizedCount: hwcOptimizedCount
  };
}

// 主执行函数
(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 数据库连接成功');

    await diagnosePredictionTaskEmptyResult('hwc-pos-20251124-9k6');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  } finally {
    await mongoose.connection.close();
  }
})();