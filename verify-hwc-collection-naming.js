const mongoose = require('mongoose');

console.log('🔍 热温冷优化表集合命名验证\n');
console.log('═══════════════════════════════════════════════════════════════\n');

async function verifyCollectionNaming() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    const CORRECT_COLLECTION = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

    console.log('✅ 正确的集合名称:');
    console.log(`   ${CORRECT_COLLECTION}\n`);

    // 检查正确的集合
    const count = await db.collection(CORRECT_COLLECTION).countDocuments();
    console.log(`📊 正确集合状态:`);
    console.log(`   记录数: ${count.toLocaleString()}条`);

    if (count > 0) {
      const latest = await db.collection(CORRECT_COLLECTION)
        .find({}).sort({ _id: -1 }).limit(1).toArray();

      console.log(`   最新期号对: ${latest[0]?.base_issue}→${latest[0]?.target_issue}`);
      console.log(`   ✅ 集合存在且有数据\n`);
    } else {
      console.log(`   ❌ 集合为空或不存在！\n`);
    }

    // 检查常见错误集合
    const WRONG_COLLECTIONS = [
      'hit_dlt_redcombinationshotwarmcoldoptimized',  // 缺少's'
      'hit_dlt_redcombinationshotwarmcolds',  // 缺少'optimized'
      'hit_dlt_hwcoptimized',  // 缩写
      'HIT_DLT_RedCombinationsHotWarmColdOptimized',  // 大写
    ];

    console.log('❌ 常见错误集合名检查:\n');

    let foundErrors = false;
    for (const wrongName of WRONG_COLLECTIONS) {
      const collections = await db.listCollections({ name: wrongName }).toArray();
      if (collections.length > 0) {
        const wrongCount = await db.collection(wrongName).countDocuments();
        console.log(`   ⚠️  发现错误集合: ${wrongName} (${wrongCount}条)`);
        foundErrors = true;
      }
    }

    if (!foundErrors) {
      console.log(`   ✅ 未发现常见错误集合\n`);
    } else {
      console.log(`\n   建议运行清理脚本: node cleanup-wrong-collections.js\n`);
    }

    // 检查备份
    const allCollections = await db.listCollections().toArray();
    const backups = allCollections.filter(coll =>
      coll.name.startsWith('hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_')
    );

    console.log('📦 备份状态:\n');
    if (backups.length > 0) {
      console.log(`   找到 ${backups.length} 个备份:\n`);
      backups.sort((a, b) => b.name.localeCompare(a.name));
      for (let i = 0; i < Math.min(backups.length, 5); i++) {
        const backup = backups[i];
        const backupCount = await db.collection(backup.name).countDocuments();
        console.log(`   ${i + 1}. ${backup.name} (${backupCount.toLocaleString()}条)`);
      }
      if (backups.length > 5) {
        console.log(`   ... 还有 ${backups.length - 5} 个备份`);
      }
      console.log('');
    } else {
      console.log(`   ⚠️  未找到备份\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎬 验证结果');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (count > 0 && !foundErrors) {
      console.log('🎉 验证通过！');
      console.log('   ✅ 正确的集合存在且有数据');
      console.log('   ✅ 未发现常见错误集合\n');
    } else {
      console.log('⚠️  发现问题:');
      if (count === 0) {
        console.log('   ❌ 正确的集合为空或不存在');
      }
      if (foundErrors) {
        console.log('   ❌ 存在错误的集合名称');
      }
      console.log('');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

verifyCollectionNaming();
