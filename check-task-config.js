/**
 * 检查任务配置和开奖数据
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function checkTaskConfig() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 1. 获取最新任务
    const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();

    if (latestTask.length === 0) {
      console.log('❌ 没有找到任务');
      return;
    }

    const task = latestTask[0];

    console.log('📋 最新任务配置:');
    console.log('='.repeat(100));
    console.log(`任务ID: ${task.task_id}`);
    console.log(`状态: ${task.status}`);
    console.log('');
    console.log('output_config:');
    console.log(JSON.stringify(task.output_config, null, 2));
    console.log('');
    console.log(`enableHitAnalysis: ${task.output_config?.enableHitAnalysis}`);
    console.log(`pairingMode: ${task.output_config?.pairingMode}`);
    console.log('');

    // 2. 检查期号范围内是否有开奖数据
    console.log('🔍 检查开奖数据:');
    console.log('='.repeat(100));

    // 获取任务的期号范围
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: task.task_id })
      .sort({ period: 1 })
      .limit(10)
      .toArray();

    console.log(`任务结果数: ${results.length}`);
    console.log('');

    if (results.length > 0) {
      console.log('前10期的期号和is_predicted状态:');
      for (const result of results) {
        const period = result.period;
        const isPredicted = result.is_predicted;

        // 检查该期是否有开奖数据
        const issueRecord = await db.collection('hit_dlts').findOne({ Issue: parseInt(period) });

        console.log(`  期号 ${period}:`);
        console.log(`    is_predicted: ${isPredicted}`);
        console.log(`    数据库有记录: ${issueRecord ? '是' : '否'}`);

        if (issueRecord) {
          console.log(`    Red: [${issueRecord.Red1}, ${issueRecord.Red2}, ${issueRecord.Red3}, ${issueRecord.Red4}, ${issueRecord.Red5}]`);
          console.log(`    Blue: [${issueRecord.Blue1}, ${issueRecord.Blue2}]`);
        }

        console.log(`    结果中的winning_numbers: ${JSON.stringify(result.winning_numbers)}`);
        console.log('');
      }
    }

    // 3. 检查数据库中的最大期号
    const maxIssue = await db.collection('hit_dlts')
      .find({})
      .sort({ Issue: -1 })
      .limit(1)
      .toArray();

    console.log('📊 数据库状态:');
    console.log('='.repeat(100));
    console.log(`最大期号: ${maxIssue.length > 0 ? maxIssue[0].Issue : 'N/A'}`);
    console.log(`开奖记录总数: ${await db.collection('hit_dlts').countDocuments()}`);

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 检查完成');
  }
}

checkTaskConfig();
