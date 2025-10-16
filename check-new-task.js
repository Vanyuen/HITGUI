const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const DLTPredictionTasks = mongoose.connection.db.collection('hit_dlt_prediction_tasks');

    // 查找新任务
    const task = await DLTPredictionTasks.findOne({
        taskId: 'task_1760485819203_z6pw9n0xy'
    });

    if (task) {
        console.log('✅ 找到任务:', task.taskId);
        console.log('期号范围:', task.startIssue, '-', task.endIssue);
        console.log('状态:', task.status);
        console.log('\n排除条件:');
        console.log(JSON.stringify(task.exclude_conditions, null, 2));

        // 检查25080的预测结果
        if (task.predictions && task.predictions.length > 0) {
            const pred25080 = task.predictions.find(p => p.issue === '25080' || p.issue === 25080);
            if (pred25080) {
                console.log('\n25080期预测结果:');
                console.log('组合数:', pred25080.combinations_count);
                console.log('红球组合数:', pred25080.red_combinations_count);
                console.log('蓝球组合数:', pred25080.blue_combinations_count);
            } else {
                console.log('\n❌ 没有找到25080期的预测结果');
                console.log('现有预测期号:', task.predictions.map(p => p.issue).slice(0, 5));
            }
        } else {
            console.log('\n❌ 任务predictions字段为空');
        }
    } else {
        console.log('❌ 没有找到任务');
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
