const mongoose = require('mongoose');

async function analyzeHwcOptimizedTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const HwcOptimized = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

        // 统计总记录数
        const totalRecords = await HwcOptimized.countDocuments();

        // 分析最早和最晚的记录
        const earliestRecord = await HwcOptimized.findOne({}, { sort: { base_issue: 1 } });
        const latestRecord = await HwcOptimized.findOne({}, { sort: { base_issue: -1 } });

        // 使用聚合管道分析热温冷比分布
        const result = await HwcOptimized.aggregate([
            { $unwind: { path: "$hot_warm_cold_data", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ["$hot_warm_cold_data.k", "$hot_warm_cold_data"] },
                    totalCombinations: { $sum: {
                        $size: { $ifNull: ["$hot_warm_cold_data.v", []] }
                    }},
                    recordCount: { $sum: 1 }
                }
            },
            { $sort: { totalCombinations: -1 } },
            { $limit: 10 }
        ]).toArray();

        console.log('热温冷比优化表分析报告：');
        console.log('==========================');
        console.log(`总记录数: ${totalRecords}`);
        console.log(`期号范围: ${earliestRecord.base_issue} - ${latestRecord.base_issue}`);
        console.log('\n热温冷比分布 (Top 10):');
        console.log('比例\t\t总组合数\t记录次数');
        console.log('-----------------------------------');
        result.forEach(item => {
            console.log(`${item._id}\t\t${item.totalCombinations}\t\t${item.recordCount}`);
        });

        // 计算一些额外的统计信息
        const totalCombinationsCount = result.reduce((sum, item) => sum + item.totalCombinations, 0);
        const totalRecordCount = result.reduce((sum, item) => sum + item.recordCount, 0);

        console.log('\n补充统计:');
        console.log(`Top 10 热温冷比覆盖总组合数: ${totalCombinationsCount}`);
        console.log(`Top 10 热温冷比覆盖记录数: ${totalRecordCount}`);
        console.log(`总组合数百分比: ${(totalCombinationsCount / 324632 * 100).toFixed(2)}%`);

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('分析过程中发生错误:', error);
    }
}

analyzeHwcOptimizedTable();