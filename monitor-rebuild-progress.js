const mongoose = require('mongoose');

let checkCount = 0;
const maxChecks = 120; // 最多检查2分钟（每秒检查一次）

console.log('🔍 正在监控全量重建进度...\n');
console.log('提示: 按 Ctrl+C 可随时停止监控\n');
console.log('═══════════════════════════════════════════════════════════════\n');

async function checkProgress() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      serverSelectionTimeoutMS: 5000
    });

    const db = mongoose.connection.db;
    const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

    const interval = setInterval(async () => {
      try {
        checkCount++;

        // 获取当前记录数
        const totalCount = await db.collection(collection).countDocuments();

        // 获取最新记录
        const latest = await db.collection(collection)
          .find({})
          .sort({ target_issue: -1 })
          .limit(1)
          .toArray();

        const latestPair = latest.length > 0
          ? `${latest[0].base_issue}→${latest[0].target_issue}`
          : '暂无数据';

        // 清屏并显示进度（使用\r实现同行刷新）
        process.stdout.write(`\r📊 当前进度: 总记录数=${totalCount.toLocaleString()}/2791, 最新期号对=${latestPair}   `);

        // 检查是否完成
        if (totalCount === 2791 && latest.length > 0 && latest[0].target_issue === 25125) {
          console.log('\n\n═══════════════════════════════════════════════════════════════');
          console.log('🎉 全量重建已完成！');
          console.log('═══════════════════════════════════════════════════════════════\n');
          console.log('✅ 总记录数: 2791');
          console.log('✅ 最新期号对: 25124→25125\n');
          console.log('请运行验证脚本确认：');
          console.log('node verify-full-rebuild-result.js\n');

          clearInterval(interval);
          await mongoose.connection.close();
          process.exit(0);
        }

        // 超时检查
        if (checkCount >= maxChecks) {
          console.log('\n\n⏱️  监控超时（2分钟），但进程可能仍在运行...');
          console.log('当前状态:');
          console.log(`  记录数: ${totalCount}`);
          console.log(`  最新期号对: ${latestPair}`);
          console.log('\n请继续等待，或手动运行验证脚本检查：');
          console.log('node verify-full-rebuild-result.js\n');

          clearInterval(interval);
          await mongoose.connection.close();
          process.exit(0);
        }

      } catch (err) {
        console.error('\n❌ 检查进度失败:', err.message);
        clearInterval(interval);
        await mongoose.connection.close();
        process.exit(1);
      }
    }, 1000); // 每秒检查一次

  } catch (err) {
    console.error('❌ 数据库连接失败:', err.message);
    console.error('\n可能原因:');
    console.error('1. MongoDB服务未运行');
    console.error('2. 数据库连接配置错误');
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  监控已停止');
  console.log('您可以稍后运行验证脚本检查结果：');
  console.log('node verify-full-rebuild-result.js\n');
  await mongoose.connection.close();
  process.exit(0);
});

checkProgress();
