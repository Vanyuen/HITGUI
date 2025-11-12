const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 任务完整数据 ===\n');

  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({ task_id: 'hwc-pos-20251105-2dq' });

  console.log(JSON.stringify(task, null, 2));

  await client.close();
})();
