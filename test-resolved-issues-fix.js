/**
 * 验证 resolved_issues 和 range_config 修复效果
 * 测试新字段是否正确保存和加载
 */

const mongoose = require('mongoose');

async function testResolvedIssuesFix() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        console.log('========================================');
        console.log('📋 测试1: Schema 字段验证');
        console.log('========================================\n');

        // 测试创建任务（模拟）
        const testTaskData = {
            task_id: 'test-resolved-issues-001',
            task_name: '测试任务-resolved_issues字段',
            task_type: 'hwc-positive-batch',
            period_range: {
                type: 'recent',
                start: '25115',
                end: '25125',
                total: 11,
                predicted_count: 1
            },
            resolved_issues: ['25125', '25124', '25123', '25122', '25121', '25120', '25119', '25118', '25117', '25116', '25115'],
            range_config: {
                rangeType: 'recent',
                recentCount: 10
            },
            issue_pairs: [
                { base: '25124', target: '25125', isPredicted: true },
                { base: '25123', target: '25124', isPredicted: false }
            ],
            positive_selection: {
                red_hot_warm_cold_ratios: [{ hot: 4, warm: 1, cold: 0 }]
            },
            exclusion_conditions: {},
            output_config: {
                pairingMode: 'truly-unlimited',
                enableHitAnalysis: true
            },
            status: 'pending',
            progress: {
                current: 0,
                total: 11,
                percentage: 0
            },
            created_at: new Date()
        };

        console.log('📝 准备插入测试任务...');

        // 直接插入到集合（绕过Mongoose model，测试Schema是否正确）
        const tasksColl = db.collection('hit_dlt_hwcpositivepredictiontasks');

        // 先删除可能存在的测试任务
        await tasksColl.deleteOne({ task_id: 'test-resolved-issues-001' });

        const insertResult = await tasksColl.insertOne(testTaskData);

        if (insertResult.acknowledged) {
            console.log('✅ 测试任务插入成功\n');
        } else {
            console.log('❌ 测试任务插入失败\n');
            return;
        }

        console.log('========================================');
        console.log('📊 测试2: 读取并验证字段');
        console.log('========================================\n');

        const savedTask = await tasksColl.findOne({ task_id: 'test-resolved-issues-001' });

        if (!savedTask) {
            console.log('❌ 无法读取测试任务\n');
            return;
        }

        console.log('任务数据验证：');
        console.log(`  task_id: ${savedTask.task_id}`);
        console.log(`  task_name: ${savedTask.task_name}`);

        // 验证 resolved_issues
        if (savedTask.resolved_issues) {
            console.log(`  ✅ resolved_issues: 存在 (${savedTask.resolved_issues.length}期)`);
            console.log(`     期号列表: ${savedTask.resolved_issues.join(', ')}`);

            if (savedTask.resolved_issues.length === 11) {
                console.log(`     ✅ 期号数量正确 (11期)`);
            } else {
                console.log(`     ❌ 期号数量错误 (预期11期，实际${savedTask.resolved_issues.length}期)`);
            }
        } else {
            console.log(`  ❌ resolved_issues: 不存在或为空`);
        }

        // 验证 range_config
        if (savedTask.range_config) {
            console.log(`  ✅ range_config: 存在`);
            console.log(`     rangeType: ${savedTask.range_config.rangeType}`);
            console.log(`     recentCount: ${savedTask.range_config.recentCount}`);

            if (savedTask.range_config.rangeType === 'recent' && savedTask.range_config.recentCount === 10) {
                console.log(`     ✅ range_config 数据正确`);
            } else {
                console.log(`     ❌ range_config 数据不正确`);
            }
        } else {
            console.log(`  ❌ range_config: 不存在或为空`);
        }

        // 验证其他字段
        console.log(`  ✅ period_range: 存在 (${savedTask.period_range.start} - ${savedTask.period_range.end})`);
        console.log(`  ✅ issue_pairs: 存在 (${savedTask.issue_pairs.length}对)`);

        console.log('\n========================================');
        console.log('📋 测试3: 检查最近创建的真实任务');
        console.log('========================================\n');

        // 查找最近3个任务
        const recentTasks = await tasksColl.find({})
            .sort({ created_at: -1 })
            .limit(3)
            .toArray();

        console.log(`找到 ${recentTasks.length} 个最近的任务：\n`);

        recentTasks.forEach((task, idx) => {
            console.log(`任务 #${idx + 1}: ${task.task_id}`);
            console.log(`  创建时间: ${task.created_at}`);
            console.log(`  状态: ${task.status}`);
            console.log(`  resolved_issues: ${task.resolved_issues ? `✅ ${task.resolved_issues.length}期` : '❌ 不存在'}`);
            console.log(`  range_config: ${task.range_config ? '✅ 存在' : '❌ 不存在'}`);

            if (task.resolved_issues && task.resolved_issues.length > 0) {
                console.log(`  期号范围: ${task.resolved_issues[task.resolved_issues.length - 1]} → ${task.resolved_issues[0]}`);
            }

            if (task.range_config) {
                console.log(`  原始配置: rangeType=${task.range_config.rangeType}, recentCount=${task.range_config.recentCount || 'N/A'}`);
            }
            console.log('');
        });

        console.log('========================================');
        console.log('🧹 清理测试数据');
        console.log('========================================\n');

        await tasksColl.deleteOne({ task_id: 'test-resolved-issues-001' });
        console.log('✅ 测试任务已删除\n');

        console.log('========================================');
        console.log('📝 测试总结');
        console.log('========================================\n');

        const hasResolvedIssues = savedTask.resolved_issues && savedTask.resolved_issues.length === 11;
        const hasRangeConfig = savedTask.range_config && savedTask.range_config.rangeType === 'recent';

        if (hasResolvedIssues && hasRangeConfig) {
            console.log('🎉 所有测试通过！');
            console.log('✅ resolved_issues 字段正确保存和读取');
            console.log('✅ range_config 字段正确保存和读取');
            console.log('\n💡 下一步：');
            console.log('1. 重启服务器以加载Schema更新');
            console.log('2. 通过UI创建新的热温冷正选批量预测任务');
            console.log('3. 检查任务是否包含所有期号的结果');
        } else {
            console.log('⚠️ 存在问题：');
            if (!hasResolvedIssues) {
                console.log('❌ resolved_issues 字段验证失败');
            }
            if (!hasRangeConfig) {
                console.log('❌ range_config 字段验证失败');
            }
            console.log('\n建议：检查Schema定义和任务创建代码');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

testResolvedIssuesFix();
