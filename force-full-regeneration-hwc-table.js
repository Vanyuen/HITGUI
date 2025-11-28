const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function forceFullRegenerationHWCTable() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 清空热温冷比优化表
        const deleteResult = await DLTRedCombinationsHotWarmColdOptimized.deleteMany({});
        console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录\n`);

        console.log('✅ 准备重新生成热温冷比优化表');
        console.log('请使用 "一键更新全部数据表" 功能，选择全量重建模式\n');

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceFullRegenerationHWCTable();