/**
 * 导出任务原始数据进行分析
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function dumpTaskRawData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    // 查找任务
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({
      task_id: 'hwc-pos-20251105-cg2'
    });

    if (!task) {
      console.log('❌ 未找到该任务！');
      return;
    }

    console.log('📦 任务完整原始数据:');
    console.log('='.repeat(100));
    console.log(JSON.stringify(task, null, 2));
    console.log('');

    // 查找结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: 'hwc-pos-20251105-cg2' })
      .limit(3)
      .toArray();

    console.log('📦 结果数据示例 (前3条):');
    console.log('='.repeat(100));
    results.forEach((result, idx) => {
      console.log(`\n结果 #${idx + 1}:`);
      console.log(JSON.stringify(result, null, 2));
    });

  } catch (error) {
    console.error('❌ 导出失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 导出完成');
  }
}

dumpTaskRawData();
