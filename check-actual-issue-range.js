/**
 * 检查数据库中实际存在的期号范围
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkIssueRange() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 获取总数
    const totalCount = await db.collection('HIT_DLT').countDocuments();
    console.log(`📊 数据库中共有 ${totalCount} 期数据\n`);

    // 获取最早和最新的期号
    const earliest = await db.collection('HIT_DLT')
      .find({})
      .sort({ Issue: 1 })
      .limit(1)
      .toArray();

    const latest = await db.collection('HIT_DLT')
      .find({})
      .sort({ Issue: -1 })
      .limit(1)
      .toArray();

    if (earliest.length > 0 && latest.length > 0) {
      console.log('📅 期号范围:');
      console.log(`   最早期号: ${earliest[0].Issue}`);
      console.log(`   最新期号: ${latest[0].Issue}`);
      console.log('');
    }

    // 获取最近10期数据
    console.log('📋 最近10期数据:');
    const recent10 = await db.collection('HIT_DLT')
      .find({})
      .sort({ Issue: -1 })
      .limit(10)
      .toArray();

    recent10.reverse().forEach(issue => {
      const redBalls = [issue.Red_1, issue.Red_2, issue.Red_3, issue.Red_4, issue.Red_5].join(',');
      const blueBalls = [issue.Blue_1, issue.Blue_2].join(',');
      const hasMissing = issue.Red_Missing && issue.Red_Missing.length === 35;
      console.log(`   ${issue.Issue}: 红球[${redBalls}] 蓝球[${blueBalls}] ${hasMissing ? '✅' : '❌缺失值数据缺失'}`);
    });
    console.log('');

    // 检查25115-25125范围
    console.log('🔍 检查用户输入的期号范围25115-25125:');
    const userRange = await db.collection('HIT_DLT')
      .find({ Issue: { $gte: '25115', $lte: '25125' } })
      .sort({ Issue: 1 })
      .toArray();

    if (userRange.length === 0) {
      console.log('❌ 该范围内没有任何数据！');
      console.log('   原因: 期号25115-25125可能:');
      console.log('   1. 还未开奖');
      console.log('   2. 期号格式不匹配');
      console.log('   3. 数据尚未导入');
    } else {
      console.log(`✅ 找到 ${userRange.length} 期数据:`);
      userRange.forEach(issue => {
        console.log(`   ${issue.Issue}`);
      });
    }
    console.log('');

    // 检查期号格式
    console.log('🔍 检查期号格式:');
    const sampleIssues = await db.collection('HIT_DLT')
      .find({})
      .sort({ Issue: -1 })
      .limit(5)
      .toArray();

    sampleIssues.forEach(issue => {
      console.log(`   ${issue.Issue} (类型: ${typeof issue.Issue}, 长度: ${issue.Issue.length})`);
    });

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkIssueRange();
