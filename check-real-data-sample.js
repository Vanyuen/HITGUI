/**
 * 检查数据库中真实的数据样本
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkRealData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 随机抽取1条数据查看完整结构
    console.log('📦 随机数据样本 (完整结构):');
    console.log('='.repeat(120));

    const sample = await db.collection('hit_dlts').findOne({});

    if (!sample) {
      console.log('❌ 集合中没有数据！');
      return;
    }

    console.log(JSON.stringify(sample, null, 2));
    console.log('');

    // 检查所有文档，看看有多少文档有完整数据
    console.log('📊 数据完整性统计:');
    console.log('='.repeat(120));

    const totalCount = await db.collection('hit_dlts').countDocuments();
    console.log(`总文档数: ${totalCount}`);

    // 检查有红球数据的文档
    const withRed1 = await db.collection('hit_dlts').countDocuments({ Red_1: { $ne: null, $exists: true } });
    console.log(`有 Red_1 字段的: ${withRed1}/${totalCount}`);

    // 检查有Issue字段的
    const withIssue = await db.collection('hit_dlts').countDocuments({ Issue: { $ne: null, $exists: true } });
    console.log(`有 Issue 字段的: ${withIssue}/${totalCount}`);

    // 检查Issue的类型
    const issueTypeCheck = await db.collection('hit_dlts').aggregate([
      { $project: { Issue: 1, IssueType: { $type: '$Issue' } } },
      { $group: { _id: '$IssueType', count: { $sum: 1 } } }
    ]).toArray();

    console.log('\nIssue字段类型统计:');
    issueTypeCheck.forEach(t => {
      console.log(`  ${t._id}: ${t.count} 条`);
    });

    // 获取有完整数据的前5条记录
    console.log('\n📋 有完整数据的前5条记录:');
    console.log('='.repeat(120));

    const completeRecords = await db.collection('hit_dlts')
      .find({
        Red_1: { $ne: null, $exists: true },
        Blue_1: { $ne: null, $exists: true }
      })
      .limit(5)
      .toArray();

    completeRecords.forEach(record => {
      console.log(`期号: ${record.Issue} (${typeof record.Issue})`);
      console.log(`  红球: ${record.Red_1}, ${record.Red_2}, ${record.Red_3}, ${record.Red_4}, ${record.Red_5}`);
      console.log(`  蓝球: ${record.Blue_1}, ${record.Blue_2}`);
      console.log(`  缺失值: ${record.Red_Missing ? '有' : '无'} (长度: ${record.Red_Missing?.length || 0})`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('✅ 检查完成');
  }
}

checkRealData();
