/**
 * 热温冷正选批量预测任务进度监控脚本
 * 实时查看任务执行状态和进度
 */

const http = require('http');

const TASK_ID = 'hwc-pos-20251113-m62'; // 当前任务ID
const API_BASE = 'http://localhost:3003';
const CHECK_INTERVAL = 5000; // 5秒检查一次

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}时${minutes % 60}分${seconds % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkTaskStatus() {
  try {
    const response = await httpGet(`${API_BASE}/api/dlt/prediction-tasks/${TASK_ID}/status`);

    if (!response.success) {
      console.log(colorize('❌ 任务查询失败:', 'red'), response.message);
      return null;
    }

    const task = response.data;

    // 清屏
    console.clear();

    // 显示任务信息
    console.log(colorize('━'.repeat(80), 'cyan'));
    console.log(colorize('🎯 热温冷正选批量预测任务监控', 'bright'));
    console.log(colorize('━'.repeat(80), 'cyan'));
    console.log();

    // 基本信息
    console.log(colorize('📋 任务信息:', 'bright'));
    console.log(`  任务ID: ${colorize(task.task_id, 'cyan')}`);
    console.log(`  任务名称: ${colorize(task.task_name, 'yellow')}`);
    console.log(`  创建时间: ${new Date(task.created_at).toLocaleString('zh-CN')}`);
    console.log();

    // 状态信息
    const statusColor =
      task.status === 'completed' ? 'green' :
      task.status === 'failed' ? 'red' :
      task.status === 'processing' ? 'yellow' :
      'blue';

    console.log(colorize('📊 执行状态:', 'bright'));
    console.log(`  当前状态: ${colorize(task.status.toUpperCase(), statusColor)}`);

    if (task.progress) {
      const progressPercent = ((task.progress.processed / task.progress.total) * 100).toFixed(2);
      const progressBar = '█'.repeat(Math.floor(progressPercent / 2)) + '░'.repeat(50 - Math.floor(progressPercent / 2));

      console.log(`  处理进度: [${colorize(progressBar, 'green')}] ${colorize(progressPercent + '%', 'bright')}`);
      console.log(`  已处理: ${colorize(task.progress.processed, 'cyan')} / ${task.progress.total} 期`);

      if (task.progress.current_issue) {
        console.log(`  当前期号: ${colorize(task.progress.current_issue, 'yellow')}`);
      }
    }

    // 时间信息
    if (task.started_at) {
      const startTime = new Date(task.started_at);
      const now = new Date();
      const elapsed = now - startTime;

      console.log(`  已运行时间: ${colorize(formatTime(elapsed), 'cyan')}`);

      if (task.progress && task.progress.processed > 0) {
        const avgTimePerIssue = elapsed / task.progress.processed;
        const remaining = task.progress.total - task.progress.processed;
        const estimatedRemaining = avgTimePerIssue * remaining;

        console.log(`  预计剩余: ${colorize(formatTime(estimatedRemaining), 'yellow')}`);
        console.log(`  预计完成: ${colorize(new Date(now.getTime() + estimatedRemaining).toLocaleString('zh-CN'), 'green')}`);
      }
    }
    console.log();

    // 结果统计
    if (task.result_summary) {
      console.log(colorize('📈 结果统计:', 'bright'));
      console.log(`  保留组合数: ${colorize(task.result_summary.retained_count?.toLocaleString() || '0', 'green')}`);
      console.log(`  排除组合数: ${colorize(task.result_summary.excluded_count?.toLocaleString() || '0', 'red')}`);
      console.log(`  命中分析: ${task.result_summary.hit_analysis_enabled ? colorize('✅ 已启用', 'green') : '❌ 未启用'}`);
      console.log();
    }

    // 完成或失败信息
    if (task.status === 'completed') {
      console.log(colorize('✅ 任务已完成!', 'green'));
      if (task.completed_at) {
        const totalTime = new Date(task.completed_at) - new Date(task.started_at);
        console.log(`  总耗时: ${colorize(formatTime(totalTime), 'cyan')}`);
      }
      if (task.export_path) {
        console.log(`  导出文件: ${colorize(task.export_path, 'yellow')}`);
      }
      console.log();
      console.log(colorize('━'.repeat(80), 'cyan'));
      return 'completed';
    } else if (task.status === 'failed') {
      console.log(colorize('❌ 任务失败!', 'red'));
      if (task.error_message) {
        console.log(`  错误信息: ${colorize(task.error_message, 'red')}`);
      }
      console.log();
      console.log(colorize('━'.repeat(80), 'cyan'));
      return 'failed';
    }

    console.log(colorize('━'.repeat(80), 'cyan'));
    console.log(colorize(`⏱️  下次更新: ${CHECK_INTERVAL / 1000}秒后... (按 Ctrl+C 退出)`, 'blue'));

    return task.status;
  } catch (error) {
    console.log(colorize('❌ 连接服务器失败:', 'red'), error.message);
    console.log(colorize('请确保应用正在运行 (npm start)', 'yellow'));
    return null;
  }
}

async function startMonitoring() {
  console.log(colorize('🚀 启动任务监控...', 'cyan'));
  console.log();

  const status = await checkTaskStatus();

  if (status === 'completed' || status === 'failed' || status === null) {
    process.exit(0);
  }

  setInterval(async () => {
    const status = await checkTaskStatus();
    if (status === 'completed' || status === 'failed' || status === null) {
      process.exit(0);
    }
  }, CHECK_INTERVAL);
}

// 启动监控
startMonitoring();
