/**
 * 通过数据库直接删除卡住的任务
 * 比API删除更快，因为可以批量操作
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const taskSchema = new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' });
const resultSchema = new mongoose.Schema({}, { strict: false, collection: 'PredictionTaskResult' });
const exclusionSchema = new mongoose.Schema({}, { strict: false, collection: 'DLTExclusionDetails' });

const PredictionTask = mongoose.model('PredictionTask', taskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult', resultSchema);
const DLTExclusionDetails = mongoose.model('DLTExclusionDetails', exclusionSchema);

async function deleteStuckTask() {
  let mongoServer;

  try {
    const taskId = 'task_1761564137120_qdsiwi0ja';

    console.log('🔌 连接数据库...\n');

    // 尝试连接本地MongoDB
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 3000
      });
      console.log('✅ 已连接到本地 MongoDB\n');
    } catch (localError) {
      console.log('⚠️  本地MongoDB连接失败，尝试内存数据库...\n');

      // 启动MongoDB Memory Server
      mongoServer = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'lottery',
          storageEngine: 'wiredTiger'
        }
      });
      const uri = mongoServer.getUri();
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ 已连接到 MongoDB Memory Server\n');
    }

    // 开始删除
    console.log(`🗑️  开始删除任务: ${taskId}\n`);

    // 1. 删除任务本身
    console.log('1️⃣ 删除任务记录...');
    const taskResult = await PredictionTask.deleteOne({ task_id: taskId });
    console.log(`   ✅ 删除任务: ${taskResult.deletedCount} 条\n`);

    // 2. 删除任务结果
    console.log('2️⃣ 删除任务结果...');
    const resultResult = await PredictionTaskResult.deleteMany({ task_id: taskId });
    console.log(`   ✅ 删除结果: ${resultResult.deletedCount} 条\n`);

    // 3. 删除排除详情（可能很多）
    console.log('3️⃣ 删除排除详情（可能需要较长时间）...');
    const startTime = Date.now();
    const exclusionResult = await DLTExclusionDetails.deleteMany({ task_id: taskId });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ✅ 删除排除详情: ${exclusionResult.deletedCount} 条 (耗时 ${duration}s)\n`);

    console.log('🎉 任务删除成功！\n');
    console.log('📊 删除统计:');
    console.log(`   - 任务: ${taskResult.deletedCount}`);
    console.log(`   - 结果: ${resultResult.deletedCount}`);
    console.log(`   - 排除详情: ${exclusionResult.deletedCount}`);

    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();

  } catch (error) {
    console.error('❌ 删除失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteStuckTask();
