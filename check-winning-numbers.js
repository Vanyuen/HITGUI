/**
 * 检查开奖号码数据是否存在
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkWinningNumbers() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    console.log('🔍 检查期号 25074-25078 的开奖数据');
    console.log('='.repeat(100));

    const periods = [25074, 25075, 25076, 25077, 25078];

    for (const period of periods) {
      const record = await db.collection('hit_dlts').findOne({ Issue: period });

      if (record) {
        console.log(`\n期号 ${period}:`);
        console.log(`  Red: ${record.Red || 'N/A'}`);
        console.log(`  Blue: ${record.Blue || 'N/A'}`);
        console.log(`  字段列表: ${Object.keys(record).join(', ')}`);
      } else {
        console.log(`\n期号 ${period}: ❌ 未找到记录`);
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkWinningNumbers();
