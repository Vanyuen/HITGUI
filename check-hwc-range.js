const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds', new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }));

    // 检查25114-25124范围的热温冷数据
    console.log('=== 检查25107-25125范围的热温冷数据 ===');
    for (let i = 25107; i <= 25125; i++) {
      const baseIssue = (i - 1).toString();
      const targetIssue = i.toString();
      const hwcRecord = await HwcOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
      }).select('base_issue target_issue').lean();
      console.log(`${baseIssue} -> ${targetIssue}: ${hwcRecord ? '✅存在' : '❌不存在'}`);
    }

    // 统计热温冷优化表的总数和最新target_issue
    const count = await HwcOptimized.countDocuments();
    console.log('\n热温冷优化表总记录数:', count);

    // 查最新的几条（使用索引优化）
    const latest = await HwcOptimized.find({
      target_issue: { $gte: '25100' }
    }).select('base_issue target_issue').lean();
    console.log('\ntarget_issue >= 25100 的记录数:', latest.length);
    if (latest.length > 0) {
      latest.sort((a, b) => parseInt(b.target_issue) - parseInt(a.target_issue));
      console.log('最新5条:');
      latest.slice(0, 5).forEach(h => {
        console.log(`  ${h.base_issue} -> ${h.target_issue}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

diagnose();
