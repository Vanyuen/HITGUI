/**
 * 诊断推算期结果生成情况
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

        const HwcPositivePredictionTaskResult =
            mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult',
            { period: String },
            'hit_dlt_hwcpositivepredictiontaskresults');

        const predictedResult = await HwcPositivePredictionTaskResult.findOne({ period: predictedIssue });

        if (predictedResult) {
            log('\n✅ 推算期结果存在：');
            log('组合数:', predictedResult.combination_count);
            log('是否推算期:', predictedResult.is_predicted);
            log('基准期:', predictedResult.base_period);
            log('红球组合数:', predictedResult.red_combinations?.length || 0);
            log('蓝球组合数:', predictedResult.blue_combinations?.length || 0);
            log('\n详细命中分析:', predictedResult.hit_analysis || '暂无');
        } else {
            log('❌ 未找到推算期结果');
        }

    } catch (error) {
        log('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnosticPredictedResults();