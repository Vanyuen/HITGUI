const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 重新仔细检查所有集合，寻找最新数据 25114-25125...\n');

  const collections = await db.listCollections().toArray();

  console.log(`总集合数: ${collections.length}\n`);

  // 对每个集合都检查是否有 25114-25125 的数据
  for (const coll of collections) {
    try {
      const count = await db.collection(coll.name).countDocuments();

      if (count === 0) continue;  // 跳过空集合

      // 尝试查找 base_issue 或 Issue 字段包含 25114-25125 的记录
      const has25124Query1 = await db.collection(coll.name).findOne({
        $or: [
          { base_issue: 25124 },
          { target_issue: 25125 },
          { Issue: 25124 },
          { Issue: 25125 }
        ]
      });

      if (has25124Query1) {
        console.log(`✅ 【${coll.name}】找到 25124/25125 相关数据！`);
        console.log(`   总记录数: ${count.toLocaleString()}`);

        // 详细检查这个集合
        const sample = await db.collection(coll.name)
          .find({})
          .sort({ target_issue: -1, Issue: -1 })
          .limit(3)
          .toArray();

        console.log(`   最新3条记录:`);
        sample.forEach(r => {
          const key = r.base_issue ? `${r.base_issue}→${r.target_issue}` : `期号${r.Issue}`;
          console.log(`     ${key}`);
        });
        console.log('');
      }
    } catch (err) {
      // 忽略查询错误
    }
  }

  console.log('\n🔍 检查是否有多个热温冷优化表...\n');

  const hwcCollections = collections.filter(c =>
    c.name.toLowerCase().includes('hotwarmcold') ||
    c.name.toLowerCase().includes('hwc') &&
    c.name.toLowerCase().includes('optimized')
  );

  for (const coll of hwcCollections) {
    const count = await db.collection(coll.name).countDocuments();
    if (count > 0) {
      console.log(`【${coll.name}】`);
      console.log(`  记录数: ${count.toLocaleString()}`);

      const latest = await db.collection(coll.name)
        .find({})
        .sort({ target_issue: -1 })
        .limit(1)
        .toArray();

      if (latest.length > 0) {
        console.log(`  最新: ${latest[0].base_issue} → ${latest[0].target_issue}`);
      }
      console.log('');
    }
  }

  await mongoose.connection.close();
}).catch(console.error);
