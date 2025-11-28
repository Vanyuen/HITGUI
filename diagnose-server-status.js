/**
 * 服务器状态诊断脚本
 * 用于检查服务器是否卡住以及当前任务状态
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');
}

// Schema定义
const predictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    status: String,
    created_at: Date,
    updated_at: Date,
    period_range: Object,
    progress: Object
}, { collection: 'predictiontasks', strict: false });

const exclusionDetailSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    created_at: Date
}, { collection: 'dltexclusiondetails', strict: false });

const PredictionTask = mongoose.model('PredictionTask_diag', predictionTaskSchema);
const ExclusionDetail = mongoose.model('ExclusionDetail_diag', exclusionDetailSchema);

async function diagnose() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 服务器状态诊断');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        await connectDB();

        // 1. 查询最近的任务
        console.log('📋 最近的任务记录:\n');
        const recentTasks = await PredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        if (recentTasks.length === 0) {
            console.log('   ⚠️  没有找到任何任务记录\n');
        } else {
            for (const task of recentTasks) {
                console.log(`   任务ID: ${task.task_id}`);
                console.log(`   任务名称: ${task.task_name}`);
                console.log(`   状态: ${task.status || '未知'}`);
                console.log(`   创建时间: ${task.created_at || '未知'}`);
                console.log(`   更新时间: ${task.updated_at || '未知'}`);
                if (task.progress) {
                    console.log(`   进度: ${JSON.stringify(task.progress)}`);
                }
                console.log();
            }
        }

        // 2. 查询是否有 processing 状态的任务
        console.log('⚙️  正在处理中的任务:\n');
        const processingTasks = await PredictionTask.find({
            status: 'processing'
        }).lean();

        if (processingTasks.length === 0) {
            console.log('   ✅ 没有正在处理的任务\n');
        } else {
            console.log(`   ⚠️  发现 ${processingTasks.length} 个正在处理的任务:\n`);
            for (const task of processingTasks) {
                console.log(`   任务ID: ${task.task_id}`);
                console.log(`   任务名称: ${task.task_name}`);
                console.log(`   创建时间: ${task.created_at}`);
                console.log(`   更新时间: ${task.updated_at}`);

                // 计算任务运行时长
                const now = new Date();
                const updated = new Date(task.updated_at || task.created_at);
                const duration = Math.floor((now - updated) / 1000);

                console.log(`   运行时长: ${duration}秒`);
                if (duration > 300) {
                    console.log(`   🚨 警告: 任务运行超过5分钟，可能卡住!`);
                }
                console.log();
            }
        }

        // 3. 查询最近的排除详情记录
        console.log('📝 最近的排除详情记录:\n');
        const recentDetails = await ExclusionDetail.find({})
            .sort({ created_at: -1 })
            .limit(10)
            .lean();

        if (recentDetails.length === 0) {
            console.log('   ⚠️  没有找到任何排除详情记录\n');
        } else {
            console.log(`   最近10条记录:\n`);
            const detailsByTask = {};
            for (const detail of recentDetails) {
                const taskId = detail.task_id || '未知';
                if (!detailsByTask[taskId]) {
                    detailsByTask[taskId] = [];
                }
                detailsByTask[taskId].push(detail.period);
            }

            for (const [taskId, periods] of Object.entries(detailsByTask)) {
                console.log(`   任务ID: ${taskId}`);
                console.log(`   期号: ${periods.join(', ')}`);
                console.log();
            }
        }

        // 4. 检查日志中提到的任务 hwc-pos-20251120-ibd
        console.log('🔎 检查特定任务: hwc-pos-20251120-ibd\n');
        const specificTask = await PredictionTask.findOne({
            task_id: 'hwc-pos-20251120-ibd'
        }).lean();

        if (!specificTask) {
            console.log('   ⚠️  未找到任务 hwc-pos-20251120-ibd\n');
            console.log('   可能原因：');
            console.log('   1. 任务尚未保存到数据库');
            console.log('   2. 任务ID不同');
            console.log('   3. 任务已被删除\n');
        } else {
            console.log(`   ✅ 找到任务!\n`);
            console.log(`   任务名称: ${specificTask.task_name}`);
            console.log(`   状态: ${specificTask.status}`);
            console.log(`   创建时间: ${specificTask.created_at}`);
            console.log(`   更新时间: ${specificTask.updated_at}`);
            console.log(`   详细信息: ${JSON.stringify(specificTask, null, 2)}\n`);
        }

        // 5. 统计信息
        console.log('📊 统计信息:\n');
        const totalTasks = await PredictionTask.countDocuments({});
        const pendingTasks = await PredictionTask.countDocuments({ status: 'pending' });
        const processingCount = await PredictionTask.countDocuments({ status: 'processing' });
        const completedTasks = await PredictionTask.countDocuments({ status: 'completed' });
        const failedTasks = await PredictionTask.countDocuments({ status: 'failed' });

        console.log(`   总任务数: ${totalTasks}`);
        console.log(`   待处理: ${pendingTasks}`);
        console.log(`   处理中: ${processingCount}`);
        console.log(`   已完成: ${completedTasks}`);
        console.log(`   失败: ${failedTasks}\n`);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('诊断完成');
        console.log('═══════════════════════════════════════════════════════════════\n');

        // 诊断结论
        if (processingCount > 0) {
            console.log('⚠️  发现正在处理的任务，建议检查:');
            console.log('   1. 查看服务器控制台日志');
            console.log('   2. 检查是否有错误输出');
            console.log('   3. 如果任务卡住超过10分钟，考虑重启服务器\n');
        } else {
            console.log('✅ 没有发现卡住的任务\n');
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

diagnose().catch(console.error);
