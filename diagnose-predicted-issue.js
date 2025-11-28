/**
 * 推算期数据生成诊断脚本
 * 1. 检查最新期号和基准期
 * 2. 检查热温冷优化表
 * 3. 检查基础组合生成
 * 4. 检查排除条件
 */
const mongoose = require('mongoose');
const log = console.log;

async function diagnosticPredictedIssue() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        log('✅ 数据库连接成功\n');

        // 0. 基础信息
        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 } });
        const predictedIssue = (latestRecord.Issue + 1).toString();
        const baseIssue = latestRecord.Issue.toString();

        log('='.repeat(80));
        log('🔍 基础信息');
        log('='.repeat(80));
        log(`最新已开奖期号: ${latestRecord.Issue}`);
        log(`推算期号: ${predictedIssue}`);
        log(`基准期号: ${baseIssue}\n`);

        // 1. 检查热温冷优化表
        log('='.repeat(80));
        log('🔥 热温冷优化表检查');
        log('='.repeat(80));
        const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const hwcData = await hwcCol.findOne({
            base_issue: baseIssue,
            target_issue: predictedIssue
        });

        log('期号对:', `${baseIssue}→${predictedIssue}`);
        log('热温冷数据存在:', !!hwcData);
        if (hwcData) {
            const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
            log('热温冷比例数:', ratios.length);
        }

        // 2. 检查红球组合
        log('\n' + '='.repeat(80));
        log('🔴 红球组合检查');
        log('='.repeat(80));
        const redCol = mongoose.connection.collection('hit_dlt_redcombinations');
        const redCombosCount = await redCol.countDocuments();
        log(`总红球组合数: ${redCombosCount.toLocaleString()}`);

        // 3. 检查蓝球组合
        log('\n' + '='.repeat(80));
        log('🔵 蓝球组合检查');
        log('='.repeat(80));
        const blueCol = mongoose.connection.collection('hit_dlt_bluecombinations');
        const blueCombosCount = await blueCol.countDocuments();
        log(`总蓝球组合数: ${blueCombosCount.toLocaleString()}`);

        // 4. 检查任务结果集
        log('\n' + '='.repeat(80));
        log('📋 任务结果检查');
        log('='.repeat(80));
        const resultsCol = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const predictedResult = await resultsCol.findOne({
            period: predictedIssue
        });

        log('推算期结果存在:', !!predictedResult);
        if (predictedResult) {
            log('组合数:', predictedResult.combination_count);
            log('基准期:', predictedResult.base_period);
            log('命中分析:', predictedResult.hit_analysis);
        }

    } catch (error) {
        log('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnosticPredictedIssue();