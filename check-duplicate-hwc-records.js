#!/usr/bin/env node

const mongoose = require('mongoose');

async function checkDuplicateRecords() {
    console.log('\n🔍 检查热温冷优化表是否有重复记录...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

    console.log('='.repeat(60));
    console.log('查找期号25124的所有记录');
    console.log('='.repeat(60));

    const records = await hwcTable.find({ target_issue: '25124' }).toArray();

    console.log(`\n找到 ${records.length} 条记录\n`);

    records.forEach((record, idx) => {
        console.log(`记录 ${idx + 1}:`);
        console.log(`  _id: ${record._id}`);
        console.log(`  base_issue: ${record.base_issue}`);
        console.log(`  target_issue: ${record.target_issue}`);
        console.log(`  generated_at: ${record.generated_at}`);
        console.log(`  combination_count: ${record.combination_count}`);

        const ratios = Object.keys(record.hot_warm_cold_data || {});
        console.log(`  热温冷比例种类: ${ratios.length}`);

        // 检查是否有温号
        const withWarm = ratios.filter(r => {
            const [h, w, c] = r.split(':').map(Number);
            return w > 0;
        });

        console.log(`  含温号的比例: ${withWarm.length} 种`);

        if (withWarm.length > 0) {
            console.log(`  ✅ 这是正确的记录！`);
            console.log(`  含温号比例示例: ${withWarm.slice(0, 5).join(', ')}`);
        } else {
            console.log(`  ❌ 这是错误的记录（无温号）`);
        }

        console.log('');
    });

    if (records.length > 1) {
        console.log('='.repeat(60));
        console.log('⚠️  发现重复记录！需要删除错误的记录');
        console.log('='.repeat(60));

        // 找出错误的记录（无温号的）
        const wrongRecords = records.filter(r => {
            const ratios = Object.keys(r.hot_warm_cold_data || {});
            const withWarm = ratios.filter(ratio => {
                const [h, w, c] = ratio.split(':').map(Number);
                return w > 0;
            });
            return withWarm.length === 0;
        });

        console.log(`\n需要删除的错误记录数: ${wrongRecords.length}`);
        wrongRecords.forEach(record => {
            console.log(`  _id: ${record._id}, generated_at: ${record.generated_at}`);
        });
    }

    await mongoose.disconnect();
    console.log('\n✅ 检查完成！\n');
}

checkDuplicateRecords().catch(error => {
    console.error('❌ 检查失败:', error);
    process.exit(1);
});
