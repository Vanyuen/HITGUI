/**
 * 检查特定任务的配对模式数据
 */

const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const PredictionTaskResultSchema = new mongoose.Schema({}, { collection: 'hit_dlt_predictiontaskresults', strict: false });
const PredictionTaskResult = mongoose.model('PredictionTaskResult', PredictionTaskResultSchema);

const PredictionTaskSchema = new mongoose.Schema({}, { collection: 'hit_dlt_predictiontasks', strict: false });
const PredictionTask = mongoose.model('PredictionTask', PredictionTaskSchema);

async function checkTaskPairing() {
    try {
        const taskId = 'task_1761350719202_p59spd1ra';  // ⭐ 新任务ID
        const period = 25101;

        console.log('🔍 检查任务配对模式数据...\n');
        console.log(`任务ID: ${taskId}`);
        console.log(`期号: ${period}\n`);

        // 1. 查询任务信息
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            console.log('❌ 任务不存在');
            return;
        }

        console.log('📋 任务信息:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`任务名称: ${task.task_name || 'N/A'}`);
        console.log(`组合模式: ${task.combination_mode || 'N/A'}`);
        console.log(`输出配置:`);
        if (task.output_config) {
            console.log(`  - combination_mode: ${task.output_config.combination_mode || 'N/A'}`);
            console.log(`  - max_red_combinations: ${task.output_config.max_red_combinations || 'N/A'}`);
            console.log(`  - max_blue_combinations: ${task.output_config.max_blue_combinations || 'N/A'}`);
        } else {
            console.log('  - 无output_config');
        }
        console.log('');

        // 2. 查询期号结果
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: period
        }).lean();

        if (!result) {
            console.log('❌ 未找到该期号的结果');
            return;
        }

        console.log('📊 期号结果数据:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`红球组合数: ${result.red_combinations?.length || 0}`);
        console.log(`蓝球组合数: ${result.blue_combinations?.length || 0}`);
        console.log(`保存的组合数: ${result.combination_count || 0}`);
        console.log('');

        console.log('🔑 关键字段检查:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`pairing_mode: ${result.pairing_mode || '❌ 未设置'}`);
        console.log(`blue_pairing_indices: ${result.blue_pairing_indices ? `✅ 存在 (长度=${result.blue_pairing_indices.length})` : '❌ 不存在'}`);
        console.log('');

        // 3. 验证数据一致性
        console.log('🔍 数据一致性验证:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const redCount = result.red_combinations?.length || 0;
        const blueCount = result.blue_combinations?.length || 0;
        const savedCount = result.combination_count || 0;

        if (result.pairing_mode === 'unlimited') {
            console.log(`✅ 配对模式 = unlimited (普通无限制)`);
            console.log(`   理论组合数 = 红球数 = ${redCount}`);
            console.log(`   实际保存数 = ${savedCount}`);

            if (result.blue_pairing_indices) {
                const pairingLength = result.blue_pairing_indices.length;
                console.log(`   配对索引长度 = ${pairingLength}`);

                if (pairingLength === redCount) {
                    console.log(`   ✅ 配对索引长度正确`);
                } else {
                    console.log(`   ❌ 配对索引长度不对！应该=${redCount}, 实际=${pairingLength}`);
                }

                // 显示前10个配对索引
                console.log(`   前10个配对索引: [${result.blue_pairing_indices.slice(0, 10).join(', ')}]`);
            } else {
                console.log(`   ❌ 缺少配对索引数组！`);
            }

            if (savedCount === redCount) {
                console.log(`   ✅ 组合数正确`);
            } else {
                console.log(`   ⚠️ 组合数不匹配：期望=${redCount}, 实际=${savedCount}`);
            }
        } else {
            console.log(`⚠️ 配对模式 = ${result.pairing_mode || '未设置'} (不是unlimited)`);
            console.log(`   笛卡尔积 = ${redCount} × ${blueCount} = ${redCount * blueCount}`);
            console.log(`   实际保存 = ${savedCount}`);
        }

        console.log('');

        // 4. 诊断建议
        console.log('💡 诊断结果:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (!result.pairing_mode) {
            console.log('❌ 问题: pairing_mode字段不存在');
            console.log('   原因: 任务可能是用旧版本代码生成的');
            console.log('   建议: 需要重新运行任务');
        } else if (result.pairing_mode !== 'unlimited') {
            console.log('❌ 问题: pairing_mode不是unlimited');
            console.log(`   当前值: ${result.pairing_mode}`);
            console.log('   建议: 检查任务创建时的配置');
        } else if (!result.blue_pairing_indices) {
            console.log('❌ 问题: blue_pairing_indices数组不存在');
            console.log('   原因: 配对索引没有保存到数据库');
            console.log('   建议: 需要修复任务执行逻辑并重新运行');
        } else if (result.blue_pairing_indices.length !== redCount) {
            console.log('❌ 问题: blue_pairing_indices长度不正确');
            console.log(`   期望: ${redCount}, 实际: ${result.blue_pairing_indices.length}`);
            console.log('   建议: 需要修复任务执行逻辑并重新运行');
        } else {
            console.log('✅ 所有配对数据正确！');
            console.log('   问题可能在导出脚本的读取逻辑');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n📊 数据库连接已关闭');
    }
}

checkTaskPairing();
