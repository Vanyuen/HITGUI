const mongoose = require('mongoose');

async function analyzeHwcOptimizedTable() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 随机抽取5条记录详细检查
    const sampleRecords = await hwcCollection
      .find({})
      .limit(5)
      .toArray();

    console.log('🔍 热温冷比优化表记录结构检查:');

    sampleRecords.forEach((record, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log('基准期号:', record.base_issue);

      // 检查热温冷比数据
      if (record.hot_warm_cold_data) {
        console.log('热温冷比数据结构:');
        Object.keys(record.hot_warm_cold_data).forEach(ratio => {
          console.log(`- ${ratio} 比例:`);
          console.log(`  组合数: ${record.hot_warm_cold_data[ratio].length}`);

          // 检查是否包含组合ID
          if (record.hot_warm_cold_data[ratio].length > 0) {
            console.log('  首个组合ID示例:', record.hot_warm_cold_data[ratio][0]);
          }
        });
      } else {
        console.log('❌ 警告：未找到热温冷比数据');
      }
    });

    // 统计总体情况
    const totalRecords = await hwcCollection.countDocuments();
    const recordsWithHwcData = await hwcCollection.countDocuments({
      'hot_warm_cold_data': { $exists: true }
    });

    console.log('\n📊 总体统计:');
    console.log(`总记录数: ${totalRecords}`);
    console.log(`包含热温冷比数据的记录数: ${recordsWithHwcData}`);
    console.log(`覆盖率: ${((recordsWithHwcData / totalRecords) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ 分析过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

analyzeHwcOptimizedTable();