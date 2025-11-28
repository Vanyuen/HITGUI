const mongoose = require('mongoose');
const { COLLECTIONS, getBackupCollectionName } = require('./constants/collections');

console.log('🔄 热温冷优化表自动备份脚本\n');

/**
 * 备份热温冷优化表
 * @param {string} reason - 备份原因
 * @returns {Promise<Object>} 备份结果
 */
async function backupHWCOptimizedTable(reason = 'manual') {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📦 开始备份热温冷优化表 (原因: ${reason})`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const sourceCollection = COLLECTIONS.HWC_OPTIMIZED;
    const backupCollection = getBackupCollectionName();

    // 检查源集合是否存在
    const count = await db.collection(sourceCollection).countDocuments();
    console.log(`📊 源集合: ${sourceCollection}`);
    console.log(`   记录数: ${count.toLocaleString()}条\n`);

    if (count === 0) {
      console.log('⚠️  源集合为空，取消备份');
      await mongoose.connection.close();
      return { success: false, message: '源集合为空' };
    }

    // 复制数据
    console.log(`🔄 正在复制数据到: ${backupCollection}\n`);

    const startTime = Date.now();

    // 使用聚合管道复制数据（更高效）
    const pipeline = [
      { $match: {} },
      { $out: backupCollection }
    ];

    await db.collection(sourceCollection).aggregate(pipeline).toArray();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 验证备份
    const backupCount = await db.collection(backupCollection).countDocuments();

    console.log('✅ 备份完成！');
    console.log(`   备份集合: ${backupCollection}`);
    console.log(`   备份记录数: ${backupCount.toLocaleString()}条`);
    console.log(`   耗时: ${duration}秒\n`);

    // 验证数据一致性
    if (backupCount === count) {
      console.log('✅ 数据一致性验证通过！\n');
    } else {
      console.log(`⚠️  数据数量不一致！源:${count}, 备份:${backupCount}\n`);
    }

    // 获取所有备份集合
    const allCollections = await db.listCollections().toArray();
    const backups = allCollections
      .filter(coll => coll.name.startsWith(COLLECTIONS.HWC_OPTIMIZED_BACKUP_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    console.log('📋 现有备份列表:\n');
    for (let i = 0; i < Math.min(backups.length, 10); i++) {
      const backup = backups[i];
      const backupCount = await db.collection(backup.name).countDocuments();
      const isCurrent = backup.name === backupCollection ? ' 👈 当前备份' : '';
      console.log(`   ${i + 1}. ${backup.name} (${backupCount.toLocaleString()}条)${isCurrent}`);
    }

    if (backups.length > 10) {
      console.log(`   ... 还有 ${backups.length - 10} 个备份`);
    }

    console.log('');

    // 清理旧备份（保留最近1个）⚠️ 选项A方案
    const maxBackups = 1;
    if (backups.length > maxBackups) {
      console.log(`🧹 清理旧备份（保留最近${maxBackups}个）\n`);

      const toDelete = backups.slice(maxBackups);
      for (const backup of toDelete) {
        await db.collection(backup.name).drop();
        console.log(`   ✅ 已删除: ${backup.name}`);
      }

      console.log(`\n✅ 已清理 ${toDelete.length} 个旧备份\n`);
    }

    await mongoose.connection.close();

    return {
      success: true,
      backupCollection,
      recordCount: backupCount,
      duration
    };

  } catch (error) {
    console.error('❌ 备份失败:', error.message);
    await mongoose.connection.close();
    return { success: false, error: error.message };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const reason = process.argv[2] || 'manual';
  backupHWCOptimizedTable(reason).then(result => {
    if (result.success) {
      console.log('🎉 备份任务完成！');
      process.exit(0);
    } else {
      console.error('❌ 备份任务失败！');
      process.exit(1);
    }
  });
}

module.exports = { backupHWCOptimizedTable };
