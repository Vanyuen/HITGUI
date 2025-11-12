/**
 * 诊断新创建任务的配置
 * 检查前端发送的数据和数据库中保存的配置
 */

const mongoose = require('mongoose');

// 简单的数据库连接
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    console.log('\n🔍 ===== 诊断新任务配置 =====\n');

    try {
        // 连接数据库
        console.log('📡 正在连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查询最新的任务
        const task = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { created_at: -1 } });

        if (!task) {
            console.log('❌ 数据库中没有任何任务');
            process.exit(1);
        }

        console.log(`📋 最新任务:`);
        console.log(`  任务ID: ${task.task_id}`);
        console.log(`  任务名: ${task.task_name || '未命名'}`);
        console.log(`  创建时间: ${task.created_at || '未知'}`);
        console.log(`  状态: ${task.status}`);

        // 检查排除条件配置
        const ec = task.exclusion_conditions || {};

        console.log(`\n🔧 排除条件配置详情:\n`);

        // Step 7: consecutiveGroups
        console.log(`📦 Step 7 - 连号组数排除:`);
        const step7 = ec.consecutiveGroups || {};
        console.log(`  enabled: ${step7.enabled} ${step7.enabled ? '✅' : '❌'}`);
        console.log(`  groups: ${JSON.stringify(step7.groups || [])}`);
        console.log(`  groups类型: ${Array.isArray(step7.groups) ? 'Array' : typeof step7.groups}`);
        console.log(`  groups长度: ${Array.isArray(step7.groups) ? step7.groups.length : 'N/A'}`);

        // Step 8: maxConsecutiveLength
        console.log(`\n📏 Step 8 - 最长连号排除:`);
        const step8 = ec.maxConsecutiveLength || {};
        console.log(`  enabled: ${step8.enabled} ${step8.enabled ? '✅' : '❌'}`);
        console.log(`  lengths: ${JSON.stringify(step8.lengths || [])}`);
        console.log(`  lengths类型: ${Array.isArray(step8.lengths) ? 'Array' : typeof step8.lengths}`);
        console.log(`  lengths长度: ${Array.isArray(step8.lengths) ? step8.lengths.length : 'N/A'}`);

        // Step 9: conflictPairs
        console.log(`\n⚔️ Step 9 - 相克对排除:`);
        const step9 = ec.conflictPairs || {};
        console.log(`  enabled: ${step9.enabled} ${step9.enabled ? '✅' : '❌'}`);

        // Step 10: coOccurrence
        console.log(`\n🔗 Step 10 - 同现比排除:`);
        const step10 = ec.coOccurrence || {};
        console.log(`  enabled: ${step10.enabled} ${step10.enabled ? '✅' : '❌'}`);

        // 总体判断
        console.log(`\n📊 总体判断:`);
        const allEnabled = step7.enabled && step8.enabled && step9.enabled && step10.enabled;
        console.log(`  所有排除条件都启用: ${allEnabled ? '✅ 是' : '❌ 否'}`);

        if (!allEnabled) {
            console.log(`\n❌ 问题：虽然Schema默认值改为true，但数据库中保存的还是false！`);
            console.log(`\n🔍 可能原因:`);
            console.log(`  1. 服务器没有重启（Schema修改需要重启生效）`);
            console.log(`  2. 前端发送了 enabled: false（覆盖了默认值）`);
            console.log(`  3. 任务是在修改Schema之前创建的`);
        } else {
            console.log(`\n✅ 配置正确：所有排除条件都已启用`);

            // 进一步检查是否有数据
            console.log(`\n🔍 检查排除详情数据...`);

            const results = await mongoose.connection.db
                .collection('hit_dlt_hwcpositivepredictiontaskresults')
                .find({ task_id: task.task_id })
                .toArray();

            if (results.length === 0) {
                console.log(`  ⚠️ 任务还没有执行结果`);
            } else {
                const period = results[0].period;
                console.log(`  检查期号: ${period}`);

                const exclusionRecords = await mongoose.connection.db
                    .collection('hit_dlt_exclusiondetails')
                    .find({
                        task_id: task.task_id,
                        period: period.toString(),
                        step: { $in: [7, 8, 9, 10] }
                    })
                    .toArray();

                console.log(`  排除详情记录数: ${exclusionRecords.length}`);

                if (exclusionRecords.length === 0) {
                    console.log(`\n❌ 问题：虽然enabled=true，但没有保存排除详情！`);
                    console.log(`\n🔍 可能原因:`);
                    console.log(`  1. 任务执行时代码逻辑有其他判断条件`);
                    console.log(`  2. groups/lengths数组为空，代码中有额外检查`);
                    console.log(`  3. 任务执行时抛出异常`);
                    console.log(`\n💡 建议:`);
                    console.log(`  查看服务器日志，看Step 7-10是否执行`);
                } else {
                    console.log(`\n  ✅ 有排除详情数据`);

                    for (const record of exclusionRecords) {
                        const step = record.step;
                        const stepName = {
                            '7': '连号组数',
                            '8': '最长连号',
                            '9': '相克对',
                            '10': '同现比'
                        }[step];
                        console.log(`    Step ${step}(${stepName}): 排除${record.excluded_count}个`);
                    }
                }
            }
        }

        // 完整的配置输出（调试用）
        console.log(`\n\n📄 完整的排除条件配置（JSON）:`);
        console.log(JSON.stringify(ec, null, 2));

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

diagnose().catch(err => {
    console.error('脚本执行失败:', err);
    process.exit(1);
});
