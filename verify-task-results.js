const { MongoClient } = require('mongodb');

async function verifyTaskResults() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    console.log('=== 验证任务结果数据结构 ===\n');

    // 获取所有任务
    const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks').find({}).toArray();
    console.log('任务总数:', tasks.length);

    for (const task of tasks) {
        console.log('\n--- 任务:', task.task_id, '---');
        console.log('  名称:', task.task_name);
        console.log('  状态:', task.status);

        // 获取该任务的结果
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .toArray();

        console.log('  期号数:', results.length);

        // 统计命中信息
        let withHitAnalysis = 0;
        let withWinningNumbers = 0;
        let predictedCount = 0;
        let drawnCount = 0;

        for (const r of results) {
            if (r.hit_analysis && (r.hit_analysis.max_red_hit > 0 || r.hit_analysis.total_prize > 0)) {
                withHitAnalysis++;
            }
            if (r.winning_numbers && (r.winning_numbers.red?.length > 0 || r.winning_numbers.blue?.length > 0)) {
                withWinningNumbers++;
            }
            if (r.is_predicted) {
                predictedCount++;
            } else {
                drawnCount++;
            }
        }

        console.log('  已开奖期号:', drawnCount);
        console.log('  推算期号:', predictedCount);
        console.log('  有命中分析的期号:', withHitAnalysis);
        console.log('  有开奖号码的期号:', withWinningNumbers);

        // 显示一个已开奖期号的详细信息
        const drawnResult = results.find(r => !r.is_predicted && r.combination_count > 0);
        if (drawnResult) {
            console.log('\n  示例（已开奖期）:');
            console.log('    期号:', drawnResult.period);
            console.log('    is_predicted:', drawnResult.is_predicted);
            console.log('    组合数:', drawnResult.combination_count);
            console.log('    开奖号码:', JSON.stringify(drawnResult.winning_numbers));
            console.log('    命中分析:', JSON.stringify(drawnResult.hit_analysis));
        }

        // 显示一个推算期号的信息
        const predictedResult = results.find(r => r.is_predicted);
        if (predictedResult) {
            console.log('\n  示例（推算期）:');
            console.log('    期号:', predictedResult.period);
            console.log('    is_predicted:', predictedResult.is_predicted);
            console.log('    组合数:', predictedResult.combination_count);
            console.log('    hit_analysis:', predictedResult.hit_analysis ? 'EXISTS (但应该为空)' : 'NULL (正确)');
        }
    }

    await client.close();
}

verifyTaskResults().catch(console.error);
