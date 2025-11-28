#!/usr/bin/env node

const mongoose = require('mongoose');

async function clearAllHwcRecords() {
    console.log('\n🗑️  清空热温冷优化表所有记录...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

    console.log('='.repeat(60));
    console.log('步骤1: 统计当前记录数');
    console.log('='.repeat(60));

    const currentCount = await hwcTable.countDocuments();
    console.log(`\n当前记录数: ${currentCount} 条\n`);

    if (currentCount === 0) {
        console.log('✅ 表已经是空的，无需清空');
        await mongoose.disconnect();
        return;
    }

    console.log('='.repeat(60));
    console.log('步骤2: 删除所有记录');
    console.log('='.repeat(60));

    const result = await hwcTable.deleteMany({});

    console.log(`\n✅ 已删除 ${result.deletedCount} 条记录\n`);

    console.log('='.repeat(60));
    console.log('步骤3: 验证清空结果');
    console.log('='.repeat(60));

    const remainingCount = await hwcTable.countDocuments();
    console.log(`\n剩余记录数: ${remainingCount} 条\n`);

    if (remainingCount === 0) {
        console.log('✅ 热温冷优化表已完全清空！');
    } else {
        console.log(`⚠️  还有 ${remainingCount} 条记录未删除`);
    }

    await mongoose.disconnect();
    console.log('\n✅ 清空完成！\n');
}

clearAllHwcRecords().catch(error => {
    console.error('❌ 清空失败:', error);
    process.exit(1);
});
