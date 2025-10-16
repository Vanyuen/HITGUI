const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTPredictionTasks = mongoose.connection.db.collection('hit_dlt_predictiontasks');

    const task = await DLTPredictionTasks.findOne({
        task_id: 'task_1760485819203_z6pw9n0xy'
    });

    console.log('任务详细信息:');
    console.log('创建时间:', task.created_at);
    console.log('完成时间:', task.updated_at);
    console.log('\n排除条件:');
    console.log(JSON.stringify(task.exclude_conditions, null, 2));
    console.log('\n统计信息:');
    console.log(JSON.stringify(task.statistics, null, 2));

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
