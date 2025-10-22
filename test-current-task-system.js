/**
 * 测试当前任务系统的请求格式和性能
 * 用于验证任务系统是否真的未使用优化
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3003';

// 使用与前端相同的请求格式
const TEST_CONFIG = {
    task_name: "性能测试-5期",
    period_range: {
        type: "recent",
        value: 5
    },
    exclude_conditions: {
        sum: {
            enabled: true,
            ranges: [
                { enabled: true, min: 15, max: 50 },
                { enabled: true, min: 121, max: 165 }
            ],
            historical: { enabled: false }
        },
        ac: {
            enabled: true,
            excludeValues: [0, 1, 2, 3],
            historical: { enabled: false }
        },
        hwc: {
            excludeRatios: [
                "5:0:0", "0:5:0", "0:0:5", "4:0:1", "1:4:0",
                "0:4:1", "1:0:4", "0:1:4", "3:2:0", "3:1:1",
                "3:0:2", "2:3:0", "2:2:1", "2:1:2", "2:0:3",
                "1:3:1", "1:2:2", "1:1:3", "0:2:3"
            ],
            enabled: true,
            historical: { enabled: false }
        }
    },
    output_config: {
        combination_mode: "default"
    }
};

async function testTaskSystem() {
    console.log('='.repeat(80));
    console.log('🧪 测试当前任务系统性能');
    console.log('='.repeat(80));
    console.log();

    try {
        console.log('📋 测试配置:');
        console.log(`   - 任务名称: ${TEST_CONFIG.task_name}`);
        console.log(`   - 期号范围: 最近${TEST_CONFIG.period_range.value}期`);
        console.log(`   - 排除条件: 和值、AC值、热温冷比`);
        console.log();

        console.log('⏱️  发送任务创建请求...');
        const startTime = Date.now();

        const response = await fetch(`${API_BASE}/api/dlt/prediction-tasks/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_CONFIG)
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ 请求完成！耗时: ${duration}ms (${(duration / 1000).toFixed(2)}秒)`);
        console.log();

        if (!response.ok) {
            const text = await response.text();
            console.error('❌ HTTP错误:', response.status, response.statusText);
            console.error('响应内容:', text);
            return;
        }

        const result = await response.json();

        if (!result.success) {
            console.error('❌ API返回失败:', result.message || '未知错误');
            console.error('完整响应:', JSON.stringify(result, null, 2));
            return;
        }

        console.log('✅ 任务创建成功！');
        console.log('📊 任务信息:');
        console.log(`   - Task ID: ${result.data.task_id || '未知'}`);
        console.log(`   - 状态: ${result.data.status || '未知'}`);
        console.log(`   - 期号范围: ${JSON.stringify(result.data.period_range)}`);
        console.log();

        // 等待任务完成（轮询）
        console.log('⏳ 等待任务完成...');
        const taskId = result.data.task_id;
        let taskCompleted = false;
        let checkCount = 0;
        const maxChecks = 60; // 最多检查60次（60秒）

        while (!taskCompleted && checkCount < maxChecks) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
            checkCount++;

            const statusResponse = await fetch(`${API_BASE}/api/dlt/prediction-tasks/${taskId}`);
            if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                if (statusResult.success && statusResult.data) {
                    const status = statusResult.data.status;
                    const progress = statusResult.data.progress;

                    console.log(`   检查 ${checkCount}: 状态=${status}, 进度=${progress?.percentage || 0}% (${progress?.current || 0}/${progress?.total || 0})`);

                    if (status === 'completed') {
                        taskCompleted = true;
                        const totalTime = Date.now() - startTime;
                        console.log();
                        console.log('='.repeat(80));
                        console.log('✅ 任务完成！');
                        console.log('='.repeat(80));
                        console.log();
                        console.log('📊 统计信息:');
                        console.log(`   - 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
                        console.log(`   - 总期数: ${statusResult.data.statistics?.total_periods || '未知'}`);
                        console.log(`   - 总组合: ${statusResult.data.statistics?.total_combinations || '未知'}`);
                        console.log(`   - 平均命中率: ${statusResult.data.statistics?.avg_hit_rate || 0}%`);
                        console.log();

                        // 性能评估
                        const avgTimePerIssue = totalTime / (statusResult.data.statistics?.total_periods || 1);
                        console.log('⚡ 性能分析:');
                        console.log(`   - 平均每期处理时间: ${avgTimePerIssue.toFixed(0)}ms`);

                        if (totalTime < 1000) {
                            console.log('   - 性能评级: ⭐⭐⭐⭐⭐ 优秀');
                        } else if (totalTime < 3000) {
                            console.log('   - 性能评级: ⭐⭐⭐⭐ 良好');
                        } else if (totalTime < 5000) {
                            console.log('   - 性能评级: ⭐⭐⭐ 一般');
                        } else {
                            console.log('   - 性能评级: ⭐⭐ 需要优化');
                        }

                        console.log();
                        console.log('💡 对比分析:');
                        const estimated20 = (avgTimePerIssue * 20) / 1000;
                        console.log(`   - 预估20期耗时: ~${estimated20.toFixed(1)}秒`);
                        console.log(`   - 优化目标: <3秒`);
                        if (estimated20 > 3) {
                            console.log(`   - ❌ 未达到优化目标，任务系统确实需要集成优化代码`);
                        } else {
                            console.log(`   - ✅ 已达到优化目标！`);
                        }
                    } else if (status === 'failed') {
                        console.log();
                        console.error('❌ 任务执行失败');
                        console.error('错误信息:', statusResult.data.error_message || '未知');
                        break;
                    }
                }
            }
        }

        if (!taskCompleted) {
            console.log();
            console.error('⚠️ 任务超时（60秒），停止检查');
        }

    } catch (error) {
        console.error();
        console.error('❌ 测试失败:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

testTaskSystem().then(() => {
    console.log();
    console.log('='.repeat(80));
    console.log('🏁 测试完成！');
    console.log('='.repeat(80));
    process.exit(0);
}).catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
});
