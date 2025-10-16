const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTPredictionTaskResults = mongoose.connection.db.collection('hit_dlt_predictiontaskresults');

    const results = await DLTPredictionTaskResults.find({
        task_id: 'task_1760485819203_z6pw9n0xy'
    }).sort({ period: 1 }).toArray();

    console.log('任务 task_1760485819203_z6pw9n0xy 的所有结果:');
    console.log('共 ' + results.length + ' 个期号\n');

    if (results.length > 0) {
        results.slice(0, 5).forEach((r, i) => {
            console.log(i + 1 + '. 期号 ' + r.period + ': ' + r.combination_count + ' 个组合');
        });

        if (results.length > 5) {
            console.log('... (' + (results.length - 5) + ' 个期号未显示)');
        }
    } else {
        console.log('❌ 没有找到任何结果记录');
        
        console.log('\n检查任务results字段...');
        const DLTPredictionTasks = mongoose.connection.db.collection('hit_dlt_predictiontasks');
        const task = await DLTPredictionTasks.findOne({
            task_id: 'task_1760485819203_z6pw9n0xy'
        });

        if (task.results && task.results.length > 0) {
            console.log('✅ 任务results字段有 ' + task.results.length + ' 条数据');
            console.log('前5条:');
            task.results.slice(0, 5).forEach((r, i) => {
                console.log(i + 1 + '. 期号 ' + r.period + ': ' + r.combination_count + ' 个组合');
            });
        } else {
            console.log('❌ 任务results字段也是空的');
        }
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
