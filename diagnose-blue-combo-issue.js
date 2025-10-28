/**
 * 诊断脚本：检查排除详情导出中蓝球组合缺失的问题
 *
 * 使用方法：
 * node diagnose-blue-combo-issue.js <taskId> <period>
 *
 * 例如：
 * node diagnose-blue-combo-issue.js task_123456 25120
 */

const mongoose = require('mongoose');

// 连接MongoDB
const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB连接成功');
    runDiagnosis();
}).catch(err => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
});

// 定义Schema
const predictionTaskResultSchema = new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_PredictionTaskResults' });
const PredictionTaskResult = mongoose.model('PredictionTaskResult_Diag', predictionTaskResultSchema);

const dltBlueCombinationsSchema = new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_BlueCombinations' });
const DLTBlueCombinations = mongoose.model('DLTBlueCombinations_Diag', dltBlueCombinationsSchema);

async function runDiagnosis() {
    try {
        // 从命令行参数获取任务ID和期号
        const taskId = process.argv[2];
        const period = process.argv[3];

        if (!taskId || !period) {
            console.log('❌ 请提供任务ID和期号参数');
            console.log('用法: node diagnose-blue-combo-issue.js <taskId> <period>');
            console.log('例如: node diagnose-blue-combo-issue.js task_1730000000000_abc123 25120');

            // 查询最近的任务供参考
            const recentResults = await PredictionTaskResult.find({})
                .sort({ created_at: -1 })
                .limit(5)
                .lean();

            if (recentResults.length > 0) {
                console.log('\n📋 最近的任务结果供参考：');
                recentResults.forEach((r, idx) => {
                    console.log(`${idx + 1}. task_id: ${r.task_id}, period: ${r.period}, pairing_mode: ${r.pairing_mode}`);
                });
            }

            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`\n🔍 开始诊断任务: ${taskId}, 期号: ${period}`);
        console.log('='.repeat(80));

        // 1. 查询任务结果
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: parseInt(period)
        }).lean();

        if (!result) {
            console.log('❌ 未找到任务结果');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('\n📊 任务结果基本信息:');
        console.log(`  - result_id: ${result.result_id}`);
        console.log(`  - pairing_mode: ${result.pairing_mode}`);
        console.log(`  - period: ${result.period}`);
        console.log(`  - created_at: ${result.created_at}`);

        // 2. 检查配对数据
        console.log('\n📊 配对数据检查:');
        const pairingMode = result.pairing_mode || 'truly-unlimited';
        const bluePairingIndices = result.blue_pairing_indices || null;
        const blueComboIds = result.blue_combinations || [];

        console.log(`  - pairing_mode: ${pairingMode}`);
        console.log(`  - blue_pairing_indices 存在: ${bluePairingIndices ? '是' : '否'}`);
        console.log(`  - blue_pairing_indices 长度: ${bluePairingIndices ? bluePairingIndices.length : 0}`);
        console.log(`  - blue_combinations (ID数组) 长度: ${blueComboIds.length}`);

        if (bluePairingIndices && bluePairingIndices.length > 0) {
            console.log(`  - 配对索引前10个: ${bluePairingIndices.slice(0, 10).join(', ')}`);
        }

        if (blueComboIds.length > 0) {
            console.log(`  - 蓝球组合ID前10个: ${blueComboIds.slice(0, 10).join(', ')}`);
        }

        // 3. 查询蓝球组合数据
        console.log('\n📊 蓝球组合数据查询:');
        const allBlueCombos = await DLTBlueCombinations.find({
            combination_id: { $in: blueComboIds }
        }).lean();

        console.log(`  - 查询到的蓝球组合数量: ${allBlueCombos.length} / ${blueComboIds.length}`);

        if (allBlueCombos.length === 0) {
            console.log('  ❌ 没有查询到任何蓝球组合数据！');
            console.log('  可能原因：');
            console.log('    1. blue_combinations 数组为空');
            console.log('    2. 蓝球组合ID在数据库中不存在');
        } else {
            console.log('  ✅ 成功查询到蓝球组合数据');
            console.log(`  - 蓝球组合样本 (前5个):`);
            allBlueCombos.slice(0, 5).forEach(bc => {
                console.log(`    ID=${bc.combination_id}, 蓝球=[${bc.blue_ball_1}, ${bc.blue_ball_2}]`);
            });
        }

        // 4. 模拟配对逻辑
        console.log('\n📊 模拟配对逻辑（前10个红球）:');
        const retainedIds = result.red_combinations || [];
        console.log(`  - 保留的红球组合数量: ${retainedIds.length}`);

        if (retainedIds.length > 0 && pairingMode === 'unlimited' && bluePairingIndices && bluePairingIndices.length > 0) {
            for (let i = 0; i < Math.min(10, retainedIds.length); i++) {
                const redComboId = retainedIds[i];
                const pairingIndex = bluePairingIndices[i];
                const blueComboId = blueComboIds[pairingIndex];
                const blueCombo = allBlueCombos.find(bc => bc.combination_id === blueComboId);

                console.log(`  ${i + 1}. 红球ID=${redComboId}, 配对索引=${pairingIndex}, 蓝球ID=${blueComboId}, 蓝球组合=${blueCombo ? `[${blueCombo.blue_ball_1}, ${blueCombo.blue_ball_2}]` : '❌ 未找到'}`);
            }
        } else {
            console.log('  ⚠️ 无法模拟配对（不是unlimited模式或缺少配对索引）');
        }

        // 5. 诊断结论
        console.log('\n' + '='.repeat(80));
        console.log('🔍 诊断结论:');

        if (pairingMode !== 'unlimited') {
            console.log('  ⚠️ 配对模式不是 "unlimited"，而是:', pairingMode);
        }

        if (!bluePairingIndices || bluePairingIndices.length === 0) {
            console.log('  ❌ 缺少 blue_pairing_indices 数组！');
            console.log('     → 可能原因：任务创建时未正确生成配对索引');
        }

        if (blueComboIds.length === 0) {
            console.log('  ❌ blue_combinations 数组为空！');
            console.log('     → 可能原因：任务结果未保存蓝球组合ID');
        }

        if (allBlueCombos.length === 0 && blueComboIds.length > 0) {
            console.log('  ❌ 数据库中找不到蓝球组合数据！');
            console.log('     → 可能原因：');
            console.log('       1. HIT_DLT_BlueCombinations 集合数据缺失');
            console.log('       2. combination_id 字段不匹配');
        }

        if (allBlueCombos.length < blueComboIds.length) {
            console.log('  ⚠️ 部分蓝球组合数据缺失！');
            console.log(`     查询到 ${allBlueCombos.length} 个，期望 ${blueComboIds.length} 个`);
        }

        console.log('\n✅ 诊断完成！');
        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ 诊断过程出错:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}
