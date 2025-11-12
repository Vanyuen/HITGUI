/**
 * 诊断数据字段命名问题
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function diagnose() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('🔍 诊断数据字段命名问题\n');

  // 1. 检查大乐透历史数据的字段
  console.log('1️⃣ 大乐透历史数据字段:');
  console.log('='.repeat(80));
  const dltSample = await db.collection('hit_dlts').findOne({});
  if (dltSample) {
    console.log('字段列表:', Object.keys(dltSample));
    console.log('\n样本数据:');
    console.log(JSON.stringify(dltSample, null, 2));
  }

  // 2. 检查热温冷优化表字段
  console.log('\n\n2️⃣ 热温冷优化表字段:');
  console.log('='.repeat(80));
  const hwcSample = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({});
  if (hwcSample) {
    console.log('字段列表:', Object.keys(hwcSample));
    console.log('\n样本数据:');
    console.log(JSON.stringify(hwcSample, null, 2));
  }

  // 3. 检查任务表字段
  console.log('\n\n3️⃣ 任务表字段:');
  console.log('='.repeat(80));
  const taskSample = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({});
  if (taskSample) {
    console.log('字段列表:', Object.keys(taskSample));
    console.log('\n样本数据:');
    console.log(JSON.stringify(taskSample, null, 2));
  }

  // 4. 检查结果表字段
  console.log('\n\n4️⃣ 结果表字段:');
  console.log('='.repeat(80));
  const resultSample = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne({});
  if (resultSample) {
    console.log('字段列表:', Object.keys(resultSample));
    console.log('\n样本数据:');
    console.log(JSON.stringify(resultSample, null, 2));
  }

  // 5. 检查排除详情字段
  console.log('\n\n5️⃣ 排除详情字段:');
  console.log('='.repeat(80));
  const exclusionSample = await db.collection('hit_dlt_exclusiondetails').findOne({});
  if (exclusionSample) {
    console.log('字段列表:', Object.keys(exclusionSample));
    console.log('\n样本数据:');
    console.log(JSON.stringify(exclusionSample, null, 2));
  }

  await client.close();
  console.log('\n✅ 诊断完成');
}

diagnose().catch(console.error);
