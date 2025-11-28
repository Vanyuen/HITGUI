const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        console.log('📋 任务期号范围配置:\n');
        const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { _id: -1 } });

        console.log(JSON.stringify(task.period_range, null, 2));

        console.log('\n\n📊 最近10期期号:\n');
        const recent = await mongoose.connection.db.collection('hit_dlts')
            .find({})
            .sort({ Issue: -1 })
            .limit(10)
            .toArray();

        recent.forEach((r, i) => {
            console.log(`${i + 1}. 期号${r.Issue} (ID=${r.ID})`);
        });

        console.log('\n\n🔍 期号范围分析:\n');
        console.log(`期号范围: ${task.period_range.start} - ${task.period_range.end}`);
        console.log(`总期数: ${task.period_range.total}`);
        console.log(`推算期数: ${task.period_range.predicted_count}`);
        console.log(`历史期数: ${task.period_range.total - task.period_range.predicted_count}`);

        console.log('\n\n🧮 计算验证:\n');
        const latestIssue = recent[0].Issue;
        console.log(`数据库最新期号: ${latestIssue}`);
        console.log(`推算下一期: ${latestIssue + 1}`);

        // 计算从start到end应该有多少期
        const start = parseInt(task.period_range.start);
        const end = parseInt(task.period_range.end);
        console.log(`\n从期号${start}到${end}:`);

        const actualIssues = await mongoose.connection.db.collection('hit_dlts')
            .find({ Issue: { $gte: start, $lte: end } })
            .sort({ Issue: 1 })
            .toArray();

        console.log(`实际历史期号数: ${actualIssues.length}期`);
        actualIssues.forEach(r => {
            console.log(`  - ${r.Issue}`);
        });

        if (end > latestIssue) {
            console.log(`  - ${end} (推算)`);
            console.log(`\n总计: ${actualIssues.length}期历史 + 1期推算 = ${actualIssues.length + 1}期`);
        } else {
            console.log(`\n总计: ${actualIssues.length}期（全部历史）`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('错误:', error.message);
        await mongoose.disconnect();
    }
}

check();
