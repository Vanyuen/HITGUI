/**
 * 验证开奖号码数据格式
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    combination_count: Number,
    winning_numbers: mongoose.Schema.Types.Mixed,
    hit_analysis: mongoose.Schema.Types.Mixed
});

const HwcPositivePredictionTaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult', hwcPositivePredictionTaskResultSchema);

// 也查询实际的hit_dlts开奖数据
const dltSchema = new mongoose.Schema({
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
});

const hit_dlts = mongoose.model('hit_dlts', dltSchema);

async function verify() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查询最新任务的一个结果
        const result = await HwcPositivePredictionTaskResult.findOne({})
            .sort({ period: -1 })
            .lean();

        if (!result) {
            console.log('❌ 没有找到任务结果');
            return;
        }

        console.log(`📋 期号: ${result.period}`);
        console.log(`📊 组合数: ${result.combination_count}`);
        console.log(`\n🎯 winning_numbers 原始数据:`);
        console.log(JSON.stringify(result.winning_numbers, null, 2));

        // 查询hit_dlts实际开奖数据
        const actualIssue = await hit_dlts.findOne({ Issue: parseInt(result.period) }).lean();

        if (actualIssue) {
            console.log(`\n✅ hit_dlts实际开奖数据 (期号${result.period}):`);
            console.log(`  红球: ${actualIssue.Red1}, ${actualIssue.Red2}, ${actualIssue.Red3}, ${actualIssue.Red4}, ${actualIssue.Red5}`);
            console.log(`  蓝球: ${actualIssue.Blue1}, ${actualIssue.Blue2}`);

            // 对比
            console.log(`\n🔍 数据对比:`);
            if (result.winning_numbers) {
                console.log(`  保存的红球: ${result.winning_numbers.red_balls}`);
                console.log(`  实际的红球: [${actualIssue.Red1}, ${actualIssue.Red2}, ${actualIssue.Red3}, ${actualIssue.Red4}, ${actualIssue.Red5}]`);
                console.log(`  保存的蓝球: ${result.winning_numbers.blue_balls}`);
                console.log(`  实际的蓝球: [${actualIssue.Blue1}, ${actualIssue.Blue2}]`);
            } else {
                console.log(`  ❌ winning_numbers 为 null 或 undefined`);
            }
        } else {
            console.log(`\n⚠️ 期号${result.period}未开奖（推算期）`);
        }

        console.log(`\n📊 hit_analysis 数据:`);
        console.log(JSON.stringify(result.hit_analysis, null, 2));

    } catch (error) {
        console.error('❌ 验证失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

verify();
