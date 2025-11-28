/**
 * 检查PredictionTask集合中的任务
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const PredictionTaskSchema = new mongoose.Schema({}, {
    collection: 'PredictionTask',
    strict: false
});

const PredictionTask = mongoose.model('PredictionTask_Check2', PredictionTaskSchema);

async function checkTasks() {
    try {
        console.log('🔌 连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查找最新的几个任务
        console.log('📊 查询最新的5个任务...');
        const tasks = await PredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        if (tasks.length === 0) {
            console.log('❌ 没有找到任何任务');
            return;
        }

        console.log(`找到 ${tasks.length} 个任务\n`);

        tasks.forEach((task, index) => {
            console.log(`\n========== 任务 ${index + 1} ==========`);
            console.log(`任务ID: ${task._id}`);
            console.log(`任务名称: ${task.task_name}`);
            console.log(`创建时间: ${task.created_at}`);
            console.log(`状态: ${task.status}`);
            console.log(`基础期号: ${task.base_issue}`);
            console.log(`目标期号: ${task.target_issues?.length > 0 ? task.target_issues.join(', ') : '无'}`);

            // 检查periods数据
            if (task.periods && task.periods.length > 0) {
                console.log(`\n各期详情 (共${task.periods.length}期):`);

                task.periods.forEach((period, idx) => {
                    const isPredicted = period.is_predicted || false;
                    const hasWinning = period.winning_numbers &&
                                     period.winning_numbers.red &&
                                     period.winning_numbers.red.length > 0;

                    const status = isPredicted ? '❌ 推算' : '✅ 已开奖';
                    const combos = period.combination_count || 0;

                    console.log(`  ${idx + 1}. 期号 ${period.period || period.issue || '未知'}:`);
                    console.log(`      状态: ${status} (is_predicted=${isPredicted})`);
                    console.log(`      组合数: ${combos}`);
                    console.log(`      有开奖号码: ${hasWinning}`);

                    // 显示前3期的开奖号码
                    if (idx < 3 && hasWinning) {
                        const redBalls = period.winning_numbers.red.map(n => String(n).padStart(2, '0')).join(' ');
                        const blueBalls = period.winning_numbers.blue.map(n => String(n).padStart(2, '0')).join(' ');
                        console.log(`      开奖号码: ${redBalls} + ${blueBalls}`);
                    }
                });

                // 重点检查25115
                const period25115 = task.periods.find(p =>
                    (p.period === '25115' || p.period === 25115) ||
                    (p.issue === '25115' || p.issue === 25115)
                );

                if (period25115) {
                    console.log('\n🔍 重点检查 25115期 的详细数据:');
                    console.log(JSON.stringify(period25115, null, 2));
                }
            }
        });

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

checkTasks();
