/**
 * 测试修复后的热温冷正选批量预测任务创建
 * 验证当只有推算期时，系统能否正确生成期号对
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003';

async function testHwcTaskCreation() {
    console.log('🧪 测试热温冷正选批量预测任务创建\n');

    try {
        // 创建一个热温冷正选任务（最近10期）
        console.log('📝 步骤1: 创建热温冷正选批量预测任务...');
        const createResponse = await axios.post(`${API_BASE_URL}/api/dlt/hwc-positive-tasks/create`, {
            task_name: '测试修复_2025-11-24',
            period_range: {
                type: 'recent',
                value: 10
            },
            positive_selection: {
                red_hot_warm_cold_ratios: [
                    { hot: 4, warm: 1, cold: 0 }
                ],
                zone_ratios: ['2:1:2'],
                sum_ranges: [
                    { min: 60, max: 90 }
                ],
                span_ranges: [
                    { min: 18, max: 25 }
                ],
                odd_even_ratios: ['2:3', '3:2'],
                ac_values: [4, 5, 6],
                consecutive_settings: {
                    allow_2_consecutive: true,
                    allow_3_consecutive: false
                }
            },
            exclusion_conditions: {},
            output_config: {
                pairingMode: 'unlimited',
                batchSize: 50000,
                enableHitAnalysis: true,
                autoExport: true,
                previewMode: 'comprehensive',
                includeExclusionDetails: false,
                saveExclusionLimited: true,
                exclusionSavePeriods: 2
            }
        });

        if (createResponse.data.success) {
            const taskId = createResponse.data.data.task_id;
            console.log(`✅ 任务创建成功！`);
            console.log(`   任务ID: ${taskId}`);
            console.log(`   任务名称: ${createResponse.data.data.task_name}`);
            console.log(`   期号对数量: ${createResponse.data.data.issue_pairs?.length || '未知'}`);

            if (createResponse.data.data.issue_pairs && createResponse.data.data.issue_pairs.length > 0) {
                console.log(`\n📊 期号对详情（前5对）:`);
                createResponse.data.data.issue_pairs.slice(0, 5).forEach((pair, index) => {
                    console.log(`   ${index + 1}. ${pair.base_issue} → ${pair.target_issue}`);
                });
            }

            // 等待一下让任务开始处理
            console.log(`\n⏳ 等待5秒，然后查询任务状态...`);
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 查询任务状态
            console.log(`\n📝 步骤2: 查询任务状态...`);
            const statusResponse = await axios.get(`${API_BASE_URL}/api/dlt/prediction-tasks/${taskId}`);

            if (statusResponse.data.success) {
                const task = statusResponse.data.data;
                console.log(`✅ 任务状态查询成功：`);
                console.log(`   状态: ${task.status}`);
                console.log(`   进度: ${task.progress || 0}%`);
                console.log(`   错误信息: ${task.error_message || '无'}`);

                if (task.status === 'failed') {
                    console.log(`\n❌ 任务失败！错误信息:`);
                    console.log(`   ${task.error_message}`);
                    return false;
                } else if (task.status === 'processing' || task.status === 'completed') {
                    console.log(`\n✅ 修复验证成功！任务正在处理或已完成。`);
                    return true;
                }
            } else {
                console.log(`❌ 查询任务状态失败: ${statusResponse.data.message}`);
                return false;
            }
        } else {
            console.log(`❌ 任务创建失败: ${createResponse.data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`\n❌ 测试失败:`, error.response?.data || error.message);
        return false;
    }
}

// 执行测试
testHwcTaskCreation().then(success => {
    if (success) {
        console.log(`\n🎉 修复验证成功！`);
        process.exit(0);
    } else {
        console.log(`\n❌ 修复验证失败，请检查日志。`);
        process.exit(1);
    }
});
