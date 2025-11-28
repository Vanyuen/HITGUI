const mongoose = require('mongoose');

async function monitorUpdate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
  const db = mongoose.connection.db;

  console.log('⏳ 监控热温冷优化表更新进度...\n');

  const COLLECTION = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
  const TARGET_COUNT = 2791; // 2792期 - 1 = 2791对

  let lastCount = 0;
  let stableCount = 0;

  for (let i = 0; i < 60; i++) { // 最多监控3分钟
    const count = await db.collection(COLLECTION).countDocuments();

    if (count === lastCount) {
      stableCount++;
    } else {
      stableCount = 0;
    }

    const progress = ((count / TARGET_COUNT) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 100)) + '░'.repeat(Math.ceil((TARGET_COUNT - count) / 100));

    console.log(`[${new Date().toLocaleTimeString()}] 记录数: ${count}/${TARGET_COUNT} (${progress}%) ${bar}`);

    if (count >= TARGET_COUNT) {
      console.log('\n✅ 更新完成！');
      break;
    }

    if (stableCount >= 3) {
      console.log(`\n⚠️  记录数稳定在 ${count}，可能更新已停止或出错`);
      break;
    }

    lastCount = count;
    await new Promise(resolve => setTimeout(resolve, 3000)); // 每3秒检查一次
  }

  await mongoose.connection.close();
}

monitorUpdate().catch(error => {
  console.error('❌ 监控失败:', error.message);
  process.exit(1);
});
