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

        // 查询所有结果集合
        const collections = await mongoose.connection.db.listCollections().toArray();
        const resultCollections = collections.filter(c =>
            c.name.includes('result') &&
            c.name.includes('hwc') &&
            c.name.includes('prediction')
        );

        log('\n📋 找到的结果集合:');
        for (const collection of resultCollections) {
            const col = mongoose.connection.collection(collection.name);
            const count = await col.countDocuments();
            log(`  - ${collection.name}: ${count}条记录`);

            if (count > 0) {
                const lastRecord = await col.findOne({}, { sort: { created_at: -1 } });
                log(`    最新记录期号: ${lastRecord.period}`);
            }
        }

        // 尝试查询推算期结果
        log('\n🔬 查询推算期结果:');
        for (const collection of resultCollections) {
            const col = mongoose.connection.collection(collection.name);
            const result = await col.findOne({ period: predictedIssue });

            if (result) {
                log(`✅ 在 ${collection.name} 中找到推算期结果:`);
                log('  期号:', result.period);
                log('  是否推算期:', result.is_predicted);
                log('  组合数:', result.combination_count);
                log('  详细信息:', JSON.stringify(result, null, 2));
            }
        }

        // 额外检查最近的任务
        const tasks = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');
        const latestTask = await tasks.findOne({}, { sort: { created_at: -1 } });

        log('\n🔍 最近任务信息:');
        log('任务ID:', latestTask._id);
        log('任务名称:', latestTask.task_name);
        log('创建时间:', latestTask.created_at);
        log('期号范围:', latestTask.period_range);

    } catch (error) {
        log('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnosticPredictedResults();