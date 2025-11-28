const mongoose = require('mongoose');

async function investigateExtraRecords() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 获取所有记录，按base_issue排序
    const allRecords = await collection.find({}).sort({ base_issue: 1 }).toArray();

    console.log('🔢 总记录数:', allRecords.length);

    // 打印第一条和最后两条记录的详细信息
    console.log('\n第一条记录:');
    console.log(allRecords[0]);

    console.log('\n最后两条记录:');
    console.log(allRecords[allRecords.length - 2]);
    console.log(allRecords[allRecords.length - 1]);

    // 检查是否有重复的期号对
    const baseIssueCounts = {};
    const targetIssueCounts = {};

    allRecords.forEach(record => {
      baseIssueCounts[record.base_issue] = (baseIssueCounts[record.base_issue] || 0) + 1;
      targetIssueCounts[record.target_issue] = (targetIssueCounts[record.target_issue] || 0) + 1;
    });

    console.log('\n重复的base_issue:');
    Object.entries(baseIssueCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([issue, count]) => console.log(`期号 ${issue}: ${count}次`));

    console.log('\n重复的target_issue:');
    Object.entries(targetIssueCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([issue, count]) => console.log(`期号 ${issue}: ${count}次`));

  } catch (error) {
    console.error('❌ 调查出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

investigateExtraRecords();