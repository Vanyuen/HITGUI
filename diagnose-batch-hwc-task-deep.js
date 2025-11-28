const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const Result = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontaskresults' }));
    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    // 1. 检查任务详情
    const task = await Task.findOne().lean();
    console.log('=== 热温冷批量预测任务详情 ===');
    console.log('任务ID:', task._id);
    console.log('task_id 字段:', task.task_id);
    console.log('任务名称:', task.task_name);
    console.log('状态:', task.status);
    console.log('issues字段:', task.issues);
    console.log('issue_pairs字段:', task.issue_pairs);
    console.log('positive_selection:', JSON.stringify(task.positive_selection, null, 2));
    console.log('progress:', task.progress);
    console.log('statistics:', task.statistics);
    console.log('error_message:', task.error_message);
    console.log();

    // 2. 用两种task_id格式查询结果
    console.log('=== 查询结果（尝试两种task_id格式）===');

    // 方式1: 使用 _id.toString()
    const results1 = await Result.find({ task_id: task._id.toString() }).lean();
    console.log(`使用 task._id.toString() 查询结果: ${results1.length} 条`);

    // 方式2: 使用 task.task_id
    const results2 = await Result.find({ task_id: task.task_id }).lean();
    console.log(`使用 task.task_id 查询结果: ${results2.length} 条`);

    // 方式3: 直接查询所有结果看看有什么
    const allResults = await Result.find({}).limit(5).lean();
    console.log(`\n所有结果样本（前5条）:`);
    allResults.forEach((r, idx) => {
      console.log(`${idx + 1}. task_id: ${r.task_id}, period: ${r.period}, combination_count: ${r.combination_count}`);
    });

    // 3. 检查热温冷优化表数据
    console.log('\n=== 热温冷优化表数据 ===');
    const hwcCount = await HwcOptimized.countDocuments();
    console.log('总记录数:', hwcCount);

    // 检查期号对是否存在
    if (task.issue_pairs && task.issue_pairs.length > 0) {
      const firstPair = task.issue_pairs[0];
      console.log('\n检查第一个期号对:', firstPair);
      const hwcRecord = await HwcOptimized.findOne({
        base_issue: firstPair.base,
        target_issue: firstPair.target
      }).lean();
      console.log('热温冷数据存在:', !!hwcRecord);
      if (hwcRecord) {
        console.log('热温冷数据keys:', Object.keys(hwcRecord.hot_warm_cold_data || {}));
      }
    }

    // 查看热温冷表的结构
    const sampleHwc = await HwcOptimized.findOne().lean();
    console.log('\n热温冷表样本:');
    console.log('base_issue:', sampleHwc?.base_issue);
    console.log('target_issue:', sampleHwc?.target_issue);
    console.log('hot_warm_cold_data keys:', Object.keys(sampleHwc?.hot_warm_cold_data || {}));

    // 4. 检查结果的实际结构
    if (allResults.length > 0) {
      console.log('\n=== 结果数据结构 ===');
      const r = allResults[0];
      console.log('字段列表:', Object.keys(r));
      console.log('hit_analysis:', r.hit_analysis);
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
