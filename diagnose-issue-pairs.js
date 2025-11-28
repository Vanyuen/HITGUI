const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' }));
    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    // 获取最新任务
    const task = await Task.findOne().sort({ created_at: -1 }).lean();
    console.log('=== 最新任务的期号对 ===');
    console.log('issue_pairs:', JSON.stringify(task.issue_pairs, null, 2));
    console.log('issue_pairs 长度:', task.issue_pairs?.length);

    // 检查热温冷优化表中是否存在这些期号对
    console.log('\n=== 检查热温冷优化表 ===');

    // 检查任务中的期号对
    if (task.issue_pairs) {
      for (const pair of task.issue_pairs) {
        const hwcRecord = await HwcOptimized.findOne({
          base_issue: pair.base,
          target_issue: pair.target
        }).lean();

        console.log(`\n期号对: ${pair.base} -> ${pair.target}`);
        console.log('  热温冷数据存在:', !!hwcRecord);
        if (hwcRecord) {
          const ratioKeys = Object.keys(hwcRecord.hot_warm_cold_data || {});
          console.log('  比例数量:', ratioKeys.length);
          // 检查 4:1:0
          const ids = hwcRecord.hot_warm_cold_data['4:1:0'];
          console.log('  4:1:0 组合数:', ids?.length || 0);
        }
      }
    }

    // 结果有19条，但任务只有1个issue_pair
    // 这说明任务处理逻辑有问题 - 可能在错误地生成issue_pairs

    // 检查最近20个热温冷记录
    console.log('\n=== 热温冷优化表最新20条记录（按数字排序）===');
    const allHwc = await HwcOptimized.find({}).lean();
    // 按数字排序
    allHwc.sort((a, b) => parseInt(b.target_issue) - parseInt(a.target_issue));
    allHwc.slice(0, 20).forEach(h => {
      console.log(`base: ${h.base_issue} -> target: ${h.target_issue}`);
    });

    // 检查25114到25124的期号对是否存在
    console.log('\n=== 检查25114-25124范围的热温冷数据 ===');
    for (let i = 25114; i <= 25124; i++) {
      const baseIssue = (i - 1).toString();
      const targetIssue = i.toString();
      const hwcRecord = await HwcOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
      }).lean();
      console.log(`${baseIssue} -> ${targetIssue}: ${hwcRecord ? '✅存在' : '❌不存在'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
