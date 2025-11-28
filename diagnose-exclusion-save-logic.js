/**
 * 诊断排除明细保存逻辑问题
 * 用于排查为什么保存了前两期而不是最后两期
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
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
        console.log(`  排除明细存储配置: ${latestTask.output_config?.saveExclusionLimited ? `限制模式(最近${latestTask.output_config?.exclusionSavePeriods || 2}期)` : '完整模式'}\n`);

        // 获取任务的所有结果，按期号升序排列
        const results = await HwcPositivePredictionTaskResult.find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .lean();

        console.log('📊 任务结果期号列表 (升序):');
        results.forEach((r, i) => {
            console.log(`  [${i}] 期号${r.period} ${r.is_predicted ? '📍 [推算期]' : '✅ [已开奖]'}`);
        });
        console.log('');

        // 获取有排除明细的期号
        const exclusionPeriods = await DLTExclusionDetails.aggregate([
            { $match: { task_id: latestTask.task_id } },
            { $group: { _id: '$period', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('💾 实际保存了排除明细的期号:');
        exclusionPeriods.forEach(p => {
            const index = results.findIndex(r => r.period.toString() === p._id);
            console.log(`  期号${p._id} (索引${index}): ${p.count}条记录`);
        });
        console.log('');

        // 分析逻辑问题
        console.log('🔍 逻辑分析:');
        const totalPeriods = results.length;
        const exclusionSavePeriods = latestTask.output_config?.exclusionSavePeriods || 2;
        console.log(`  总期数: ${totalPeriods}`);
        console.log(`  配置保存期数: ${exclusionSavePeriods}`);
        console.log(`  当前判断逻辑: i >= ${totalPeriods} - ${exclusionSavePeriods} = i >= ${totalPeriods - exclusionSavePeriods}`);
        console.log('');

        // 找到第一个推算期
        let firstPredictedIndex = -1;
        let lastDrawnIndex = -1;
        for (let i = 0; i < results.length; i++) {
            if (results[i].is_predicted && firstPredictedIndex === -1) {
                firstPredictedIndex = i;
            }
            if (!results[i].is_predicted) {
                lastDrawnIndex = i;
            }
        }

        console.log('📍 期号分类:');
        console.log(`  第一个推算期索引: ${firstPredictedIndex} ${firstPredictedIndex >= 0 ? `(期号${results[firstPredictedIndex].period})` : '(无推算期)'}`);
        console.log(`  最后一个已开奖索引: ${lastDrawnIndex} ${lastDrawnIndex >= 0 ? `(期号${results[lastDrawnIndex].period})` : ''}`);
        console.log('');

        // 正确的逻辑应该是
        console.log('✅ 正确的保存逻辑应该是:');
        if (firstPredictedIndex > 0) {
            // 有推算期：保存推算期之前的最后N期 + 所有推算期
            const startIndex = Math.max(0, firstPredictedIndex - exclusionSavePeriods);
            console.log(`  保存索引范围: [${startIndex}, ${firstPredictedIndex - 1}] (最后${exclusionSavePeriods}期已开奖) + [${firstPredictedIndex}, ${totalPeriods - 1}] (所有推算期)`);
            console.log('  应保存的期号:');
            for (let i = startIndex; i < firstPredictedIndex; i++) {
                console.log(`    [${i}] 期号${results[i].period} (最后${firstPredictedIndex - i}期已开奖)`);
            }
            for (let i = firstPredictedIndex; i < results.length; i++) {
                console.log(`    [${i}] 期号${results[i].period} (推算期)`);
            }
        } else {
            // 无推算期：保存最后N期
            const startIndex = Math.max(0, totalPeriods - exclusionSavePeriods);
            console.log(`  保存索引范围: [${startIndex}, ${totalPeriods - 1}]`);
            console.log('  应保存的期号:');
            for (let i = startIndex; i < results.length; i++) {
                console.log(`    [${i}] 期号${results[i].period}`);
            }
        }
        console.log('');

        // 当前逻辑会保存哪些期号
        console.log('❌ 当前错误逻辑实际保存的期号:');
        for (let i = 0; i < results.length; i++) {
            const isLastNPeriods = i >= totalPeriods - exclusionSavePeriods;
            const isPredicted = results[i].is_predicted;
            const shouldSave = isLastNPeriods || isPredicted;
            if (shouldSave) {
                console.log(`  [${i}] 期号${results[i].period} ${isPredicted ? '(推算期)' : `(最后${results.length - i}期)`}`);
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

diagnose();
