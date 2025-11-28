#!/usr/bin/env node

const mongoose = require('mongoose');

async function checkProgress() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

    const count = await hwcTable.countDocuments();
    const total = 2791;
    const percentage = (count / total * 100).toFixed(2);

    console.log('='.repeat(60));
    console.log('热温冷优化表生成进度');
    console.log('='.repeat(60));
    console.log(`当前记录数: ${count} / ${total}`);
    console.log(`完成度: ${percentage}%`);

    // 检查最新生成的记录
    const latest = await hwcTable.find({}).sort({ generated_at: -1 }).limit(1).toArray();
    if (latest.length > 0) {
        console.log(`\n最新生成: ${latest[0].base_issue} -> ${latest[0].target_issue}`);
        const ratios = Object.keys(latest[0].hot_warm_cold_data || {});
        const withWarm = ratios.filter(r => {
            const parts = r.split(':').map(Number);
            return parts[1] > 0;
        });
        console.log(`热温冷比例: ${ratios.length} 种, 含温号: ${withWarm.length} 种`);
    }

    // 检查期号25124是否已生成
    const target = await hwcTable.findOne({ target_issue: '25124' });
    if (target) {
        console.log('\n*** 目标期号25124已生成! ***');
        const ratios = Object.keys(target.hot_warm_cold_data || {});
        const withWarm = ratios.filter(r => {
            const parts = r.split(':').map(Number);
            return parts[1] > 0;
        });
        console.log(`比例种类: ${ratios.length}, 含温号: ${withWarm.length}`);

        // 检查4:1:0
        if (target.hot_warm_cold_data['4:1:0']) {
            const count410 = target.hot_warm_cold_data['4:1:0'].length;
            console.log(`4:1:0 组合数: ${count410.toLocaleString()}`);
        }
    } else {
        console.log('\n期号25124尚未生成');
    }

    await mongoose.disconnect();
}

checkProgress().catch(console.error);
