/**
 * 深度诊断推算期结果生成情况
 */
const mongoose = require('mongoose');
const log = console.log;

async function diagnosticPredictedResults() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 } });
        const predictedIssue = (latestRecord.Issue + 1).toString();

        log('🔍 诊断推算期结果：\n');
        log('最新已开奖期号:', latestRecord.Issue);
        log('推算期号:', predictedIssue);

        // 查询热温冷优化表
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

        // 检查结果集合
        const resultCollections = [
            'hit_dlt_hwcpositivepredictiontaskresults',
            'hwcpositivepredictiontaskresults',
            'HwcPositivePredictionTaskResult'
        ];

        log('\n📋 检查结果集合:');
        for (const collectionName of resultCollections) {
            try {
                const col = mongoose.connection.collection(collectionName);
                const count = await col.countDocuments();
                log(`  集合: ${collectionName}`);
                log(`    总记录数: ${count}`);

                // 尝试查询推算期和邻近期的结果
                const searchIssues = [
                    predictedIssue,
                    `${parseInt(predictedIssue) - 1}`,
                    `${parseInt(predictedIssue) + 1}`
                ];

                const results = await col.find({
                    period: { $in: searchIssues }
                }).toArray();

                log('    相关期号结果:');
                results.forEach(result => {
                    log(`      期号: ${result.period}`);
                    log(`        推算期: ${result.is_predicted}`);
                    log(`        组合数: ${result.combination_count}`);
                    log(`        红球组合: ${result.red_combinations?.length || 0}`);
                    log(`        基准期: ${result.base_period}`);
                });
            } catch (err) {
                log(`    ❌ 无法访问集合 ${collectionName}: ${err.message}`);
            }
        }

        // 检查最近任务
        const tasks = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');
        const latestTask = await tasks.findOne({}, { sort: { created_at: -1 } });

        log('\n🔍 最近任务信息:');
        log('任务ID:', latestTask?._id);
        log('任务名称:', latestTask?.task_name);
        log('创建时间:', latestTask?.created_at);
        log('期号范围:', JSON.stringify(latestTask?.period_range, null, 2));

        // 获取红球和蓝球组合
        const redCol = mongoose.connection.collection('hit_dlt_redcombinations');
        const blueCol = mongoose.connection.collection('hit_dlt_bluecombinations');

        const redComboCount = await redCol.countDocuments();
        const blueComboCount = await blueCol.countDocuments();

        log('\n🔢 组合数量:');
        log('红球组合总数:', redComboCount);
        log('蓝球组合总数:', blueComboCount);

    } catch (error) {
        log('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnosticPredictedResults();