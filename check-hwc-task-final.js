/**
 * 检查热温冷正选任务结果
 */

const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('数据库连接成功\n');

    const db = mongoose.connection.db;

    // 获取最新任务
    const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
      .findOne({}, {sort: {created_at: -1}});

    if (!latestTask) {
      console.log('未找到任务');
      return;
    }

    console.log('任务信息:');
    console.log('  ID:', latestTask.task_id);
    console.log('  名称:', latestTask.task_name);
    console.log('  状态:', latestTask.status);
    console.log('');

    // 获取任务结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({task_id: latestTask.task_id})
      .toArray();

    console.log('结果总数:', results.length);
    console.log('');

    // 统计
    const stats = results.map(r => ({
      period: r.period,
      is_predicted: r.is_predicted,
      red: r.red_combinations?.length || 0,
      blue: r.blue_combinations?.length || 0,
      paired: r.paired_combinations?.length || 0
    }));

    stats.sort((a, b) => a.period - b.period);

    console.log('前30个期号统计:');
    for (let i = 0; i < Math.min(30, stats.length); i++) {
      const s = stats[i];
      const pred = s.is_predicted ? '(推算)' : '';
      console.log(`  ${s.period} ${pred}: 红=${s.red}, 蓝=${s.blue}, 配对=${s.paired}`);
    }

    const zeroCount = stats.filter(s => s.red === 0).length;
    console.log(`\n红球组合为0的期号数: ${zeroCount}/${stats.length}`);

    if (zeroCount > 0) {
      console.log('\n红球为0的期号:');
      stats.filter(s => s.red === 0).slice(0, 10).forEach(s => {
        console.log('  ', s.period, s.is_predicted ? '(推算)' : '');
      });
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

check();
