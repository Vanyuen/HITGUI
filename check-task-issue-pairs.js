const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const Task = mongoose.model('hit_dlt_hwcpositivepredictiontasks',
      new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' })
    );

    // 查找最新任务
    const latestTask = await Task.findOne().sort({ created_at: -1 }).lean();

    if (!latestTask) {
      console.log('❌ 未找到任何任务');
      process.exit(1);
    }

    console.log('=== 最新任务的期号对配置 ===');
    console.log('任务ID:', latestTask.task_id);
    console.log('任务名称:', latestTask.task_name);
    console.log('');

    if (latestTask.issue_pairs && latestTask.issue_pairs.length > 0) {
      console.log('✅ 任务保存了 issue_pairs:', latestTask.issue_pairs.length, '对');
      console.log('\n前5个期号对:');
      latestTask.issue_pairs.slice(0, 5).forEach((pair, idx) => {
        console.log(`  ${idx + 1}. ${pair.base} -> ${pair.target} (isPredicted: ${pair.isPredicted})`);
      });

      console.log('\n后5个期号对:');
      latestTask.issue_pairs.slice(-5).forEach((pair, idx) => {
        const actualIdx = latestTask.issue_pairs.length - 5 + idx + 1;
        console.log(`  ${actualIdx}. ${pair.base} -> ${pair.target} (isPredicted: ${pair.isPredicted})`);
      });
    } else {
      console.log('❌ 任务没有保存 issue_pairs!');
    }

    console.log('\n=== 关键分析 ===');
    console.log('检查25115期的期号对配置:');
    if (latestTask.issue_pairs) {
      const pair25115 = latestTask.issue_pairs.find(p => p.target === '25115' || p.target === 25115);
      if (pair25115) {
        console.log('  ✅ 找到25115期的配置:');
        console.log('     base:', pair25115.base, '(类型:', typeof pair25115.base + ')');
        console.log('     target:', pair25115.target, '(类型:', typeof pair25115.target + ')');
        console.log('     isPredicted:', pair25115.isPredicted);
      } else {
        console.log('  ❌ 未找到25115期的期号对配置!');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
