const mongoose = require('mongoose');

// 连接MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (err) => {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
});

db.once('open', async () => {
    console.log('✅ 数据库连接成功\n');

    try {
        // 查询最新的任务
        const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();

        if (tasks.length === 0) {
            console.log('❌ 没有找到任务');
            await mongoose.connection.close();
            process.exit(0);
            return;
        }

        const task = tasks[0];
        console.log('📋 最新任务信息:');
        console.log('  task_id:', task.task_id);
        console.log('  status:', task.status);
        console.log('  output_config:', JSON.stringify(task.output_config, null, 2));
        console.log('  created_at:', task.created_at);
        console.log();

        // 查询该任务的结果
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .sort({ period: 1 })
            .toArray();

        console.log(`📊 找到 ${results.length} 个期号结果\n`);
        console.log('=' .repeat(100));

        for (const result of results) {
            const isPredictedLabel = result.is_predicted ? '(推算)' : '(已开奖)';
            console.log(`\n期号 ${result.period} ${isPredictedLabel}`);
            console.log('-'.repeat(100));
            console.log('  combination_count:', result.combination_count);
            console.log('  is_predicted:', result.is_predicted, '(类型:', typeof result.is_predicted + ')');
            console.log('  winning_numbers:', result.winning_numbers ? JSON.stringify(result.winning_numbers) : '❌ null');

            if (result.hit_analysis) {
                console.log('  hit_analysis:');
                console.log('    - max_red_hit:', result.hit_analysis.max_red_hit);
                console.log('    - max_blue_hit:', result.hit_analysis.max_blue_hit);
                console.log('    - hit_rate:', result.hit_analysis.hit_rate);
            } else {
                console.log('  hit_analysis: ❌ null');
            }

            // 检查 paired_combinations 数组
            const pairedCount = result.paired_combinations ? result.paired_combinations.length : 0;
            console.log('  paired_combinations数量:', pairedCount);
        }

        console.log('\n' + '='.repeat(100));

    } catch (error) {
        console.error('❌ 查询失败:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
});
