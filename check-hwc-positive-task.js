/**
 * 检查热温冷正选任务状态
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function checkTask() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 检查热温冷正选任务');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 检查任务集合
    const taskCollectionName = 'hit_dlt_hwcpositivepredictiontasks';
    const taskCount = await mongoose.connection.db.collection(taskCollectionName).countDocuments();
    console.log(`任务集合 (${taskCollectionName}): ${taskCount} 条记录\n`);

    if (taskCount > 0) {
        // 查询所有任务
        const allTasks = await mongoose.connection.db.collection(taskCollectionName)
            .find({})
            .sort({ created_at: -1 })
            .toArray();

        console.log('📋 所有任务:\n');
        for (const task of allTasks) {
            console.log(`   任务ID: ${task.task_id}`);
            console.log(`   任务名称: ${task.task_name || '未知'}`);
            console.log(`   状态: ${task.status || '未知'}`);
            console.log(`   创建时间: ${task.created_at || '未知'}`);
            console.log(`   更新时间: ${task.updated_at || '未知'}`);

            if (task.progress) {
                console.log(`   进度: ${JSON.stringify(task.progress)}`);
            }

            if (task.status === 'processing') {
                const now = new Date();
                const updated = new Date(task.updated_at || task.created_at);
                const duration = Math.floor((now - updated) / 1000);
                console.log(`   ⚠️  运行时长: ${duration}秒`);

                if (duration > 300) {
                    console.log(`   🚨 任务可能卡住（超过5分钟）`);
                }
            }
            console.log();
        }

        // 查询特定任务 hwc-pos-20251120-ibd
        console.log('🔎 查询任务: hwc-pos-20251120-ibd\n');
        const specificTask = await mongoose.connection.db.collection(taskCollectionName)
            .findOne({ task_id: 'hwc-pos-20251120-ibd' });

        if (specificTask) {
            console.log('   ✅ 找到任务!\n');
            console.log(JSON.stringify(specificTask, null, 2));
        } else {
            console.log('   ⚠️  未找到任务 hwc-pos-20251120-ibd');
            console.log('   可能该任务尚未保存到数据库\n');
        }
    }

    // 检查结果集合
    const resultCollectionName = 'hit_dlt_hwcpositivepredictiontaskresults';
    const resultCount = await mongoose.connection.db.collection(resultCollectionName).countDocuments();
    console.log(`结果集合 (${resultCollectionName}): ${resultCount} 条记录\n`);

    if (resultCount > 0) {
        // 查询最近的结果
        const recentResults = await mongoose.connection.db.collection(resultCollectionName)
            .find({})
            .sort({ created_at: -1 })
            .limit(5)
            .toArray();

        console.log('📊 最近的5条结果:\n');
        for (const result of recentResults) {
            console.log(`   任务ID: ${result.task_id}`);
            console.log(`   期号: ${result.period}`);
            console.log(`   创建时间: ${result.created_at}`);
            console.log();
        }
    }

    // 检查排除详情集合
    const exclusionCollectionName = 'dltexclusiondetails';
    const exclusionCount = await mongoose.connection.db.collection(exclusionCollectionName).countDocuments();
    console.log(`排除详情集合 (${exclusionCollectionName}): ${exclusionCount} 条记录\n`);

    if (exclusionCount > 0) {
        // 查询最近的排除详情
        const recentExclusions = await mongoose.connection.db.collection(exclusionCollectionName)
            .find({})
            .sort({ created_at: -1 })
            .limit(10)
            .toArray();

        console.log('📝 最近的10条排除详情:\n');
        const byTask = {};
        for (const exc of recentExclusions) {
            const taskId = exc.task_id || '未知';
            if (!byTask[taskId]) {
                byTask[taskId] = {
                    periods: new Set(),
                    count: 0,
                    latest: exc.created_at
                };
            }
            byTask[taskId].periods.add(exc.period);
            byTask[taskId].count++;
        }

        for (const [taskId, info] of Object.entries(byTask)) {
            console.log(`   任务ID: ${taskId}`);
            console.log(`   期号: ${Array.from(info.periods).join(', ')}`);
            console.log(`   记录数: ${info.count}`);
            console.log(`   最新时间: ${info.latest}`);
            console.log();
        }
    }

    await mongoose.connection.close();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('检查完成');
    console.log('═══════════════════════════════════════════════════════════════');
}

checkTask().catch(console.error);
