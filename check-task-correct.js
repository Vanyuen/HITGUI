const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTPredictionTasks = mongoose.connection.db.collection('hit_dlt_predictiontasks');

    // 查找新任务
    const task = await DLTPredictionTasks.findOne({
        task_id: 'task_1760485819203_z6pw9n0xy'
    });

    if (task) {
        console.log('✅ 找到任务:', task.task_id);
        console.log('期号范围:', task.period_range);
        console.log('状态:', task.status);
        console.log('\n排除条件:');
        console.log(JSON.stringify(task.exclude_conditions, null, 2));

        // 查找任务结果
        const DLTPredictionTaskResults = mongoose.connection.db.collection('hit_dlt_predictiontaskresults');
        const results25080 = await DLTPredictionTaskResults.findOne({
            task_id: task.task_id,
            period: '25080'
        });

        if (results25080) {
            console.log('\n25080期预测结果:');
            console.log('组合数:', results25080.combination_count);
            console.log('红球组合数:', results25080.red_combinations?.length || 0);
            console.log('蓝球组合数:', results25080.blue_combinations?.length || 0);
        } else {
            console.log('\n❌ 没有找到25080期的预测结果');
        }
    } else {
        console.log('❌ 没有找到任务');

        // 显示最近3个任务
        const recentTasks = await DLTPredictionTasks.find({})
            .sort({ created_at: -1 })
            .limit(3)
            .toArray();

        console.log('\n最近3个任务:');
        recentTasks.forEach((t, idx) => {
            console.log(`${idx + 1}. ${t.task_id}`);
            console.log(`   期号: ${t.period_range}`);
            console.log(`   同出排除(按红球): ${t.exclude_conditions?.coOccurrencePerBall?.enabled ? '✅' : '❌'}`);
        });
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
