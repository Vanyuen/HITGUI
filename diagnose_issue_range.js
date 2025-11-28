const mongoose = require('mongoose');

async function diagnoseIssueRange() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 获取所有期号并排序
    const allIssues = await hitDltsCollection
      .find({}, { projection: { Issue: 1, _id: 0 } })
      .sort({ Issue: 1 })
      .toArray();

    const issueList = allIssues.map(item => item.Issue);

    console.log('🔢 总期号数量:', issueList.length);
    console.log('📅 期号范围:', issueList[0], '-', issueList[issueList.length - 1]);

    // 检查当前热温冷比优化表
    const hwcCount = await hwcCollection.countDocuments();
    console.log('📊 热温冷比优化表记录数:', hwcCount);

    // 分析推算逻辑
    const expectedPairs = issueList.length - 1;
    console.log('📝 预期期号对数:', expectedPairs);

    // 打印最后几期详细信息
    console.log('\n最后5期详细信息:');
    const lastFiveIssues = issueList.slice(-5);
    lastFiveIssues.forEach((issue, index) => {
      console.log(`期号 ${index + 1}: ${issue}`);
    });

    // 计算下一期
    const latestIssue = issueList[issueList.length - 1];
    const nextIssue = String(parseInt(latestIssue) + 1);
    console.log('\n🔮 推算下一期:', nextIssue);

  } catch (error) {
    console.error('❌ 诊断过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

diagnoseIssueRange();