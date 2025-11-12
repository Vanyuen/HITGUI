/**
 * 检查最新一期的数据详情
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkLatestIssue() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 获取最新10期数据
    console.log('📅 最新10期数据:');
    console.log('='.repeat(120));

    const latest10 = await db.collection('hit_dlts')
      .find({})
      .sort({ Issue: -1 })
      .limit(10)
      .toArray();

    if (latest10.length === 0) {
      console.log('❌ 数据库中没有任何数据！');
      return;
    }

    console.log(`找到 ${latest10.length} 期数据\n`);

    latest10.reverse().forEach((issue, index) => {
      const redBalls = [issue.Red_1, issue.Red_2, issue.Red_3, issue.Red_4, issue.Red_5];
      const blueBalls = [issue.Blue_1, issue.Blue_2];
      const hasMissing = issue.Red_Missing && Array.isArray(issue.Red_Missing) && issue.Red_Missing.length === 35;

      console.log(`${(10 - index).toString().padStart(2)}. 期号: ${issue.Issue}`);
      console.log(`    红球: ${redBalls.join(', ')}`);
      console.log(`    蓝球: ${blueBalls.join(', ')}`);
      console.log(`    缺失值数据: ${hasMissing ? '✅ 完整' : '❌ 缺失'}`);

      if (hasMissing) {
        // 显示部分缺失值
        const missingSample = issue.Red_Missing.slice(0, 10);
        console.log(`    缺失值示例 (前10个号): ${missingSample.join(', ')}`);
      }

      console.log('');
    });

    // 检查期号格式和范围
    const latestIssue = latest10[0];
    const oldestInRecent = latest10[latest10.length - 1];

    console.log('📊 期号信息:');
    console.log('='.repeat(120));
    console.log(`  最新期号: ${latestIssue.Issue} (${typeof latestIssue.Issue})`);
    console.log(`  10期前: ${oldestInRecent.Issue} (${typeof oldestInRecent.Issue})`);
    console.log('');

    // 检查用户输入的期号范围 25115-25125
    console.log('🔍 检查用户输入期号范围 25115-25125:');
    console.log('='.repeat(120));

    const userStartIssue = '25115';
    const userEndIssue = '25125';

    // 字符串比较
    const inRangeStr = await db.collection('hit_dlts')
      .find({
        Issue: { $gte: userStartIssue, $lte: userEndIssue }
      })
      .sort({ Issue: 1 })
      .toArray();

    console.log(`  字符串比较 (Issue >= "${userStartIssue}" AND Issue <= "${userEndIssue}"): ${inRangeStr.length} 期`);

    if (inRangeStr.length > 0) {
      console.log(`  期号: ${inRangeStr.map(i => i.Issue).join(', ')}`);
    } else {
      console.log('  ❌ 范围内没有数据');

      // 检查是否是期号太新了
      console.log(`\n  数据库最新期号: ${latestIssue.Issue}`);
      console.log(`  用户输入期号: ${userStartIssue} - ${userEndIssue}`);

      if (latestIssue.Issue < userStartIssue) {
        console.log(`  ⚠️  用户输入的期号范围超出了数据库范围！`);
        console.log(`     数据库中最新期号是 ${latestIssue.Issue}，而用户要求从 ${userStartIssue} 开始`);
      } else if (latestIssue.Issue >= userStartIssue && latestIssue.Issue <= userEndIssue) {
        console.log(`  ✅ 部分期号在范围内`);

        const partialRange = await db.collection('hit_dlts')
          .find({
            Issue: { $gte: userStartIssue, $lte: latestIssue.Issue }
          })
          .sort({ Issue: 1 })
          .toArray();

        console.log(`     实际可用期号: ${partialRange.map(i => i.Issue).join(', ')}`);
      }
    }

    console.log('');

    // 推算下一期
    const nextIssue = (parseInt(latestIssue.Issue) + 1).toString();
    console.log('📈 推算信息:');
    console.log('='.repeat(120));
    console.log(`  当前最新期号: ${latestIssue.Issue}`);
    console.log(`  推算下一期: ${nextIssue}`);
    console.log('');

    // 检查25121这个推算期号
    if (userEndIssue === '25125' && nextIssue <= userEndIssue) {
      console.log(`  ✅ 推算的下一期 ${nextIssue} 在用户输入范围内`);
      console.log(`     应该包含在预测期号列表中`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkLatestIssue();
