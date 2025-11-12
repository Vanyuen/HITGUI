/**
 * 检查缺失值数据表结构
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkMissingData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    console.log('🔍 检查缺失值数据表');
    console.log('='.repeat(100));

    // 检查集合是否存在
    const collections = await db.listCollections().toArray();
    const missingCollections = collections.filter(c =>
      c.name.toLowerCase().includes('missing')
    );

    console.log('找到以下包含"missing"的集合:');
    missingCollections.forEach(c => {
      console.log(`  - ${c.name}`);
    });
    console.log('');

    // 检查 hit_dlt_basictrendchart_redballmissing_histories
    const collName = 'hit_dlt_basictrendchart_redballmissing_histories';
    const count = await db.collection(collName).countDocuments();

    console.log(`📊 ${collName}:`);
    console.log(`   总记录数: ${count.toLocaleString()}`);
    console.log('');

    if (count > 0) {
      // 获取一条样本数据
      const sample = await db.collection(collName).findOne({});

      console.log('样本数据结构:');
      console.log(JSON.stringify(sample, null, 2));
      console.log('');

      // 查找最新期号
      const latest = await db.collection(collName)
        .find({})
        .sort({ period: -1 })
        .limit(1)
        .toArray();

      if (latest.length > 0) {
        console.log(`最新期号: ${latest[0].period}`);
        console.log('最新期号数据:');
        console.log(JSON.stringify(latest[0], null, 2));
      }
    } else {
      console.log('❌ 集合为空！');
    }

    // 同时检查 hit_dlts 表中的数据
    console.log('\n🔍 检查 hit_dlts 表中是否有缺失值数据');
    console.log('='.repeat(100));

    const dltSample = await db.collection('hit_dlts')
      .find({})
      .sort({ Issue: -1 })
      .limit(1)
      .toArray();

    if (dltSample.length > 0) {
      console.log('最新期号:', dltSample[0].Issue);
      console.log('字段列表:', Object.keys(dltSample[0]).join(', '));
      console.log('');

      // 检查是否有Red_Missing字段
      if (dltSample[0].Red_Missing) {
        console.log('✅ 有 Red_Missing 字段');
        console.log(`   类型: ${typeof dltSample[0].Red_Missing}`);
        console.log(`   长度: ${dltSample[0].Red_Missing.length || 'N/A'}`);
      } else {
        console.log('❌ 没有 Red_Missing 字段');
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkMissingData();
