/**
 * 检查任务中的推算期标记
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const PredictionTaskResultSchema = new mongoose.Schema({}, {
    collection: 'PredictionTaskResult',
    strict: false
});

const PredictionTaskResult = mongoose.model('PredictionTaskResult_Check', PredictionTaskResultSchema);

async function checkTask() {
    try {
        console.log('🔌 连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查找最新的任务结果
        console.log('📊 查询最新的任务结果...');
        const latestTask = await PredictionTaskResult.findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 没有找到任何任务结果');
            return;
        }

        console.log(`🎯 任务ID: ${latestTask.task_id}`);
        console.log(`📅 创建时间: ${latestTask.created_at}`);
        console.log(`📋 期号范围: ${latestTask.issue_range?.join(', ')}`);

        if (latestTask.periods && latestTask.periods.length > 0) {
            console.log(`\n📊 各期详情 (共${latestTask.periods.length}期):`);

            latestTask.periods.forEach((period, index) => {
                const isPredicted = period.is_predicted || false;
                const hasWinning = period.winning_numbers &&
                                 period.winning_numbers.red &&
                                 period.winning_numbers.red.length > 0;

                const redBalls = hasWinning ?
                    period.winning_numbers.red.map(n => String(n).padStart(2, '0')).join(' ') :
                    '无';
                const blueBalls = hasWinning ?
                    period.winning_numbers.blue.map(n => String(n).padStart(2, '0')).join(' ') :
                    '无';

                const status = isPredicted ? '❌ 推算' : '✅ 已开奖';
                const combos = period.combination_count || 0;

                console.log(`  ${index + 1}. 期号 ${period.issue}:`);
                console.log(`      状态: ${status} (is_predicted=${isPredicted})`);
                console.log(`      开奖号码: ${redBalls} + ${blueBalls}`);
                console.log(`      组合数: ${combos}`);
                console.log(`      有命中数据: ${!!period.hit_analysis}`);
            });
        }

        // 检查具体的25115期
        const period25115 = latestTask.periods?.find(p => p.issue === '25115' || p.issue === 25115);
        if (period25115) {
            console.log('\n🔍 重点检查 25115期:');
            console.log(JSON.stringify(period25115, null, 2));
        }

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

checkTask();
