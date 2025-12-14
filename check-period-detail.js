/**
 * 检查25141和25142期的详细结果
 */
const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const resultCollection = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontaskresults');

        // 查询最新任务的25141和25142期结果
        const latestTask = await mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { created_at: -1 } });

        console.log('任务ID:', latestTask.task_id);

        for (const period of [25140, 25141, 25142]) {
            const result = await resultCollection.findOne({
                task_id: latestTask.task_id,
                period: period
            });

            console.log(`\n======== 期号 ${period} ========`);
            if (result) {
                console.log('is_predicted:', result.is_predicted);
                console.log('combination_count:', result.combination_count);
                console.log('base_issue:', result.base_issue);
                console.log('error:', result.error || '(无)');
                console.log('positive_selection_details:', JSON.stringify(result.positive_selection_details, null, 2));

                // 检查paired_combinations
                const pairedCount = result.paired_combinations?.length || 0;
                console.log('paired_combinations数量:', pairedCount);

                if (pairedCount > 0) {
                    console.log('第一个组合样例:', JSON.stringify(result.paired_combinations[0], null, 2));
                }
            } else {
                console.log('❌ 结果不存在');
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ 错误:', err.message);
        process.exit(1);
    }
}

check();
