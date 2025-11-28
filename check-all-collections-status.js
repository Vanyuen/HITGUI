/**
 * 检查所有数据库集合的状态
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkAllCollections() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 获取所有集合
    const collections = await db.listCollections().toArray();
    console.log(`📊 数据库 "${DB_NAME}" 中共有 ${collections.length} 个集合\n`);

    // 检查每个集合的数据量
    console.log('📋 集合数据统计:');
    console.log('='.repeat(80));

    for (const collInfo of collections) {
      const collName = collInfo.name;
      const count = await db.collection(collName).countDocuments();

      let status = '';
      if (count === 0) {
        status = '❌ 空集合';
      } else if (count < 100) {
        status = '⚠️  数据较少';
      } else {
        status = '✅ 正常';
      }

      console.log(`${status.padEnd(15)} ${collName.padEnd(50)} ${count.toLocaleString().padStart(15)} 条`);

      // 对于空集合，显示警告
      if (count === 0 && collName.includes('hit_dlts')) {
        console.log(`   ⚠️  "${collName}" 为空！这会导致大乐透相关功能无法使用`);
      }
    }

    console.log('='.repeat(80));
    console.log('');

    // 特别检查关键集合
    console.log('🔍 关键集合详细检查:');
    console.log('='.repeat(80));

    const keyCollections = [
      'hit_dlts',
      'hit_dlts',
      'hit_dlts',
      'HIT_DLT_RedCombinationsHotWarmColdOptimized',
      'PredictionTask',
      'PredictionTaskResult'
    ];

    for (const collName of keyCollections) {
      const exists = collections.some(c => c.name === collName);

      if (!exists) {
        console.log(`❌ "${collName}" - 集合不存在！`);
        continue;
      }

      const count = await db.collection(collName).countDocuments();
      console.log(`\n📦 ${collName}:`);
      console.log(`   - 总记录数: ${count.toLocaleString()}`);

      if (count > 0) {
        // 获取样例数据
        const sample = await db.collection(collName).findOne({});
        const fields = Object.keys(sample);
        console.log(`   - 字段数: ${fields.length}`);
        console.log(`   - 主要字段: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);

        // 特殊检查
        if (collName === 'hit_dlts') {
          const withMissing = await db.collection(collName)
            .countDocuments({ Red_Missing: { $exists: true, $ne: null } });
          console.log(`   - 有缺失值数据的记录: ${withMissing}/${count} (${(withMissing/count*100).toFixed(1)}%)`);
        }

        if (collName === 'PredictionTask') {
          const statusCounts = await db.collection(collName).aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]).toArray();
          console.log(`   - 任务状态分布:`);
          statusCounts.forEach(s => {
            console.log(`     * ${s._id}: ${s.count}`);
          });
        }
      } else {
        console.log(`   ❌ 集合为空！`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

    // 诊断建议
    console.log('💡 诊断建议:');
    console.log('='.repeat(80));

    const dltCount = await db.collection('hit_dlts').countDocuments();
    const redComboCount = await db.collection('hit_dlts').countDocuments();
    const blueComboCount = await db.collection('hit_dlts').countDocuments();

    if (dltCount === 0) {
      console.log('❌ hit_dlts集合为空 - 这是导致热温冷正选批量预测输出0组合的根本原因！');
      console.log('   解决方案:');
      console.log('   1. 在应用界面中导入大乐透历史数据（Excel文件）');
      console.log('   2. 或使用数据库导入工具恢复备份数据');
      console.log('');
    }

    if (redComboCount === 0) {
      console.log('❌ hit_dlts集合为空');
      console.log('   解决方案: 运行组合生成脚本 init-combinations.js');
      console.log('');
    }

    if (blueComboCount === 0) {
      console.log('❌ hit_dlts集合为空');
      console.log('   解决方案: 运行组合生成脚本 init-combinations.js');
      console.log('');
    }

    const hwcOptCount = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').countDocuments();
    if (hwcOptCount === 0 && dltCount > 0) {
      console.log('⚠️  HIT_DLT_RedCombinationsHotWarmColdOptimized集合为空');
      console.log('   解决方案: 运行优化表生成脚本 update-hwc-optimized.js');
      console.log('');
    }

    if (dltCount > 0 && redComboCount > 0 && blueComboCount > 0) {
      console.log('✅ 所有关键集合数据完整，系统应该可以正常工作');
      console.log('');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('✅ 检查完成');
  }
}

checkAllCollections();
