/**
 * 检查真实的数据库位置和数据
 */

const { MongoClient } = require('mongodb');

async function checkDatabase() {
  console.log('🔍 检查数据库状态...\n');

  const uris = [
    'mongodb://127.0.0.1:27017',
    'mongodb://localhost:27017'
  ];

  for (const uri of uris) {
    console.log(`\n尝试连接: ${uri}`);
    console.log('='.repeat(80));

    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000
      });

      await client.connect();
      console.log('✅ 连接成功！');

      // 列出所有数据库
      const adminDb = client.db().admin();
      const dbs = await adminDb.listDatabases();

      console.log('\n📚 所有数据库:');
      dbs.databases.forEach(db => {
        console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });

      // 检查 lottery 数据库
      if (dbs.databases.find(db => db.name === 'lottery')) {
        console.log('\n📊 lottery 数据库详情:');
        const lotteryDb = client.db('lottery');
        const collections = await lotteryDb.listCollections().toArray();

        console.log(`\n总集合数: ${collections.length}`);
        console.log('\n集合详情:');

        for (const coll of collections) {
          const count = await lotteryDb.collection(coll.name).countDocuments();
          console.log(`  - ${coll.name}: ${count.toLocaleString()} 条记录`);
        }

        // 检查关键集合
        console.log('\n🔑 关键集合检查:');

        // HIT_DLT
        const dltCount = await lotteryDb.collection('HIT_DLT').countDocuments();
        console.log(`  大乐透历史数据: ${dltCount} 期`);

        if (dltCount > 0) {
          const latestIssue = await lotteryDb.collection('HIT_DLT')
            .find({})
            .sort({ Issue: -1 })
            .limit(1)
            .toArray();

          if (latestIssue.length > 0) {
            console.log(`  最新期号: ${latestIssue[0].Issue}`);
          }
        }

        // DLTRedCombinations
        const redComboCount = await lotteryDb.collection('DLTRedCombinations').countDocuments();
        console.log(`  红球组合表: ${redComboCount.toLocaleString()} 条`);
        console.log(`    预期: 324,632 条 (C(35,5))`);
        console.log(`    状态: ${redComboCount === 324632 ? '✅ 完整' : '⚠️ 不完整'}`);

        // DLTRedCombinationsHotWarmColdOptimized
        const hwcCount = await lotteryDb.collection('DLTRedCombinationsHotWarmColdOptimized').countDocuments();
        console.log(`  热温冷优化表: ${hwcCount.toLocaleString()} 条`);

        if (hwcCount > 0) {
          const issuePairs = await lotteryDb.collection('DLTRedCombinationsHotWarmColdOptimized')
            .distinct('base_issue');
          console.log(`    覆盖期号对: ${issuePairs.length} 个`);
        }

        // PredictionTask
        const taskCount = await lotteryDb.collection('PredictionTask').countDocuments();
        console.log(`  预测任务: ${taskCount} 个`);

        if (taskCount > 0) {
          const statusCounts = await lotteryDb.collection('PredictionTask').aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]).toArray();

          console.log('    任务状态分布:');
          statusCounts.forEach(s => {
            console.log(`      - ${s._id}: ${s.count} 个`);
          });
        }

      } else {
        console.log('\n❌ lottery 数据库不存在！');
      }

      await client.close();
      console.log('\n✅ 数据库检查完成');
      break;

    } catch (error) {
      console.log(`❌ 连接失败: ${error.message}`);
    }
  }
}

checkDatabase().catch(console.error);
