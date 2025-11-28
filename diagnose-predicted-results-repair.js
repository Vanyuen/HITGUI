/**
 * 高级诊断和修复推算期结果生成脚本
 */
const mongoose = require('mongoose');
const log = console.log;

async function diagnosticAndFixPredictedResults() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 } });
        const predictedIssue = (latestRecord.Issue + 1).toString();

        log('🔍 诊断并修复推算期结果：\n');
        log('最新已开奖期号:', latestRecord.Issue);
        log('推算期号:', predictedIssue);

        // 检查热温冷优化表数据
        const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const hwcData = await hwcCol.findOne({
            base_issue: latestRecord.Issue.toString(),
            target_issue: predictedIssue
        });

        log('\n🔥 热温冷数据检查:');
        log('期号对:', `${latestRecord.Issue}→${predictedIssue}`);
        log('热温冷数据存在:', !!hwcData);

        if (hwcData) {
            const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
            log('热温冷比例数:', ratios.length);
            log('热温冷比例:', ratios);
        }

        // 检查现有的任务结果集合
        const resultCollections = [
            'hit_dlt_hwcpositivepredictiontaskresults',
            'hwcpositivepredictiontaskresults',
            'HIT_DLT_HwcPositivePredictionTaskResult'
        ];

        // 准备插入的结果数据
        let predictedResult = null;

        if (hwcData) {
            // 获取红球和蓝球组合
            const redCol = mongoose.connection.collection('hit_dlt_redcombinations');
            const blueCol = mongoose.connection.collection('hit_dlt_bluecombinations');

            const hwcRatios = Object.keys(hwcData.hot_warm_cold_data || {});
            const selectedRatio = hwcRatios[0];
            const redCombinationIds = hwcData.hot_warm_cold_data[selectedRatio] || [];

            const redCombinations = await redCol.find({
                _id: { $in: redCombinationIds }
            }).toArray();

            const blueCombinations = await blueCol.find().toArray();

            predictedResult = {
                period: predictedIssue,
                is_predicted: true,
                task_id: 'auto-generated-diagnostics',
                result_id: `diagnostic-${predictedIssue}`,
                red_combinations: redCombinations.map(c => c.combination),
                blue_combinations: blueCombinations.map(c => c.combination),
                combination_count: redCombinations.length,
                paired_combinations: redCombinations.length * blueCombinations.length,
                pairing_mode: 'unlimited',
                base_period: latestRecord.Issue.toString(),
                hit_analysis: {
                    hwc_ratio: selectedRatio
                },
                created_at: new Date()
            };

            log('\n🔍 生成的推算期结果:');
            log('   期号:', predictedResult.period);
            log('   红球组合数:', predictedResult.red_combinations.length);
            log('   蓝球组合数:', predictedResult.blue_combinations.length);
            log('   热温冷比例:', predictedResult.hit_analysis.hwc_ratio);
        }

        // 尝试插入结果到每个集合
        if (predictedResult) {
            for (const collectionName of resultCollections) {
                try {
                    const collection = mongoose.connection.collection(collectionName);

                    // 先删除已存在的记录
                    await collection.deleteMany({
                        period: predictedIssue
                    });

                    // 插入新记录
                    await collection.insertOne(predictedResult);

                    log(`\n✅ 成功插入结果到集合: ${collectionName}`);
                    log('   插入的记录详情:');
                    log(`     期号: ${predictedResult.period}`);
                    log(`     组合数: ${predictedResult.combination_count}`);
                    log(`     基准期: ${predictedResult.base_period}`);
                } catch (error) {
                    log(`❌ 插入集合 ${collectionName} 失败: ${error.message}`);
                }
            }
        } else {
            log('\n⚠️ 未能生成推算期结果 - 未找到热温冷数据');
        }

        // 检查插入结果
        log('\n🔍 最终验证:');
        for (const collectionName of resultCollections) {
            try {
                const collection = mongoose.connection.collection(collectionName);
                const count = await collection.countDocuments({ period: predictedIssue });
                log(`  集合 ${collectionName}: 推算期结果数量 = ${count}`);
            } catch (error) {
                log(`  ❌ 验证集合 ${collectionName} 失败: ${error.message}`);
            }
        }

    } catch (error) {
        log('❌ 诊断和修复失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnosticAndFixPredictedResults();