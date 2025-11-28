const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function fixHWCOptimizedTable() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 删除所有旧记录
        const deleteResult = await DLTRedCombinationsHotWarmColdOptimized.deleteMany({});
        console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录\n`);

        // 2. 获取所有已开奖期号
        const allIssues = await hit_dlts.find({}).sort({ ID: 1 }).toArray();
        console.log(`📊 找到 ${allIssues.length} 期已开奖数据`);

        console.log('\n🔍 准备重新生成热温冷优化表');
        console.log('请使用 "一键更新全部数据表" 功能重新生成数据\n');

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixHWCOptimizedTable();