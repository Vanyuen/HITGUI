const mongoose = require('mongoose');
const { COLLECTIONS } = require('./constants/collections');

console.log('📊 分析热温冷优化表数据大小\n');

async function analyzeDataSize() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📦 数据库集合大小分析');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 检查所有核心集合
    const collections = [
      { name: COLLECTIONS.HIT_DLTS, desc: '主数据表' },
      { name: COLLECTIONS.RED_COMBINATIONS, desc: '红球组合表' },
      { name: COLLECTIONS.BLUE_COMBINATIONS, desc: '蓝球组合表' },
      { name: COLLECTIONS.RED_MISSING_HISTORIES, desc: '红球遗漏值表' },
      { name: COLLECTIONS.COMBO_FEATURES, desc: '组合特征表' },
      { name: COLLECTIONS.HWC_OPTIMIZED, desc: '热温冷优化表 ⭐' },
    ];

    let totalSize = 0;
    const sizeInfo = [];

    for (const coll of collections) {
      const stats = await db.collection(coll.name).stats();

      const size = stats.size || 0;  // 数据大小（字节）
      const storageSize = stats.storageSize || 0;  // 存储大小（字节）
      const count = stats.count || 0;  // 记录数
      const avgObjSize = stats.avgObjSize || 0;  // 平均对象大小

      const sizeMB = (size / 1024 / 1024).toFixed(2);
      const storageSizeMB = (storageSize / 1024 / 1024).toFixed(2);
      const avgKB = (avgObjSize / 1024).toFixed(2);

      totalSize += size;

      sizeInfo.push({
        name: coll.name,
        desc: coll.desc,
        count,
        size,
        sizeMB,
        storageSizeMB,
        avgKB
      });

      console.log(`📁 ${coll.desc}`);
      console.log(`   集合名: ${coll.name}`);
      console.log(`   记录数: ${count.toLocaleString()}条`);
      console.log(`   数据大小: ${sizeMB} MB`);
      console.log(`   存储大小: ${storageSizeMB} MB (包含索引)`);
      console.log(`   平均单条: ${avgKB} KB\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 汇总统计');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`总数据大小: ${totalMB} MB\n`);

    // 找出热温冷优化表
    const hwcInfo = sizeInfo.find(info => info.name === COLLECTIONS.HWC_OPTIMIZED);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⭐ 热温冷优化表详细分析');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`数据大小: ${hwcInfo.sizeMB} MB`);
    console.log(`存储大小: ${hwcInfo.storageSizeMB} MB (含索引)`);
    console.log(`记录数: ${hwcInfo.count.toLocaleString()}条`);
    console.log(`平均单条: ${hwcInfo.avgKB} KB\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💾 备份存储空间评估');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const hwcSizeMB = parseFloat(hwcInfo.sizeMB);

    console.log('方案对比:\n');

    console.log('📦 方案A: 三层备份策略');
    console.log(`   - 实时备份（全量重建前）: ${hwcSizeMB.toFixed(2)} MB × 1个`);
    console.log(`   - 日备份（保留7天）: ${hwcSizeMB.toFixed(2)} MB × 7个 = ${(hwcSizeMB * 7).toFixed(2)} MB`);
    console.log(`   - 周备份（保留4周）: ${hwcSizeMB.toFixed(2)} MB × 4个 = ${(hwcSizeMB * 4).toFixed(2)} MB`);
    console.log(`   总计: ${(hwcSizeMB * 12).toFixed(2)} MB\n`);

    console.log('📦 方案B: 简化备份策略（仅全量重建前）');
    console.log(`   - 保留最近3个备份: ${hwcSizeMB.toFixed(2)} MB × 3个 = ${(hwcSizeMB * 3).toFixed(2)} MB\n`);

    console.log('📦 方案C: 精简备份策略（推荐）');
    console.log(`   - 最近1次备份（全量重建前）: ${hwcSizeMB.toFixed(2)} MB × 1个`);
    console.log(`   - 每日备份（保留3天）: ${hwcSizeMB.toFixed(2)} MB × 3个 = ${(hwcSizeMB * 3).toFixed(2)} MB`);
    console.log(`   总计: ${(hwcSizeMB * 4).toFixed(2)} MB\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 单条记录数据结构分析');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 获取一条样本数据
    const sample = await db.collection(COLLECTIONS.HWC_OPTIMIZED).findOne({});

    if (sample) {
      console.log('样本记录结构:\n');

      // 计算各部分占用
      const baseFields = ['_id', 'base_issue', 'target_issue', 'base_id', 'is_predicted', 'created_at'];
      const hwcData = sample.hot_warm_cold_data || {};
      const hitAnalysis = sample.hit_analysis || {};
      const statistics = sample.statistics || {};

      console.log('基础字段:');
      baseFields.forEach(field => {
        if (sample[field] !== undefined) {
          const value = sample[field];
          const type = typeof value;
          console.log(`   ${field}: ${type}`);
        }
      });

      console.log(`\n热温冷数据 (hot_warm_cold_data):`);
      console.log(`   比例种类: ${Object.keys(hwcData).length}种`);

      let totalCombinations = 0;
      Object.entries(hwcData).forEach(([ratio, ids]) => {
        totalCombinations += ids.length;
      });
      console.log(`   总组合ID数: ${totalCombinations.toLocaleString()}个`);

      // 估算hot_warm_cold_data大小
      const hwcDataSize = JSON.stringify(hwcData).length;
      const hwcDataKB = (hwcDataSize / 1024).toFixed(2);
      console.log(`   预估大小: ${hwcDataKB} KB\n`);

      console.log('命中分析 (hit_analysis):');
      const hitAnalysisSize = JSON.stringify(hitAnalysis).length;
      const hitAnalysisKB = (hitAnalysisSize / 1024).toFixed(2);
      console.log(`   预估大小: ${hitAnalysisKB} KB\n`);

      console.log('统计信息 (statistics):');
      const statisticsSize = JSON.stringify(statistics).length;
      const statisticsKB = (statisticsSize / 1024).toFixed(2);
      console.log(`   预估大小: ${statisticsKB} KB\n`);

      const totalRecordKB = parseFloat(hwcDataKB) + parseFloat(hitAnalysisKB) + parseFloat(statisticsKB);
      console.log(`单条记录总计: ${totalRecordKB.toFixed(2)} KB`);
      console.log(`数据库统计平均: ${hwcInfo.avgKB} KB\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💡 推荐方案');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (hwcSizeMB < 50) {
      console.log('✅ 数据量较小（< 50 MB），推荐方案C（精简备份）');
      console.log(`   存储成本: ${(hwcSizeMB * 4).toFixed(2)} MB`);
      console.log(`   保护级别: 中等`);
      console.log(`   实施难度: 低\n`);
    } else if (hwcSizeMB < 200) {
      console.log('⚠️  数据量中等（50-200 MB），推荐方案B（简化备份）');
      console.log(`   存储成本: ${(hwcSizeMB * 3).toFixed(2)} MB`);
      console.log(`   保护级别: 基本`);
      console.log(`   实施难度: 低\n`);
    } else {
      console.log('❌ 数据量较大（> 200 MB），推荐仅全量重建前备份');
      console.log(`   存储成本: ${(hwcSizeMB * 1).toFixed(2)} MB`);
      console.log(`   保护级别: 最小`);
      console.log(`   实施难度: 低\n`);
    }

    // 检查是否有现有备份
    const allCollections = await db.listCollections().toArray();
    const backups = allCollections.filter(coll =>
      coll.name.startsWith(COLLECTIONS.HWC_OPTIMIZED_BACKUP_PREFIX)
    );

    if (backups.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📁 现有备份占用空间');
      console.log('═══════════════════════════════════════════════════════════════\n');

      let totalBackupSize = 0;
      for (const backup of backups) {
        const stats = await db.collection(backup.name).stats();
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        totalBackupSize += stats.size;
        console.log(`   ${backup.name}: ${sizeMB} MB`);
      }

      const totalBackupMB = (totalBackupSize / 1024 / 1024).toFixed(2);
      console.log(`\n   总计: ${totalBackupMB} MB (${backups.length}个备份)\n`);
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

analyzeDataSize();
