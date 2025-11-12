/**
 * 诊断卡住的任务
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        const taskId = 'hwc-pos-20251111-ciw';

        // 查询任务详情
        const task = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({ task_id: taskId });

        if (!task) {
            console.log('❌ 任务不存在');
            process.exit(0);
        }

        console.log('📋 任务详细信息:');
        console.log(`   任务ID: ${task.task_id}`);
        console.log(`   任务名称: ${task.task_name}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   更新时间: ${task.updated_at}`);
        console.log(`   完成时间: ${task.completed_at || '未完成'}`);
        console.log('');

        console.log('📊 进度信息:');
        console.log(`   当前: ${task.progress?.current || 0}`);
        console.log(`   总计: ${task.progress?.total || 0}`);
        console.log(`   百分比: ${task.progress?.percentage || 0}%`);
        console.log(`   当前期号: ${task.progress?.current_issue || '未知'}`);
        console.log('');

        console.log('📈 期号范围:');
        console.log(`   类型: ${task.period_range?.type}`);
        console.log(`   起始: ${task.period_range?.start}`);
        console.log(`   结束: ${task.period_range?.end}`);
        console.log(`   总数: ${task.period_range?.total}`);
        console.log('');

        // 检查任务结果
        const results = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: taskId })
            .toArray();

        console.log(`📦 任务结果数量: ${results.length}`);
        console.log('');

        // 检查排除详情
        const exclusions = await mongoose.connection.db
            .collection('HIT_DLT_ExclusionDetails')
            .find({ task_id: taskId })
            .toArray();

        console.log(`📝 排除详情数量: ${exclusions.length}`);
        console.log('');

        // 诊断问题
        console.log('🔍 问题诊断:');

        const timeSinceCreate = new Date() - new Date(task.created_at);
        const minutesSinceCreate = Math.floor(timeSinceCreate / 60000);

        console.log(`   创建至今: ${minutesSinceCreate} 分钟`);

        if (task.status === 'processing' && task.progress?.percentage === 0) {
            console.log('   ⚠️ 任务状态异常: 处理中但进度为0%');
            console.log('');
            console.log('   可能的原因:');
            console.log('   1. 任务处理函数未被调用');
            console.log('   2. 任务处理函数执行出错（未更新进度）');
            console.log('   3. 服务器未正确启动或使用旧代码');
            console.log('   4. 任务卡在某个步骤无法继续');
            console.log('');
            console.log('   💡 建议:');
            console.log('   1. 检查服务器日志是否有错误');
            console.log('   2. 确认服务器是否真的在运行');
            console.log('   3. 重启应用并重新创建任务');
        }

        // 检查最近所有任务的状态
        console.log('\n📊 最近5个任务的状态:');
        const recentTasks = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(5)
            .toArray();

        for (const t of recentTasks) {
            const progress = t.progress?.percentage || 0;
            const status = t.status;
            const createTime = new Date(t.created_at).toLocaleString('zh-CN');
            console.log(`   ${t.task_id}: ${status} (${progress}%) - ${createTime}`);
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose().catch(console.error);
