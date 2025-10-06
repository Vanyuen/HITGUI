#!/usr/bin/env node
/**
 * 检查批量预测导出数据一致性
 *
 * 使用方法：
 * node check-export-consistency.js --task-id=<任务ID> --period=<期号>
 */

const mongoose = require('mongoose');

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lottery';

// 解析命令行参数
function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            args[key] = value || true;
        }
    });
    return args;
}

// MongoDB Schema定义
const predictionTaskSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_predictiontasks' });
const predictionTaskResultSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_predictiontaskresults' });
const dltRedCombinationsSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' });
const dltBlueCombinationsSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_bluecombinations' });

const PredictionTask = mongoose.model('PredictionTask', predictionTaskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult', predictionTaskResultSchema);
const DLTRedCombinations = mongoose.model('DLTRedCombinations', dltRedCombinationsSchema);
const DLTBlueCombinations = mongoose.model('DLTBlueCombinations', dltBlueCombinationsSchema);

async function checkConsistency(taskId, period) {
    try {
        console.log('\n🔍 开始检查数据一致性...');
        console.log(`📋 任务ID: ${taskId}`);
        console.log(`📅 期号: ${period}\n`);

        // 1. 查询任务信息
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            throw new Error(`任务不存在: ${taskId}`);
        }
        console.log(`✅ 任务名称: ${task.task_name}`);
        console.log(`   组合模式: ${task.output_config?.combination_mode || 'default'}`);
        console.log(`   相克排除: ${task.exclude_conditions?.conflict?.enabled ? '启用' : '禁用'}`);
        console.log(`   同出排除: ${task.exclude_conditions?.coOccurrence?.enabled ? '启用' : '禁用'}`);

        // 2. 查询期号结果
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: parseInt(period)
        }).lean();
        if (!result) {
            throw new Error(`未找到期号 ${period} 的结果`);
        }

        console.log(`\n📊 数据库中保存的统计：`);
        console.log(`   combination_count: ${result.combination_count?.toLocaleString() || 0}`);
        console.log(`   red_combinations数组长度: ${result.red_combinations?.length || 0}`);
        console.log(`   blue_combinations数组长度: ${result.blue_combinations?.length || 0}`);

        // 3. 查询实际组合数据
        const redCombinations = await DLTRedCombinations.find({
            combination_id: { $in: result.red_combinations }
        }).lean();

        const blueCombinations = await DLTBlueCombinations.find({
            combination_id: { $in: result.blue_combinations }
        }).lean();

        console.log(`\n🔍 实际查询到的组合：`);
        console.log(`   红球组合数: ${redCombinations.length}`);
        console.log(`   蓝球组合数: ${blueCombinations.length}`);

        // 4. 计算实际组合数
        const combinationMode = task.output_config?.combination_mode || 'default';
        let actualCombinationCount;

        if (combinationMode === 'unlimited') {
            actualCombinationCount = Math.max(redCombinations.length, blueCombinations.length);
            console.log(`   组合计算方式: 1:1配对 (unlimited模式)`);
        } else {
            actualCombinationCount = redCombinations.length * blueCombinations.length;
            console.log(`   组合计算方式: 完全笛卡尔积 (${combinationMode}模式)`);
        }

        console.log(`   实际组合数: ${actualCombinationCount.toLocaleString()}`);

        // 5. 一致性检查
        console.log(`\n📋 一致性检查：`);

        const redArrayMatch = result.red_combinations?.length === redCombinations.length;
        const blueArrayMatch = result.blue_combinations?.length === blueCombinations.length;
        const countMatch = result.combination_count === actualCombinationCount;

        console.log(`   ✓ 红球数组长度一致: ${redArrayMatch ? '✅ 是' : '❌ 否'}`);
        if (!redArrayMatch) {
            console.log(`     - 数组长度: ${result.red_combinations?.length}`);
            console.log(`     - 实际查到: ${redCombinations.length}`);
            console.log(`     - 差异: ${(result.red_combinations?.length || 0) - redCombinations.length}`);
        }

        console.log(`   ✓ 蓝球数组长度一致: ${blueArrayMatch ? '✅ 是' : '❌ 否'}`);
        if (!blueArrayMatch) {
            console.log(`     - 数组长度: ${result.blue_combinations?.length}`);
            console.log(`     - 实际查到: ${blueCombinations.length}`);
            console.log(`     - 差异: ${(result.blue_combinations?.length || 0) - blueCombinations.length}`);
        }

        console.log(`   ✓ 组合总数一致: ${countMatch ? '✅ 是' : '❌ 否'}`);
        if (!countMatch) {
            console.log(`     - 数据库保存: ${result.combination_count?.toLocaleString()}`);
            console.log(`     - 实际计算: ${actualCombinationCount.toLocaleString()}`);
            console.log(`     - 差异: ${(result.combination_count || 0) - actualCombinationCount}`);
        }

        // 6. 导出验证
        console.log(`\n📤 导出数据验证：`);
        console.log(`   如果用户导出此期数据，将会导出：`);
        console.log(`   - ${actualCombinationCount.toLocaleString()} 个组合`);
        console.log(`   - CSV行数: ${actualCombinationCount + 7} 行（含表头和元数据）`);

        // 7. 问题诊断
        if (!redArrayMatch || !blueArrayMatch || !countMatch) {
            console.log(`\n⚠️ 发现数据不一致！`);
            console.log(`\n可能的原因：`);
            console.log(`   1. 数据库中保存的组合ID有误`);
            console.log(`   2. 组合数据被删除或修改`);
            console.log(`   3. combination_count计算错误`);
            console.log(`   4. 任务执行过程中出现异常`);

            console.log(`\n建议操作：`);
            console.log(`   1. 重新运行该期的预测任务`);
            console.log(`   2. 检查数据库完整性`);
            console.log(`   3. 查看任务执行日志`);
        } else {
            console.log(`\n✅ 数据完全一致！导出结果应该正确。`);
        }

        // 8. 显示组合ID样本
        if (redCombinations.length > 0) {
            console.log(`\n📝 红球组合ID样本（前5个）：`);
            const redSample = result.red_combinations.slice(0, 5);
            redSample.forEach((id, index) => {
                const combo = redCombinations.find(c => c.combination_id === id);
                if (combo) {
                    const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
                    console.log(`   ${index + 1}. ${id} -> [${balls.map(n => n.toString().padStart(2, '0')).join(', ')}]`);
                } else {
                    console.log(`   ${index + 1}. ${id} -> ❌ 未找到对应组合`);
                }
            });
        }

        if (blueCombinations.length > 0) {
            console.log(`\n📝 蓝球组合ID样本（前5个）：`);
            const blueSample = result.blue_combinations.slice(0, 5);
            blueSample.forEach((id, index) => {
                const combo = blueCombinations.find(c => c.combination_id === id);
                if (combo) {
                    const balls = [combo.blue_ball_1, combo.blue_ball_2];
                    console.log(`   ${index + 1}. ${id} -> [${balls.map(n => n.toString().padStart(2, '0')).join(', ')}]`);
                } else {
                    console.log(`   ${index + 1}. ${id} -> ❌ 未找到对应组合`);
                }
            });
        }

    } catch (error) {
        console.error(`\n❌ 检查失败: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

async function main() {
    const args = parseArgs();

    if (!args['task-id'] || !args.period) {
        console.log(`
使用方法:
  node check-export-consistency.js --task-id=<任务ID> --period=<期号>

示例:
  node check-export-consistency.js --task-id=预测任务_2025-9-30_16-38-23 --period=24040
        `);
        process.exit(0);
    }

    try {
        console.log('🔌 正在连接MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功');

        await checkConsistency(args['task-id'], args.period);

        await mongoose.disconnect();
        console.log('\n👋 数据库连接已关闭');
        process.exit(0);

    } catch (error) {
        console.error('❌ 发生错误:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ 未捕获的错误:', error);
        process.exit(1);
    });
}
