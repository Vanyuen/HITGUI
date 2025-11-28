/**
 * 测试方案E智能混合存储的完整流程
 *
 * 测试范围: 25114-25124 (11期)
 * 验证内容:
 * 1. 排除详情能否正常保存（不超过16MB限制）
 * 2. 智能存储策略是否生效 (inline/compressed/chunked)
 * 3. 查询功能是否正常
 * 4. 性能是否符合预期
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3003';

async function testSmartStorage() {
    console.log('🚀 开始测试方案E智能混合存储\n');

    try {
        // 1. 创建测试任务
        console.log('📝 步骤1: 创建测试任务...');
        const createResponse = await axios.post(`${API_BASE}/api/dlt/hwc-positive-tasks/create`, {
            task_name: '方案E测试-25114-25124',
            period_range: {
                type: 'custom',
                value: {
                    start: '25114',
                    end: '25124'
                }
            },
            positive_selection: {
                hwc_ratios: [
                    { hot: 4, warm: 1, cold: 0 },
                    { hot: 3, warm: 2, cold: 0 },
                    { hot: 3, warm: 1, cold: 1 },
                    { hot: 2, warm: 2, cold: 1 }
                ]
            },
            exclusion_conditions: {
                zone_ratio: {
                    enabled: true,
                    allowed_ratios: ['1:2:2', '1:3:1', '1:1:3', '2:2:1', '2:1:2', '0:2:3', '0:3:2']
                },
                sum_value: {
                    enabled: true,
                    min: 50,
                    max: 130
                },
                span_value: {
                    enabled: true,
                    min: 15,
                    max: 35
                },
                odd_even_ratio: {
                    enabled: true,
                    allowed_ratios: ['1:4', '2:3', '3:2', '4:1']
                }
            }
        });

        if (!createResponse.data.success) {
            console.error('❌ 创建任务失败:', createResponse.data.message);
            return;
        }

        const taskId = createResponse.data.data?.task_id;
        console.log(`✅ 任务创建成功: ${taskId}\n`);

        // 2. 监控任务执行
        console.log('⏳ 步骤2: 监控任务执行...');
        let completed = false;
        let checkCount = 0;
        const maxChecks = 60; // 最多检查60次（10分钟）

        while (!completed && checkCount < maxChecks) {
            await sleep(10000); // 每10秒检查一次
            checkCount++;

            const statusResponse = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}`);
            const task = statusResponse.data.data;

            console.log(`  [${checkCount}] 状态: ${task.status}, 进度: ${task.progress || 0}%, 完成: ${task.completed_periods}/${task.total_periods}`);

            if (task.status === 'completed') {
                completed = true;
                console.log('✅ 任务执行完成\n');
            } else if (task.status === 'failed') {
                console.error('❌ 任务执行失败:', task.error_message);
                return;
            }
        }

        if (!completed) {
            console.error('❌ 任务超时（10分钟）');
            return;
        }

        // 3. 验证排除详情保存
        console.log('🔍 步骤3: 验证排除详情保存...');
        const detailsResponse = await axios.get(`${API_BASE}/api/dlt/exclusion-details/task/${taskId}`, {
            params: { period: '25114' }
        });

        if (!detailsResponse.data.success) {
            console.error('❌ 查询排除详情失败:', detailsResponse.data.message);
            return;
        }

        const details = detailsResponse.data.details;
        console.log(`✅ 查询到 ${details.length} 条排除详情记录\n`);

        // 分析存储策略
        const strategyStats = {
            inline: 0,
            compressed: 0,
            chunked: 0
        };

        details.forEach(detail => {
            const strategy = detail.storage_strategy || 'inline';
            strategyStats[strategy]++;
            console.log(`  期号: ${detail.period}, Step: ${detail.step}, 策略: ${strategy}, 排除数: ${detail.excluded_count}, 分片数: ${detail.total_chunks}`);
        });

        console.log('\n📊 存储策略统计:');
        console.log(`  inline (直接存储): ${strategyStats.inline} 条`);
        console.log(`  compressed (压缩存储): ${strategyStats.compressed} 条`);
        console.log(`  chunked (分片存储): ${strategyStats.chunked} 条`);

        // 4. 性能验证
        console.log('\n⚡ 步骤4: 性能验证...');
        const resultsResponse = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}/results`);
        const results = resultsResponse.data.data;

        if (results && results.length > 0) {
            const totalTime = results.reduce((sum, r) => sum + (r.processing_time || 0), 0);
            const avgTime = totalTime / results.length;
            console.log(`✅ 平均每期处理时间: ${avgTime.toFixed(2)}ms`);
            console.log(`✅ 总处理时间: ${(totalTime / 1000).toFixed(2)}秒`);

            if (avgTime < 500) {
                console.log('🎉 性能测试通过！平均每期 < 500ms');
            } else {
                console.log('⚠️  性能有待优化，平均每期 > 500ms');
            }
        }

        console.log('\n🎉 测试完成！方案E智能混合存储运行正常');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应错误:', error.response.data);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
testSmartStorage();
