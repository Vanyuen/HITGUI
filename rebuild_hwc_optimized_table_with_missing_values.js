const mongoose = require('mongoose');

// 定义热温冷比分类函数
function classifyMissingValue(missingValue) {
  if (missingValue <= 4) return 'hot';    // 热
  if (missingValue <= 9) return 'warm';   // 温
  return 'cold';                          // 冷
}

async function rebuildHwcOptimizedTableWithMissingValues() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const redCombinationsCollection = mongoose.connection.db.collection('hit_dlt_redcombinations');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 删除现有表
    await hwcCollection.deleteMany({});

    // 获取所有期号记录
    const hitDltsRecords = await hitDltsCollection
      .find({})
      .sort({ ID: 1 })
      .toArray();

    const bulkOps = [];

    // 遍历期号记录
    for (let i = 0; i < hitDltsRecords.length - 1; i++) {
      const baseRecord = hitDltsRecords[i];
      const targetRecord = hitDltsRecords[i + 1];

      // 获取红球遗漏值
      const redMissingValues = baseRecord.RedMissingValues || {};

      // 按热温冷比分类组合
      const hwcCombinations = {
        hot: [],
        warm: [],
        cold: []
      };

      // 遍历每个红球位置的遗漏值
      Object.keys(redMissingValues).forEach(position => {
        const missingValue = redMissingValues[position];
        const category = classifyMissingValue(missingValue);

        // 查找该位置符合遗漏值分类的组合
        const combinationsForPosition = redCombinationsCollection
          .find({
            [`combination.${position}`]: { $exists: true }
            // 可能需要额外的过滤条件
          })
          .toArray();

        hwcCombinations[category] = hwcCombinations[category].concat(
          combinationsForPosition.map(combo => combo._id)
        );
      });

      // 构建记录
      bulkOps.push({
        insertOne: {
          document: {
            base_id: baseRecord.ID,
            base_issue: baseRecord.Issue,
            target_id: targetRecord.ID,
            target_issue: targetRecord.Issue,
            is_predicted: false,
            created_at: new Date(),
            total_combinations: 324632,
            hot_warm_cold_data: hwcCombinations
          }
        }
      });
    }

    // 添加推算期记录
    const lastRecord = hitDltsRecords[hitDltsRecords.length - 1];
    const nextIssue = String(parseInt(lastRecord.Issue) + 1);

    bulkOps.push({
      insertOne: {
        document: {
          base_id: lastRecord.ID,
          base_issue: lastRecord.Issue,
          target_id: lastRecord.ID + 1,
          target_issue: nextIssue,
          is_predicted: true,
          created_at: new Date(),
          total_combinations: 324632
        }
      }
    });

    // 批量写入
    await hwcCollection.bulkWrite(bulkOps);

    console.log('🎉 热温冷比优化表重建完成');

  } catch (error) {
    console.error('❌ 重建过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

rebuildHwcOptimizedTableWithMissingValues();