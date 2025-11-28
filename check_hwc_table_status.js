const mongoose = require('mongoose');

async function checkHwcTableStatus() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
    const hwcOptimizedCount = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();

    console.log('🔢 hit_dlts 记录数:', hitDltsCount);
    console.log('🔢 热温冷比优化表记录数:', hwcOptimizedCount);

    const latestHitDlt = await mongoose.connection.db.collection('hit_dlts')
      .find({})
      .sort({ Issue: -1 })
      .limit(1)
      .toArray();

    const latestHwc = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
      .find({})
      .sort({ base_issue: -1 })
      .limit(1)
      .toArray();

    console.log('📅 最新hit_dlts期号:', latestHitDlt[0]?.Issue);
    console.log('📅 最新热温冷比优化表基准期:', latestHwc[0]?.base_issue);

    // 检查记录完整性
    const allDltIssues = await mongoose.connection.db.collection('hit_dlts')
      .find({})
      .sort({ Issue: 1 })
      .toArray();

    const expectedPairs = allDltIssues.length - 1;
    console.log(`📊 预期期号对数量: ${expectedPairs}`);

    if (hwcOptimizedCount < expectedPairs) {
      console.log(`⚠️ 警告：热温冷比优化表记录不完整，缺少 ${expectedPairs - hwcOptimizedCount} 个期号对`);
    } else if (hwcOptimizedCount > expectedPairs) {
      console.log(`⚠️ 警告：热温冷比优化表记录数超出预期，多出 ${hwcOptimizedCount - expectedPairs} 个期号对`);
    } else {
      console.log('✅ 热温冷比优化表记录数量正确');
    }

  } catch (error) {
    console.error('❌ 检查出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkHwcTableStatus();