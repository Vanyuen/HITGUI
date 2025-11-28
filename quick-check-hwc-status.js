/**
 * 快速检查热温冷比优化表生成状态
 */

const mongoose = require('mongoose');

async function quickCheck() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 检查热温冷比优化表
        const hwcCollection = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

        const count = await hwcCollection.countDocuments();
        console.log(`📊 热温冷比优化表记录数: ${count}`);

        if (count > 0) {
            // 检查已开奖期和推算期的记录数
            const drawnCount = await hwcCollection.countDocuments({ is_predicted: false });
            const predictedCount = await hwcCollection.countDocuments({ is_predicted: true });

            console.log(`   - 已开奖期: ${drawnCount}`);
            console.log(`   - 推算期: ${predictedCount}`);

            // 获取最新几条记录
            const latest5 = await hwcCollection.find({})
                .sort({ _id: -1 })
                .limit(5)
                .project({ base_issue: 1, target_issue: 1, is_predicted: 1, total_combinations: 1 })
                .toArray();

            console.log(`\n📋 最新5条记录:`);
            latest5.forEach(r => {
                const timestamp = r._id.getTimestamp();
                console.log(`   ${r.base_issue}→${r.target_issue}, is_predicted=${r.is_predicted}, total_combinations=${r.total_combinations}, 时间=${timestamp.toLocaleString('zh-CN')}`);
            });

            // 检查 hot_warm_cold_data 字段是否为空
            const sampleWithData = await hwcCollection.findOne({});
            const hwcDataKeys = sampleWithData?.hot_warm_cold_data ? Object.keys(sampleWithData.hot_warm_cold_data) : [];
            console.log(`\n📊 样本数据的 hot_warm_cold_data 键数量: ${hwcDataKeys.length}`);
            if (hwcDataKeys.length > 0) {
                console.log(`   前3个键: ${hwcDataKeys.slice(0, 3).join(', ')}`);
                const firstKey = hwcDataKeys[0];
                const firstKeyLength = sampleWithData.hot_warm_cold_data[firstKey]?.length || 0;
                console.log(`   键 "${firstKey}" 的组合数: ${firstKeyLength}`);
            }
        } else {
            console.log('\n⚠️  表为空！可能正在生成中...');
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

quickCheck();
