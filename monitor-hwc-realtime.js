const mongoose = require('mongoose');

async function monitorRealtime() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
  const db = mongoose.connection.db;

  console.log('⏱️  实时监控热温冷优化表生成进度\n');
  console.log('按 Ctrl+C 停止监控\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
  let lastCount = 0;
  let noChangeCount = 0;

  for (let i = 0; i < 60; i++) {
    const count = await db.collection(collection).countDocuments();

    // 获取最新记录
    const latest = await db.collection(collection)
      .find({}).sort({ target_issue: -1 }).limit(1).toArray();

    const latestPair = latest.length > 0
      ? `${latest[0].base_issue}→${latest[0].target_issue}`
      : 'N/A';

    const progress = ((count / 2791) * 100).toFixed(1);
    const increment = count - lastCount;
    const status = increment > 0 ? `📈 +${increment}` : increment < 0 ? `📉 ${increment}` : '⏸️  停止';

    console.log(`[${new Date().toLocaleTimeString()}] 记录数: ${count}/2791 (${progress}%) | 最新: ${latestPair} | ${status}`);

    if (count === lastCount) {
      noChangeCount++;
      if (noChangeCount >= 3) {
        console.log('\n⚠️  记录数连续3次未变化，任务可能已停止或出错\n');
        break;
      }
    } else {
      noChangeCount = 0;
    }

    if (count >= 2791) {
      console.log('\n✅ 全量重建完成！\n');
      break;
    }

    lastCount = count;
    await new Promise(resolve => setTimeout(resolve, 2000)); // 每2秒检查一次
  }

  await mongoose.connection.close();
}

monitorRealtime().catch(error => {
  console.error('❌ 监控失败:', error.message);
  process.exit(1);
});
