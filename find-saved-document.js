const mongoose = require('mongoose');

console.log('🔍 搜索文档ID: 691fc53bd1a776f2dd355a4a\n');
console.log('查找数据实际保存到了哪个集合...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 获取所有集合
  const collections = await db.listCollections().toArray();

  console.log(`共有 ${collections.length} 个集合，开始搜索...\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  let found = false;

  for (const coll of collections) {
    try {
      const doc = await db.collection(coll.name).findOne({
        _id: new mongoose.Types.ObjectId('691fc53bd1a776f2dd355a4a')
      });

      if (doc) {
        found = true;
        console.log(`✅ 找到了！文档在集合: ${coll.name}\n`);
        console.log('文档详情:');
        console.log(JSON.stringify(doc, null, 2));
        console.log('\n═══════════════════════════════════════════════════════════════\n');

        // 检查该集合的总记录数
        const count = await db.collection(coll.name).countDocuments();
        console.log(`该集合总记录数: ${count}\n`);

        // 如果集合名不对，说明保存到了错误的集合
        const expectedCollectionName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
        if (coll.name !== expectedCollectionName) {
          console.log('❌ 集合名错误！');
          console.log(`   实际集合: ${coll.name}`);
          console.log(`   预期集合: ${expectedCollectionName}\n`);
          console.log('这就是为什么优化表是空的！数据被保存到了错误的集合！\n');
        } else {
          console.log('✅ 集合名正确\n');
        }
      }
    } catch (err) {
      // 跳过错误（比如不兼容的集合）
    }
  }

  if (!found) {
    console.log('❌ 未找到该文档ID！');
    console.log('   可能原因:');
    console.log('   1. 文档ID格式错误');
    console.log('   2. 数据实际未保存成功');
    console.log('   3. 文档已被删除\n');
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
