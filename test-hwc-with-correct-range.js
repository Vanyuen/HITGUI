/**
 * 测试使用正确期号范围的热温冷正选批量预测
 *
 * 使用已开奖的期号范围: 25111-25121 (最近11期)
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003';

async function testHwcPrediction() {
  try {
    console.log('🧪 测试热温冷正选批量预测（使用正确期号范围）\n');

    // 1. 先获取数据库中的实际期号范围
    console.log('📅 步骤1: 获取数据库中的实际期号范围...');
    const rangeResponse = await axios.post(`${API_BASE_URL}/api/dlt/resolve-issue-range`, {
      rangeType: 'recent',
      recentCount: 11
    });

    const issueList = rangeResponse.data.issueList;
    console.log(`✅ 最近11期: ${issueList.slice(0, 5).join(', ')} ... ${issueList.slice(-3).join(', ')}`);
    console.log(`   期号范围: ${issueList[0]} - ${issueList[issueList.length - 1]}\n`);

    // 2. 创建热温冷正选任务
    console.log('📝 步骤2: 创建热温冷正选批量预测任务...');

    const taskData = {
      task_name: '热温冷正选测试_正确期号范围',
      issue_list: issueList,
      hot_warm_cold_ratio: { hot: 4, warm: 1, cold: 0 },
      zone_ratio: { zone1: 2, zone2: 1, zone3: 2 },
      odd_even_ratio: [
        { odd: 2, even: 3 },
        { odd: 3, even: 2 }
      ],
      exclusion_conditions: {}
    };

    console.log('任务参数:');
    console.log(`  - 任务名称: ${taskData.task_name}`);
    console.log(`  - 期号数量: ${taskData.issue_list.length} 期`);
    console.log(`  - 热温冷比: 4:1:0`);
    console.log(`  - 区间比: 2:1:2`);
    console.log(`  - 奇偶比: 2:3, 3:2\n`);

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/dlt/hwc-positive-prediction-tasks/create`,
      taskData
    );

    if (createResponse.data.success) {
      const taskId = createResponse.data.task_id;
      console.log(`✅ 任务创建成功！`);
      console.log(`   任务ID: ${taskId}\n`);

      // 3. 等待任务完成
      console.log('⏳ 步骤3: 等待任务处理...');

      let completed = false;
      let attempts = 0;
      const maxAttempts = 30; // 最多等待30秒

      while (!completed && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒

        const statusResponse = await axios.get(
          `${API_BASE_URL}/api/dlt/hwc-positive-prediction-tasks/${taskId}`
        );

        const task = statusResponse.data.task;

        if (task.status === 'completed') {
          completed = true;
          console.log(`\n✅ 任务已完成！(耗时: ${attempts}秒)\n`);

          // 4. 显示结果
          console.log('📊 任务结果:');
          console.log('='.repeat(80));

          if (task.results && task.results.length > 0) {
            console.log(`  总组合数: ${task.results.length}`);

            // 统计各期命中情况
            const hitStats = {};
            task.results.forEach(result => {
              if (!hitStats[result.issue]) {
                hitStats[result.issue] = {
                  total: 0,
                  has_hit: 0
                };
              }
              hitStats[result.issue].total++;
              if (result.prize_level && result.prize_level !== '未中奖') {
                hitStats[result.issue].has_hit++;
              }
            });

            console.log(`\n  各期组合统计:`);
            Object.keys(hitStats).sort().forEach(issue => {
              const stats = hitStats[issue];
              const hitRate = ((stats.has_hit / stats.total) * 100).toFixed(2);
              console.log(`    ${issue}: ${stats.total} 组合, ${stats.has_hit} 命中 (${hitRate}%)`);
            });

            // 显示前5个组合
            console.log(`\n  前5个组合示例:`);
            task.results.slice(0, 5).forEach((result, index) => {
              const redBalls = result.red_combination.join(',');
              const blueBalls = result.blue_combination.join(',');
              console.log(`    ${index + 1}. [${redBalls}] + [${blueBalls}] - 期号:${result.issue} - ${result.prize_level || '未中奖'}`);
            });

          } else {
            console.log(`  ❌ 没有生成任何组合！`);
            console.log(`  这可能是因为条件过于严格`);
          }

          console.log('='.repeat(80));

        } else if (task.status === 'failed') {
          console.log(`\n❌ 任务失败！`);
          console.log(`   错误信息: ${task.error_message || '未知错误'}`);
          break;
        } else {
          process.stdout.write(`\r⏳ 处理中... (${attempts}s) - 状态: ${task.status}`);
        }
      }

      if (!completed) {
        console.log(`\n⚠️  任务超时 (${maxAttempts}秒)`);
      }

    } else {
      console.log(`❌ 任务创建失败: ${createResponse.data.message}`);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   响应数据:', error.response.data);
    }
  }
}

// 检查服务是否运行
axios.get(`${API_BASE_URL}/api/dlt/data-import/status`)
  .then(() => {
    console.log('✅ 服务器正在运行\n');
    testHwcPrediction();
  })
  .catch(error => {
    console.error('❌ 无法连接到服务器，请确保应用正在运行！');
    console.error(`   URL: ${API_BASE_URL}`);
    process.exit(1);
  });
