/**
 * 排除追踪功能集成测试脚本
 *
 * 测试内容:
 * 1. 创建热温冷正选批量预测任务
 * 2. 验证 positive_selection_details 字段保存正确
 * 3. 验证 DLTExclusionDetails 表记录正确
 * 4. 测试组合排除路径查询API
 * 5. 测试步骤统计分析API
 *
 * 运行方式: node test-exclusion-tracking.js
 * 前提条件: 服务器必须在 http://localhost:3003 运行
 */

const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:3003';
const DB_URL = 'mongodb://127.0.0.1:27017/lottery';

/**
 * 等待任务完成
 */
async function waitForTask(taskId, maxWaitSeconds = 120) {
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
async function testExclusionTracking() {
    let mongoConnection = null;

    try {
        console.log('\n========================================');
        console.log('🧪 排除追踪功能集成测试');
        console.log('========================================\n');

        // ===== 第1步: 创建测试任务 =====
        console.log('📋 第1步: 创建测试任务');
        console.log('─────────────────────────────────────\n');

        const taskPayload = {
            task_name: '[测试] 排除追踪功能验证',
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
                sum_ranges: [
                    { min: 65, max: 90 },
                    { min: 91, max: 115 }
                ],
                span_ranges: [
                    { min: 18, max: 25 },
                    { min: 26, max: 32 }
                ],
                odd_even_ratios: ['2:3', '3:2'],  // 奇偶比
                ac_values: [4, 5, 6]  // AC值
            },
            exclusion_conditions: {}
        };

        console.log('📤 发送任务创建请求...');
        const createResponse = await axios.post(
            `${API_BASE}/api/dlt/hwc-positive-tasks/create`,
            taskPayload
        );

        if (!createResponse.data.success) {
            throw new Error(`创建任务失败: ${createResponse.data.message}`);
        }

        const taskId = createResponse.data.data.task_id;
        console.log(`✅ 任务创建成功`);
        console.log(`   任务ID: ${taskId}\n`);

        // ===== 第2步: 等待任务完成 =====
        console.log('⏳ 第2步: 等待任务完成...');
        const completedTask = await waitForTask(taskId, 120);
        console.log(`✅ 任务完成\n`);

        // ===== 第3步: 验证数据库记录 =====
        console.log('🔍 第3步: 验证数据库记录');
        console.log('─────────────────────────────────────\n');

        // 连接数据库
        console.log('📡 连接数据库...');
        mongoConnection = await mongoose.connect(DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 验证 positive_selection_details
        const HwcPositivePredictionTaskResult = mongoose.model('HwcPositivePredictionTaskResult',
            new mongoose.Schema({}, { strict: false }));

        const result = await HwcPositivePredictionTaskResult.findOne({
            task_id: taskId
        }).lean();

        if (!result) {
            throw new Error('未找到任务结果记录');
        }

        console.log('✅ 结果记录已找到');
        console.log(`   期号: ${result.period}`);
        console.log(`   组合数: ${result.combination_count}\n`);

        // 验证 positive_selection_details 字段
        if (!result.positive_selection_details) {
            throw new Error('❌ positive_selection_details 字段不存在');
        }

        const details = result.positive_selection_details;
        console.log('✅ positive_selection_details 字段存在');
        console.log(`   Step 1 基准数量: ${details.step1_count}`);
        console.log(`   Step 1 基准ID数量: ${details.step1_base_combination_ids?.length || 0}`);
        console.log(`   Step 2 保留数量: ${details.step2_retained_count}`);
        console.log(`   Step 3 保留数量: ${details.step3_retained_count}`);
        console.log(`   Step 4 保留数量: ${details.step4_retained_count}`);
        console.log(`   Step 5 保留数量: ${details.step5_retained_count}`);
        console.log(`   Step 6 保留数量: ${details.step6_retained_count}`);
        console.log(`   最终保留数量: ${details.final_retained_count}\n`);

        // 验证 step1_base_combination_ids 是数组且有内容
        if (!Array.isArray(details.step1_base_combination_ids) || details.step1_base_combination_ids.length === 0) {
            throw new Error('❌ step1_base_combination_ids 为空或不是数组');
        }
        console.log('✅ step1_base_combination_ids 是有效数组\n');

        // 验证排除详情记录
        const DLTExclusionDetails = mongoose.model('DLTExclusionDetails',
            new mongoose.Schema({}, { strict: false }));

        const exclusionRecords = await DLTExclusionDetails.find({
            task_id: taskId
        }).lean();

        console.log(`✅ 排除详情记录数: ${exclusionRecords.length}`);

        if (exclusionRecords.length === 0) {
            console.log('⚠️ 警告: 没有排除详情记录（可能所有条件都未排除任何组合）\n');
        } else {
            exclusionRecords.forEach(record => {
                console.log(`   Step ${record.step}: ${record.condition}, 排除 ${record.excluded_count} 个组合`);
            });
            console.log('');
        }

        // ===== 第4步: 测试组合排除路径查询API =====
        console.log('🔍 第4步: 测试组合排除路径查询API');
        console.log('─────────────────────────────────────\n');

        // 测试一个存在于Step 1基准中的组合
        const testComboId = details.step1_base_combination_ids[0];
        console.log(`📤 查询组合ID: ${testComboId} 的排除路径`);

        const exclusionPathResponse = await axios.get(
            `${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}/period/${result.period}/combination/${testComboId}/exclusion-path`
        );

        if (!exclusionPathResponse.data.success) {
            throw new Error('组合排除路径查询失败');
        }

        const pathData = exclusionPathResponse.data.data;
        console.log('✅ 组合排除路径查询成功');
        console.log(`   组合ID: ${pathData.combination_id}`);
        console.log(`   排除位置: ${pathData.excluded_at || '未排除'}`);
        console.log(`   原因: ${pathData.reason}`);
        console.log(`   说明: ${pathData.explanation}\n`);

        // ===== 第5步: 测试步骤统计分析API =====
        console.log('📊 第5步: 测试步骤统计分析API');
        console.log('─────────────────────────────────────\n');

        const statisticsResponse = await axios.get(
            `${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}/period/${result.period}/step-statistics`
        );

        if (!statisticsResponse.data.success) {
            throw new Error('步骤统计查询失败');
        }

        const stats = statisticsResponse.data.data.statistics;
        console.log('✅ 步骤统计查询成功\n');
        console.log('   筛选漏斗:');
        console.log(`   Step 1 (${stats.step1.name}): ${stats.step1.retained} 个`);
        console.log(`   Step 2 (${stats.step2.name}): ${stats.step2.retained} 个 (保留率: ${stats.step2.retention_rate}%)`);
        console.log(`   Step 3 (${stats.step3.name}): ${stats.step3.retained} 个 (保留率: ${stats.step3.retention_rate}%)`);
        console.log(`   Step 4 (${stats.step4.name}): ${stats.step4.retained} 个 (保留率: ${stats.step4.retention_rate}%)`);
        console.log(`   Step 5 (${stats.step5.name}): ${stats.step5.retained} 个 (保留率: ${stats.step5.retention_rate}%)`);
        console.log(`   Step 6 (${stats.step6.name}): ${stats.step6.retained} 个 (保留率: ${stats.step6.retention_rate}%)`);
        console.log(`   最终: ${stats.final.retained} 个 (总保留率: ${stats.final.overall_retention_rate}%)\n`);

        // ===== 总结 =====
        console.log('========================================');
        console.log('✅ 所有测试通过！');
        console.log('========================================\n');
        console.log('📋 测试总结:');
        console.log(`   ✅ 任务创建: ${taskId}`);
        console.log(`   ✅ positive_selection_details 字段: 存在且完整`);
        console.log(`   ✅ step1_base_combination_ids: ${details.step1_base_combination_ids.length} 个ID`);
        console.log(`   ✅ 排除详情记录: ${exclusionRecords.length} 条`);
        console.log(`   ✅ 组合排除路径查询API: 工作正常`);
        console.log(`   ✅ 步骤统计分析API: 工作正常`);
        console.log('');
        console.log('🎉 排除追踪功能实施成功！');
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
    } finally {
        if (mongoConnection) {
            await mongoose.disconnect();
            console.log('🔌 数据库连接已关闭');
        }
    }
}

// 运行测试
console.log('\n⚠️ 注意: 此测试需要服务器运行在 http://localhost:3003');
console.log('   如果服务器未运行，请先执行: npm start\n');

testExclusionTracking();
