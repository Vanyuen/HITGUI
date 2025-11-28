/**
 * 检查大写的 HIT_DLT 集合是否有开奖号码
 */

const mongoose = require('mongoose');

async function checkHitDlt() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 检查 HIT_DLT (大写) 集合
        const hitDltCollection = db.collection('HIT_DLT');
        const count = await hitDltCollection.countDocuments();
        console.log(`📊 HIT_DLT 集合记录数: ${count}\n`);

        if (count > 0) {
            const latest = await hitDltCollection.findOne({}, { sort: { _id: -1 } });
            console.log('📋 HIT_DLT 最新记录:');
            console.log(JSON.stringify(latest, null, 2));
            console.log('\n字段列表:', Object.keys(latest || {}).sort());
        }

        // 也检查其他可能的集合
        const collectionsToCheck = [
            'HIT_DLT',
            'hit_dlt',
            'hit_unionlottos'  // 可能双色球和大乐透都在这里
        ];

        for (const collName of collectionsToCheck) {
            console.log(`\n\n━━━━ 集合: ${collName} ━━━━`);
            const coll = db.collection(collName);
            const count = await coll.countDocuments();
            console.log(`记录数: ${count}`);

            if (count > 0) {
                const latest = await coll.findOne({}, { sort: { _id: -1 } });
                console.log('\n最新记录:', JSON.stringify(latest, null, 2));

                // 查找有 Red1 字段的记录
                const withRed1 = await coll.findOne({ Red1: { $exists: true } });
                if (withRed1) {
                    console.log('\n✅ 找到有 Red1 字段的记录:');
                    console.log(JSON.stringify(withRed1, null, 2));
                }

                // 查找有 red_ball_1 字段的记录
                const withRedBall1 = await coll.findOne({ red_ball_1: { $exists: true } });
                if (withRedBall1) {
                    console.log('\n✅ 找到有 red_ball_1 字段的记录:');
                    console.log(JSON.stringify(withRedBall1, null, 2));
                }
            }
        }

        // 检查 hit_dlt_predictiontaskresults，看看它是如何存储 winning_numbers 的
        console.log('\n\n━━━━ 检查 hit_dlt_predictiontaskresults 的 winning_numbers 字段 ━━━━');
        const taskResults = db.collection('hit_dlt_predictiontaskresults');
        const taskResultSample = await taskResults.findOne({ winning_numbers: { $exists: true } });
        if (taskResultSample) {
            console.log('找到包含 winning_numbers 的任务结果:');
            console.log(`   period: ${taskResultSample.period}`);
            console.log(`   winning_numbers: ${JSON.stringify(taskResultSample.winning_numbers)}`);
        }

        await mongoose.connection.close();
        console.log('\n\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkHitDlt();
