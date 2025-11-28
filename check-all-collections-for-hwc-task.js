/**
 * 检查所有数据库集合，找到热温冷正选任务数据
 */

const mongoose = require('mongoose');

async function checkAllCollections() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 已连接到 MongoDB');

    const db = mongoose.connection.db;

    // 获取所有集合名称
    const collections = await db.listCollections().toArray();

    console.log('\n========================================');
    console.log('📂 所有数据库集合');
    console.log('========================================');

    // 查找包含 "hwc" 或 "batch" 或 "prediction" 的集合
    const relevantCollections = collections.filter(c =>
      c.name.toLowerCase().includes('hwc') ||
      c.name.toLowerCase().includes('batch') ||
      c.name.toLowerCase().includes('prediction') ||
      c.name.toLowerCase().includes('task')
    );

    console.log('\n相关集合 (包含 hwc/batch/prediction/task):');
    relevantCollections.forEach(c => {
      console.log(' -', c.name);
    });

    // 检查这些集合的内容
    for (const coll of relevantCollections) {
      const collection = db.collection(coll.name);
      const count = await collection.countDocuments();
      console.log(`\n集合 ${coll.name}: ${count} 条记录`);

      if (count > 0 && count < 50) {
        const docs = await collection.find({}).sort({ created_at: -1 }).limit(5).toArray();
        console.log('  最新5条记录:');
        docs.forEach((doc, i) => {
          console.log(`  #${i + 1}:`, {
            _id: doc._id,
            task_id: doc.task_id,
            task_name: doc.task_name,
            status: doc.status,
            created_at: doc.created_at
          });
        });
      }
    }

    // 专门搜索包含 20251124 的记录
    console.log('\n========================================');
    console.log('🔍 搜索包含 "20251124" 或 "yem" 的任务');
    console.log('========================================');

    for (const coll of collections) {
      const collection = db.collection(coll.name);
      const docs = await collection.find({
        $or: [
          { task_id: /20251124/i },
          { task_id: /yem/i },
          { task_name: /20251124/i }
        ]
      }).limit(10).toArray();

      if (docs.length > 0) {
        console.log(`\n在集合 ${coll.name} 中找到 ${docs.length} 条相关记录:`);
        docs.forEach((doc, i) => {
          console.log(`  #${i + 1}:`, JSON.stringify(doc).substring(0, 200) + '...');
        });
      }
    }

    // 检查所有集合列表
    console.log('\n========================================');
    console.log('📋 所有集合及记录数');
    console.log('========================================');
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`${coll.name}: ${count}`);
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAllCollections();
