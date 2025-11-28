const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

async function rebuildHwcOptimizedTable() {
  const startTime = performance.now();
  console.log('🔧 开始重建热温冷比优化表（基于记录ID）...');

  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 1. 删除现有表
    const deleteResult = await hwcCollection.deleteMany({});
    console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录`);

    // 2. 获取所有记录并按ID排序
    const hitDltsRecords = await hitDltsCollection
      .find({})
      .sort({ ID: 1 })
      .toArray();

    const hwcOptimizedRecords = [];

    // 3. 生成已开奖期号对
    for (let i = 0; i < hitDltsRecords.length - 1; i++) {
      hwcOptimizedRecords.push({
        base_id: hitDltsRecords[i].ID,
        base_issue: hitDltsRecords[i].Issue,
        target_id: hitDltsRecords[i + 1].ID,
        target_issue: hitDltsRecords[i + 1].Issue,
        is_predicted: false,
        created_at: new Date(),
        total_combinations: 324632
      });
    }

    // 4. 添加推算期记录
    const lastRecord = hitDltsRecords[hitDltsRecords.length - 1];
    const predictedRecord = {
      base_id: lastRecord.ID,
      base_issue: lastRecord.Issue,
      target_id: lastRecord.ID + 1,
      target_issue: String(parseInt(lastRecord.Issue) + 1),
      is_predicted: true,
      created_at: new Date(),
      total_combinations: 324632
    };
    hwcOptimizedRecords.push(predictedRecord);

    // 5. 批量插入
    const result = await hwcCollection.insertMany(hwcOptimizedRecords);
    console.log(`✅ 成功插入 ${result.insertedCount} 条记录`);

    const endTime = performance.now();
    console.log(`⏱️ 重建耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);

    // 6. 验证结果
    const finalCount = await hwcCollection.countDocuments();
    console.log(`📊 最终记录数: ${finalCount}`);
    console.log(`📊 预期记录数: ${hwcOptimizedRecords.length}`);

    // 7. 额外验证：打印最后两条记录
    const lastTwoRecords = await hwcCollection
      .find({})
      .sort({ base_id: -1 })
      .limit(2)
      .toArray();

    console.log('\n最后两条记录:');
    console.log(JSON.stringify(lastTwoRecords, null, 2));

  } catch (error) {
    console.error('❌ 重建过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

rebuildHwcOptimizedTable();