const mongoose = require('mongoose');

async function diagnoseHwcOptimizedTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const HwcOptimized = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

        // 查找最近的几个记录
        const recentRecords = await HwcOptimized
            .find({})
            .sort({ base_issue: -1 })
            .limit(5)
            .toArray();

        console.log('查找到的记录数:', recentRecords.length);

        recentRecords.forEach((record, index) => {
            console.log(`\n记录 ${index + 1}:`);
            console.log(`期号对: ${record.base_issue} → ${record.target_issue}`);

            // 打印所有记录的完整结构
            console.log('完整记录结构:');
            console.log(JSON.stringify(record, null, 2));
        });

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    }
}

diagnoseHwcOptimizedTable();