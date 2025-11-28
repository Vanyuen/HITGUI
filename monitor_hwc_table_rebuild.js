const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function monitorHwcTableRebuild() {
  const logFilePath = path.join(__dirname, 'hwc_rebuild_progress.log');

  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 获取总记录数
    const totalRecords = await hitDltsCollection.countDocuments();

    // 获取已生成的热温冷比优化表记录数
    const hwcRecordCount = await hwcCollection.countDocuments();

    // 计算进度
    const progressPercentage = (hwcRecordCount / (totalRecords + 1)) * 100;

    // 日志信息
    const progressLog = {
      timestamp: new Date().toISOString(),
      totalSourceRecords: totalRecords,
      hwcRecordCount: hwcRecordCount,
      progressPercentage: progressPercentage.toFixed(2),
      status: progressPercentage === 100 ? '完成' : '进行中'
    };

    // 写入日志文件
    fs.writeFileSync(logFilePath, JSON.stringify(progressLog, null, 2));

    // 控制台输出
    console.log('🔍 热温冷比优化表重建进度:');
    console.log(`📊 总源记录数: ${totalRecords}`);
    console.log(`📈 已生成记录数: ${hwcRecordCount}`);
    console.log(`📉 完成进度: ${progressPercentage.toFixed(2)}%`);
    console.log(`🏁 状态: ${progressLog.status}`);

    // 如果未完成，打印最近的记录
    if (progressPercentage < 100) {
      const latestRecord = await hwcCollection
        .find({})
        .sort({ base_id: -1 })
        .limit(1)
        .toArray();

      if (latestRecord.length > 0) {
        console.log('\n最新记录:');
        console.log(`基准ID: ${latestRecord[0].base_id}`);
        console.log(`基准期号: ${latestRecord[0].base_issue}`);
      }
    }

  } catch (error) {
    console.error('❌ 监控过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

monitorHwcTableRebuild();