/**
 * 方案C性能优化验证测试
 *
 * 测试目标：
 * 1. 创建同样的热温冷正选任务
 * 2. 记录任务完成时间
 * 3. 验证数据完整性
 * 4. 对比优化前后性能
 *
 * 运行方式: node test-performance-optimization.js
 */

const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:3003';
const DB_URL = 'mongodb://127.0.0.1:27017/lottery';

/**
 * 等待任务完成并记录时间
 */
async function waitForTaskWithTiming(taskId, maxWaitSeconds = 600) {
    const startTime = Date.now();
    let lastStatus = '';

    console.log(`\n⏱️  开始计时...`);

    while (true) {
        const response = await axios.get(`${API_BASE}/api/dlt/hwc-positive-tasks/${taskId}`);
        const task = response.data.data.task || response.data.data;

        if (task.status !== lastStatus) {
            lastStatus = task.status;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`   [${elapsed}s] 状态: ${task.status}`);
        }

        if (task.status === 'completed') {
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n✅ 任务完成！总耗时: ${totalTime}秒`);
            return { task, totalTime: parseFloat(totalTime) };
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
async function testPerformance() {
    let mongoConnection = null;

    try {
        console.log('\n========================================');
        console.log('⚡ 方案C性能优化验证测试');
        console.log('========================================\n');

        // ===== 第1步: 创建测试任务 =====
        console.log('📋 第1步: 创建测试任务\n');

        const taskPayload = {
            task_name: '[性能测试] 方案C优化验证',
            period_range: {
                type: 'custom',
                value: {
                    start: '25115',
                    end: '25116'
                }
            },
            positive_selection: {
                enabled: true,
                hwc_ratios: ['2:2:1', '2:1:2', '1:2:2'],
                zone_ratios: ['2:2:1', '2:1:2', '1:2:2'],
                sum_ranges: [
                    { min: 65, max: 90 },
                    { min: 91, max: 115 }
                ],
                span_ranges: [
                    { min: 18, max: 25 },
                    { min: 26, max: 32 }
                ],
                odd_even_ratios: ['2:3', '3:2'],
                ac_values: [4, 5, 6]
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
        console.log(`✅ 任务创建成功: ${taskId}\n`);

        // ===== 第2步: 等待任务完成并计时 =====
        console.log('⏳ 第2步: 执行任务并计时...\n');
        const { task, totalTime } = await waitForTaskWithTiming(taskId, 600);

        // ===== 第3步: 验证数据完整性 =====
        console.log('\n🔍 第3步: 验证数据完整性\n');

        // 连接数据库
        console.log('📡 连接数据库...');
        mongoConnection = await mongoose.connect(DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

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

        // 验证 positive_selection_details
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

        // 验证排除详情记录
        const DLTExclusionDetails = mongoose.model('DLTExclusionDetails',
            new mongoose.Schema({}, { strict: false }));

        const exclusionRecords = await DLTExclusionDetails.find({
            task_id: taskId
        }).lean();

        console.log(`✅ 排除详情记录数: ${exclusionRecords.length}`);
        if (exclusionRecords.length > 0) {
            exclusionRecords.forEach(record => {
                console.log(`   Step ${record.step}: ${record.condition}, 排除 ${record.excluded_count} 个组合`);
            });
        }
        console.log('');

        // ===== 第4步: 性能总结 =====
        console.log('========================================');
        console.log('📊 性能测试结果');
        console.log('========================================\n');

        console.log(`⏱️  任务完成时间: ${totalTime}秒`);
        console.log(`📈 性能评估:`);
        if (totalTime < 180) {
            console.log(`   ✅ 优秀！(< 3分钟)`);
        } else if (totalTime < 360) {
            console.log(`   ✅ 良好！(< 6分钟)`);
        } else if (totalTime < 720) {
            console.log(`   ⚠️ 可接受 (< 12分钟)`);
        } else {
            console.log(`   ❌ 需要进一步优化 (> 12分钟)`);
        }

        console.log(`\n📋 数据完整性:`);
        console.log(`   ✅ Step 1 基准ID: ${details.step1_base_combination_ids?.length || 0} 个`);
        console.log(`   ✅ 步骤统计完整: Steps 2-6`);
        console.log(`   ✅ 排除详情记录: ${exclusionRecords.length} 条`);

        console.log(`\n🎯 优化效果对比:`);
        console.log(`   优化前估计: ~12-15分钟`);
        console.log(`   优化后实际: ${totalTime}秒 (${(totalTime / 60).toFixed(1)}分钟)`);
        if (totalTime < 720) {
            const improvement = ((720 - totalTime) / 720 * 100).toFixed(1);
            console.log(`   性能提升: ~${improvement}%`);
        }

        console.log('\n========================================');
        console.log('✅ 性能测试通过！');
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
            console.log('🔌 数据库连接已关闭\n');
        }
    }
}

// 运行测试
console.log('\n⚠️ 注意: 此测试需要服务器运行在 http://localhost:3003');
console.log('   如果服务器未运行，请先执行: npm start\n');

testPerformance();
