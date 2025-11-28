const mongoose = require('mongoose');

async function findDuplicateRecords() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 找出重复的期号记录
    const duplicateRecords = await collection.aggregate([
      {
        $group: {
          _id: { base_issue: '$base_issue', target_issue: '$target_issue' },
          count: { $sum: 1 },
          records: { $push: '$$ROOT' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    console.log('🔍 重复记录详情:');
    duplicateRecords.forEach(group => {
      console.log(`\n期号对: ${group._id.base_issue} → ${group._id.target_issue}`);
      console.log(`重复次数: ${group.count}`);

      group.records.forEach((record, index) => {
        console.log(`\n记录 ${index + 1}:`);
        console.log('  _id:', record._id);
        console.log('  是否预测:', record.is_predicted);
        console.log('  其他关键字段:', Object.keys(record).filter(k => !['_id', 'base_issue', 'target_issue', 'is_predicted'].includes(k)));
      });
    });

  } catch (error) {
    console.error('❌ 调查出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

findDuplicateRecords();