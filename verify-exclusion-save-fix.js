/**
 * 验证排除明细保存逻辑修复
 * 确认只保存最近N期已开奖 + 推算期
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        // 获取最新的HWC任务
        const HwcPositivePredictionTask = mongoose.model('HwcPositivePredictionTask', new mongoose.Schema({}, { strict: false }));
        const HwcPositivePredictionTaskResult = mongoose.model('HwcPositivePredictionTaskResult', new mongoose.Schema({}, { strict: false }));
        const DLTExclusionDetails = mongoose.model('HIT_DLT_ExclusionDetails', new mongoose.Schema({}, { strict: false }));

        const latestTask = await HwcPositivePredictionTask.findOne()
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 没有找到任务');
            return;
        }

        console.log('📋 最新任务信息:');
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  任务名称: ${latestTask.task_name}`);
        console.log(`  期号范围: ${latestTask.period_range.start} - ${latestTask.period_range.end}`);

        const saveExclusionLimited = latestTask.output_config?.saveExclusionLimited ?? true;
        const exclusionSavePeriods = latestTask.output_config?.exclusionSavePeriods || 2;
        console.log(`  排除明细存储: ${saveExclusionLimited ? `限制模式(保存${exclusionSavePeriods}期+推算期)` : '完整模式'}\n`);

        // 获取任务的所有结果，按期号降序排列
        const results = await HwcPositivePredictionTaskResult.find({ task_id: latestTask.task_id })
            .sort({ period: -1 })
            .lean();

        console.log('📊 任务结果期号列表 (降序):');
        results.forEach((r, i) => {
            console.log(`  [${i}] 期号${r.period} ${r.is_predicted ? '📍 [推算期]' : '✅ [已开奖]'}`);
        });
        console.log('');

        // 获取有排除明细的期号
        const exclusionPeriods = await DLTExclusionDetails.aggregate([
            { $match: { task_id: latestTask.task_id } },
            { $group: { _id: '$period', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);

        console.log('💾 实际保存了排除明细的期号:');
        if (exclusionPeriods.length === 0) {
            console.log('  ⚠️ 没有排除明细记录');
        } else {
            exclusionPeriods.forEach(p => {
                const result = results.find(r => r.period.toString() === p._id);
                const index = results.findIndex(r => r.period.toString() === p._id);
                console.log(`  期号${p._id} (索引${index}): ${p.count}条记录 ${result?.is_predicted ? '📍 [推算期]' : '✅ [已开奖]'}`);
            });
        }
        console.log('');

        // 验证逻辑正确性
        console.log('✅ 验证修复后的逻辑:');

        if (!saveExclusionLimited) {
            console.log('  模式：完整模式，应保存所有期号');
            console.log(`  预期：${results.length}期 × 7步骤 = ${results.length * 7}条记录`);
            console.log(`  实际：${exclusionPeriods.reduce((sum, p) => sum + p.count, 0)}条记录`);
        } else {
            // 找到第一个推算期
            let firstPredictedIndex = -1;
            for (let i = 0; i < results.length; i++) {
                if (results[i].is_predicted) {
                    firstPredictedIndex = i;
                    break;
                }
            }

            console.log(`  配置保存期数: ${exclusionSavePeriods}期`);
            console.log(`  第一个推算期索引: ${firstPredictedIndex}`);

            if (firstPredictedIndex >= 0) {
                console.log('  应保存的期号:');
                const expectedPeriods = [];

                for (let i = 0; i <= exclusionSavePeriods && i < results.length; i++) {
                    const periodResult = results[i];
                    let shouldSave = false;

                    // 使用修复后的逻辑
                    if (i === 0 && !periodResult.is_predicted) {
                        shouldSave = i < exclusionSavePeriods;
                    } else {
                        shouldSave = i <= exclusionSavePeriods;
                    }

                    if (shouldSave) {
                        expectedPeriods.push(periodResult.period.toString());
                        const reason = periodResult.is_predicted ? '推算期' : `倒数第${i + 1}期已开奖`;
                        console.log(`    [${i}] 期号${periodResult.period} (${reason})`);
                    }
                }

                console.log(`  预期保存：${expectedPeriods.length}期 × 7步骤 = ${expectedPeriods.length * 7}条记录`);
                console.log(`  实际保存：${exclusionPeriods.length}期 × 平均步骤数 = ${exclusionPeriods.reduce((sum, p) => sum + p.count, 0)}条记录`);

                // 检查是否匹配
                const actualPeriods = exclusionPeriods.map(p => p._id);
                const missingPeriods = expectedPeriods.filter(p => !actualPeriods.includes(p));
                const extraPeriods = actualPeriods.filter(p => !expectedPeriods.includes(p));

                console.log('');
                if (missingPeriods.length === 0 && extraPeriods.length === 0) {
                    console.log('✅ 验证通过！保存的期号完全符合预期');
                } else {
                    if (missingPeriods.length > 0) {
                        console.log(`❌ 缺少期号: ${missingPeriods.join(', ')}`);
                    }
                    if (extraPeriods.length > 0) {
                        console.log(`❌ 多余期号: ${extraPeriods.join(', ')}`);
                    }
                }
            } else {
                console.log('  没有推算期，应保存最近N期已开奖');
                console.log(`  预期：${exclusionSavePeriods}期 × 7步骤 = ${exclusionSavePeriods * 7}条记录`);
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

verify();
