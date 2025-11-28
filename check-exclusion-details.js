const mongoose = require('mongoose');

async function checkExclusionDetails() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n=== 诊断排除详情数据问题 ===\n');

        const db = mongoose.connection.db;

        // 1. 检查最新的任务
        console.log('1. 检查最新任务:');
        const latestTask = await db.collection('predictiontasks').findOne({}, { sort: { created_at: -1 } });
        if (latestTask) {
            console.log('   最新任务ID:', latestTask._id);
            console.log('   任务名称:', latestTask.task_name);
            console.log('   创建时间:', latestTask.created_at);
            console.log('   状态:', latestTask.status);
        } else {
            console.log('   ❌ 没有找到任务');
        }

        // 2. 检查最新的任务结果
        console.log('\n2. 检查最新任务结果:');
        const latestResult = await db.collection('predictiontaskresults').findOne({}, { sort: { created_at: -1 } });
        if (latestResult) {
            console.log('   结果ID:', latestResult._id);
            console.log('   任务ID:', latestResult.task_id);
            console.log('   期号:', latestResult.period);
        } else {
            console.log('   ❌ 没有找到任务结果');
        }

        // 3. 检查排除详情数据
        console.log('\n3. 检查排除详情数据:');
        const exclusionCount = await db.collection('hit_dlt_exclusiondetails').countDocuments({});
        console.log('   总记录数:', exclusionCount);

        if (exclusionCount > 0) {
            // 按step分组统计
            const stepStats = await db.collection('hit_dlt_exclusiondetails').aggregate([
                { $group: { _id: '$step', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]).toArray();

            console.log('   按Step统计:');
            for (const stat of stepStats) {
                console.log('     Step', stat._id, ':', stat.count, '条记录');
            }

            // 检查最新的排除详情记录
            const latestExclusion = await db.collection('hit_dlt_exclusiondetails').findOne({}, { sort: { _id: -1 } });
            console.log('\n   最新排除详情记录:');
            console.log('     任务ID:', latestExclusion.task_id);
            console.log('     结果ID:', latestExclusion.result_id);
            console.log('     期号:', latestExclusion.period);
            console.log('     Step:', latestExclusion.step);
            console.log('     条件:', latestExclusion.condition);
            console.log('     排除数量:', latestExclusion.excluded_count);
            console.log('     是否有metadata:', latestExclusion.metadata ? 'Yes' : 'No');

            if (latestExclusion.metadata) {
                console.log('     metadata 内容:', JSON.stringify(latestExclusion.metadata, null, 2));
            }
        } else {
            console.log('   ❌ 没有排除详情数据');
        }

        // 4. 检查最新任务的排除详情
        if (latestTask && latestResult) {
            console.log('\n4. 检查最新任务的排除详情:');
            const taskExclusions = await db.collection('hit_dlt_exclusiondetails').find({
                task_id: latestTask._id.toString(),
                period: latestResult.period
            }).toArray();

            console.log('   找到', taskExclusions.length, '条排除详情记录');
            if (taskExclusions.length > 0) {
                for (const exc of taskExclusions) {
                    console.log('     - Step', exc.step, ':', exc.condition, ', 排除', exc.excluded_count, '个组合');
                }
            }
        }

        mongoose.connection.close();
        console.log('\n=== 诊断完成 ===\n');

    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

checkExclusionDetails();
