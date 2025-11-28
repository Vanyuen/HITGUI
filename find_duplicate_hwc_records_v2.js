const mongoose = require('mongoose');

async function findDuplicateRecords() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 查找重复的记录
    const duplicateRecords = await collection.aggregate([
      {
        $group: {
          _id: {
            base_issue: '$base_issue',
            target_issue: '$target_issue',
            is_predicted: '$is_predicted'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicateRecords.length > 0) {
      console.log('🚨 发现重复记录:');
      duplicateRecords.forEach(record => {
        console.log('\n重复记录详情:');
        console.log('  期号对:', record._id.base_issue, '→', record._id.target_issue);
        console.log('  是否预测:', record._id.is_predicted);
        console.log('  重复次数:', record.count);
        console.log('  重复记录ID:', record.ids);
      });
    } else {
      console.log('✅ 未发现重复记录');
    }

  } catch (error) {
    console.error('❌ 调查出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

findDuplicateRecords();