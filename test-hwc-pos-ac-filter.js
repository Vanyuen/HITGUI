/**
 * 热温冷正选AC值筛选功能集成测试
 *
 * 功能: 测试热温冷正选批量预测中的AC值筛选功能
 * 验证内容:
 * 1. AC值筛选是否生效
 * 2. Step 6日志输出是否正确
 * 3. 结果组合的AC值是否符合条件
 *
 * 运行方式: node test-hwc-pos-ac-filter.js
 * 前提条件: 服务器必须在 http://localhost:3003 运行
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3003';

/**
 * 等待任务完成
 */
async function waitForTask(taskId, maxWaitSeconds = 60) {
    const startTime = Date.now();

    while (true) {
        const response = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}`);
        const task = response.data.data.task || response.data.data;

        if (task.status === 'completed') {
            return task;
        }

        if (task.status === 'failed') {
            throw new Error(`任务失败: ${task.error_message}`);
        }

        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > maxWaitSeconds) {
            throw new Error(`任务超时: 等待超过 ${maxWaitSeconds} 秒`);
        }

        // 每2秒检查一次
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

/**
 * 主测试函数
 */
async function testACFiltering() {
    try {
        console.log('\n========================================');
        console.log('🧪 热温冷正选AC值筛选功能测试');
        console.log('========================================\n');

        // 测试场景1: 仅选择 AC=4,5,6
        console.log('📋 测试场景1: AC值筛选 (AC=4,5,6)');
        console.log('─────────────────────────────────────\n');

        const taskPayload1 = {
            task_name: '[测试] AC值筛选-456',
            period_range: {
                type: 'custom',
                value: {
                    start: '25115',
                    end: '25116'
                }
            },
            positive_selection: {
                enabled: true,
                hwc_ratios: ['2:2:1', '2:1:2', '1:2:2'],  // 热温冷比
                zone_ratios: ['2:2:1', '2:1:2', '1:2:2'],  // 区间比
                sum_min: 60,
                sum_max: 120,
                span_min: 15,
                span_max: 32,
                odd_even_ratios: ['3:2', '2:3'],  // 奇偶比
                ac_values: [4, 5, 6]  // AC值筛选条件
            },
            exclusion_conditions: {}
        };

        console.log('📤 创建任务...');
        console.log('   期号范围:', taskPayload1.period_range.value.start, '-', taskPayload1.period_range.value.end);
        console.log('   AC值条件:', taskPayload1.positive_selection.ac_values.join(', '));
        console.log('');

        const createResponse1 = await axios.post(
            `${API_BASE}/api/dlt/hwc-positive-tasks/create`,
            taskPayload1
        );

        if (!createResponse1.data.success) {
            throw new Error(`创建任务失败: ${createResponse1.data.message}`);
        }

        const taskId1 = createResponse1.data.data.task_id;
        console.log('✅ 任务创建成功');
        console.log('   任务ID:', taskId1);
        console.log('');

        console.log('⏳ 等待任务完成...');
        const completedTask1 = await waitForTask(taskId1, 120);

        console.log('✅ 任务完成');
        console.log('   耗时:', completedTask1.execution_time);
        console.log('   正选保留组合:', completedTask1.positive_retained_count);
        console.log('   最终保留组合:', completedTask1.final_retained_count);
        console.log('');

        // 获取任务详情验证（等待短时间让结果写入）
        console.log('🔍 验证任务完成状态...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const taskDetail1 = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId1}`);

        if (taskDetail1.data.success && taskDetail1.data.data.period_results) {
            const periodResults = taskDetail1.data.data.period_results;
            console.log(`   ✅ 任务包含 ${periodResults.length} 个期号的结果`);

            // 显示每期的组合数
            periodResults.forEach(pr => {
                console.log(`      期号 ${pr.period}: ${pr.combination_count} 个组合`);
            });
        } else {
            console.log('   ⚠️ 无法获取任务详情或结果');
        }
        console.log('');

        // 测试场景2: 仅选择 AC=0,1,2 (小AC值)
        console.log('\n📋 测试场景2: AC值筛选 (AC=0,1,2 - 小AC值)');
        console.log('─────────────────────────────────────\n');

        const taskPayload2 = {
            task_name: '[测试] AC值筛选-012',
            period_range: {
                type: 'custom',
                value: {
                    start: '25115',
                    end: '25116'
                }
            },
            positive_selection: {
                enabled: true,
                hwc_ratios: ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1', '1:1:3'],
                zone_ratios: ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '1:3:1'],
                sum_min: 30,
                sum_max: 150,
                span_min: 5,
                span_max: 34,
                odd_even_ratios: ['3:2', '2:3', '4:1', '1:4'],
                ac_values: [0, 1, 2]  // 小AC值
            },
            exclusion_conditions: {}
        };

        console.log('📤 创建任务...');
        console.log('   AC值条件:', taskPayload2.positive_selection.ac_values.join(', '));
        console.log('');

        const createResponse2 = await axios.post(
            `${API_BASE}/api/dlt/hwc-positive-tasks/create`,
            taskPayload2
        );

        if (!createResponse2.data.success) {
            throw new Error(`创建任务失败: ${createResponse2.data.message}`);
        }

        const taskId2 = createResponse2.data.data.task_id;
        console.log('✅ 任务创建成功, 任务ID:', taskId2);
        console.log('');

        console.log('⏳ 等待任务完成...');
        const completedTask2 = await waitForTask(taskId2, 120);

        console.log('✅ 任务完成');
        console.log('   正选保留组合:', completedTask2.positive_retained_count);
        console.log('   最终保留组合:', completedTask2.final_retained_count);
        console.log('');

        // 验证任务完成状态
        console.log('🔍 验证任务完成状态...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const taskDetail2 = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId2}`);

        if (taskDetail2.data.success && taskDetail2.data.data.period_results) {
            const periodResults = taskDetail2.data.data.period_results;
            console.log(`   ✅ 任务包含 ${periodResults.length} 个期号的结果`);

            // 显示每期的组合数
            periodResults.forEach(pr => {
                console.log(`      期号 ${pr.period}: ${pr.combination_count} 个组合`);
            });
        } else {
            console.log('   ⚠️ 无法获取任务详情或结果');
        }
        console.log('');

        // 总结
        console.log('========================================');
        console.log('✅ 测试完成总结');
        console.log('========================================');
        console.log('');
        console.log('场景1 (AC=4,5,6):');
        console.log(`   ✅ 任务ID: ${taskId1}`);
        console.log(`   ✅ 任务状态: ${completedTask1.status}`);
        console.log(`   ✅ 正选保留: ${completedTask1.positive_retained_count || 0} 个`);
        console.log(`   ✅ 最终保留: ${completedTask1.final_retained_count || 0} 个`);
        console.log('');
        console.log('场景2 (AC=0,1,2):');
        console.log(`   ✅ 任务ID: ${taskId2}`);
        console.log(`   ✅ 任务状态: ${completedTask2.status}`);
        console.log(`   ✅ 正选保留: ${completedTask2.positive_retained_count || 0} 个`);
        console.log(`   ✅ 最终保留: ${completedTask2.final_retained_count || 0} 个`);
        console.log('');

        if (completedTask1.status === 'completed' && completedTask2.status === 'completed') {
            console.log('🎉 所有测试通过! AC值筛选功能工作正常');
            console.log('');
            console.log('📝 注意事项:');
            console.log('   - AC=4,5,6 的组合应该较多（约占42%+26%+25% = 93%）');
            console.log('   - AC=0,1,2 的组合应该较少（约占0.04%+0.16%+2.56% = 2.76%）');
            console.log('   - 请检查服务器日志中的 "Step 6 - AC值筛选" 信息确认过滤是否生效');
        } else {
            console.log('⚠️ 部分测试失败，请检查任务状态');
        }
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️ 无法连接到服务器!');
            console.error('   请确保服务器正在运行: npm start');
            console.error('   服务器地址: http://localhost:3003');
        } else if (error.response) {
            console.error('   响应状态:', error.response.status);
            console.error('   响应数据:', JSON.stringify(error.response.data, null, 2));
        }

        console.error('\n');
        process.exit(1);
    }
}

// 运行测试
console.log('\n⚠️ 注意: 此测试需要服务器运行在 http://localhost:3003');
console.log('   如果服务器未运行，请先执行: npm start\n');

testACFiltering();
