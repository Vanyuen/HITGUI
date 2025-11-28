const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    // 模拟用户选择的期号范围
    const resolvedIssues = ['25125', '25124', '25123', '25122', '25121', '25120', '25119', '25118', '25117', '25116', '25115'];
    const latestIssue = 25124;

    console.log('=== 测试期号对生成逻辑 ===');
    console.log('输入期号（降序）:', resolvedIssues);
    console.log('最新已开奖期号:', latestIssue);
    console.log('');

    const pairs = [];

    for (let i = 0; i < resolvedIssues.length; i++) {
      const targetIssue = resolvedIssues[i];
      const targetIssueNum = parseInt(targetIssue);
      const isPredicted = targetIssueNum > latestIssue;

      console.log(`\n处理目标期号: ${targetIssue} (isPredicted: ${isPredicted})`);

      // 检查目标期号是否存在
      if (!isPredicted) {
        const targetExists = await hit_dlts.findOne({ Issue: targetIssue.toString() }).select('ID').lean();
        if (!targetExists) {
          console.log(`  ❌ 目标期号不存在，跳过`);
          continue;
        } else {
          console.log(`  ✅ 目标期号存在`);
        }
      } else {
        console.log(`  🔮 推算期`);
      }

      let baseIssue = null;

      if (i === resolvedIssues.length - 1) {
        // 最后一个：查询数据库
        const previousRecord = await hit_dlts.findOne({
          Issue: { $lt: targetIssue.toString() }
        }).sort({ ID: -1 }).select('Issue').lean();

        if (previousRecord) {
          baseIssue = previousRecord.Issue.toString();
          console.log(`  📍 基准期（查DB）: ${baseIssue}`);
        } else {
          console.log(`  ❌ 无基准期，跳过`);
          continue;
        }
      } else {
        // 其他：使用下一个元素
        baseIssue = resolvedIssues[i + 1];
        console.log(`  📍 基准期（数组）: ${baseIssue}`);

        // 检查基准期是否存在
        if (!isPredicted) {
          const baseExists = await hit_dlts.findOne({ Issue: baseIssue.toString() }).select('ID').lean();
          if (!baseExists) {
            console.log(`  ❌ 基准期不存在，跳过`);
            continue;
          } else {
            console.log(`  ✅ 基准期存在`);
          }
        }
      }

      console.log(`  ➡️ 生成期号对: ${baseIssue} -> ${targetIssue}`);
      pairs.push({
        base: baseIssue,
        target: targetIssue,
        isPredicted: isPredicted
      });
    }

    console.log('\n=== 最终结果 ===');
    console.log('生成的期号对数量:', pairs.length);
    pairs.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.base} -> ${p.target} (isPredicted: ${p.isPredicted})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

test();
