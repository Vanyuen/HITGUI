const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTPredictionTasks = mongoose.connection.db.collection('hit_dlt_prediction_tasks');

    // 查找最近10个任务
    const tasks = await DLTPredictionTasks.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

    console.log(`📊 最近${tasks.length}个任务:\n`);

    tasks.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task.taskId}`);
        console.log(`   期号: ${task.startIssue}-${task.endIssue}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.createdAt}`);
        console.log(`   同出排除(按红球): ${task.exclude_conditions?.coOccurrencePerBall?.enabled ? '✅' : '❌'}`);
        console.log(`   同出排除(按期号): ${task.exclude_conditions?.coOccurrenceByIssues?.enabled ? '✅' : '❌'}`);

        if (task.predictions && task.predictions.length > 0) {
            const first = task.predictions[0];
            console.log(`   首期 ${first.issue}: ${first.red_combinations_count || first.combinations_count} 个组合`);
        }
        console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
