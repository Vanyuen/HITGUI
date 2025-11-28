const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 获取最新开奖期号
  const dltCollection = db.collection('hit_dlts');
  const latest = await dltCollection.findOne({}, { sort: { ID: -1 } });
  const latestIssue = parseInt(latest.Issue);
  console.log('最新开奖期号:', latestIssue);

  // 模拟generateIssuePairsForTargets的输入
  const resolvedIssues = ['25125', '25124', '25123', '25122', '25121', '25120', '25119', '25118', '25117', '25116', '25115'];
  console.log('\n输入的期号列表:', resolvedIssues);

  // 逐个检查期号是否存在
  console.log('\n检查期号存在性:');
  for (const issue of resolvedIssues) {
    const record = await dltCollection.findOne({ Issue: issue });
    if (record) {
      console.log('  期号', issue, '存在, ID:', record.ID);
    } else {
      console.log('  期号', issue, '不存在!');
    }
  }

  // 手动验证模拟generateIssuePairsForTargets的逻辑
  console.log('\n模拟generateIssuePairsForTargets:');
  for (let i = 0; i < resolvedIssues.length; i++) {
    const targetIssue = resolvedIssues[i];
    const targetIssueNum = parseInt(targetIssue);
    const isPredicted = targetIssueNum > latestIssue;

    console.log('  处理', targetIssue, '(isPredicted:', isPredicted + ')');

    // 校验目标期号是否存在
    if (!isPredicted) {
      const targetExists = await dltCollection.findOne({ Issue: targetIssue });
      if (!targetExists) {
        console.log('    跳过：目标期号不存在');
        continue;
      }
    } else {
      if (targetIssueNum > latestIssue + 1) {
        console.log('    跳过：超出推算范围');
        continue;
      }
    }

    // 确定基准期
    let baseIssue = null;
    if (i === resolvedIssues.length - 1) {
      // 最后一个期号，需要查询数据库
      const previousRecord = await dltCollection.findOne({
        Issue: { $lt: targetIssue }
      }).sort({ ID: -1 });
      if (previousRecord) {
        baseIssue = previousRecord.Issue;
        console.log('    → 基准期:', baseIssue, '(从数据库)');
      } else {
        console.log('    跳过：无前置基准期');
        continue;
      }
    } else {
      // 使用下一个元素作为基准期
      baseIssue = resolvedIssues[i + 1];

      // 校验基准期是否存在
      if (!isPredicted) {
        const baseExists = await dltCollection.findOne({ Issue: baseIssue });
        if (!baseExists) {
          console.log('    跳过：基准期不存在', baseIssue);
          continue;
        }
      }
      console.log('    → 基准期:', baseIssue, '(从数组)');
    }
  }

  mongoose.disconnect();
}).catch(e => console.error(e));
