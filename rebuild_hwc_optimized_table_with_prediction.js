const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

async function rebuildHwcOptimizedTable() {
  const startTime = performance.now();
  console.log('🔧 开始重建热温冷比优化表（包含推算期）...');

  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 1. 删除现有表
    const deleteResult = await hwcCollection.deleteMany({});
    console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录`);

    // 2. 获取所有期号并排序
    const allIssues = await hitDltsCollection
      .find({}, { projection: { Issue: 1, _id: 0 } })
      .sort({ Issue: 1 })
      .toArray();

    const issueList = allIssues.map(item => item.Issue);

    // 3. 计算下一期（推算期）
    const latestIssue = issueList[issueList.length - 1];
    const nextIssue = String(parseInt(latestIssue) + 1);

    console.log(`🔍 最新期号: ${latestIssue}, 推算期: ${nextIssue}`);

    // 4. 重建表
    const bulkOps = [];

    // 添加所有已开奖期号对
    for (let i = 0; i < issueList.length - 1; i++) {
      const baseIssue = issueList[i];
      const targetIssue = issueList[i + 1];

      bulkOps.push({
        insertOne: {
          document: {
            base_issue: baseIssue,
            target_issue: targetIssue,
            is_predicted: false,
            created_at: new Date(),
            total_combinations: 324632  // 固定值
          }
        }
      });
    }

    // 添加推算期记录
    bulkOps.push({
      insertOne: {
        document: {
          base_issue: latestIssue,
          target_issue: nextIssue,
          is_predicted: true,
          created_at: new Date(),
          total_combinations: 324632  // 固定值
        }
      }
    });

    // 批量写入
    if (bulkOps.length > 0) {
      const result = await hwcCollection.bulkWrite(bulkOps);
      console.log(`✅ 成功插入 ${result.insertedCount} 条新记录`);
    }

    const endTime = performance.now();
    console.log(`⏱️ 重建耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);

    // 验证结果
    const finalCount = await hwcCollection.countDocuments();
    console.log(`📊 最终记录数: ${finalCount}`);
    console.log(`📊 预期记录数: ${issueList.length}`);

  } catch (error) {
    console.error('❌ 重建过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

rebuildHwcOptimizedTable();