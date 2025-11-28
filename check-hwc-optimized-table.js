const mongoose = require('mongoose');
const { COLLECTIONS } = require('./constants/collections');

async function checkHWCOptimizedTable() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        const collection = mongoose.connection.db.collection(COLLECTIONS.HWC_OPTIMIZED);

        console.log('检查热温冷优化表详情');

        const totalCount = await collection.countDocuments();
        console.log('总记录数: ' + totalCount);

        // 找到第一个包含热温冷比数据的记录
        const recordWithData = await collection.findOne({
            'hot_warm_cold_data': { $exists: true, $ne: null }
        });

        if (recordWithData) {
            console.log('\n找到包含数据的记录:');
            console.log('基准期: ' + recordWithData.base_issue);
            console.log('目标期: ' + recordWithData.target_issue);
            console.log('热温冷比数据示例:');
            const ratios = Object.keys(recordWithData.hot_warm_cold_data || {});
            console.log('热温冷比种类: ' + ratios.length);
            ratios.slice(0, 10).forEach(ratio => {
                const comboCount = recordWithData.hot_warm_cold_data[ratio].length;
                console.log('  ' + ratio + ': ' + comboCount + ' 个组合');
            });
        } else {
            console.log('❌ 没有找到包含热温冷比数据的记录');
        }

    } catch (error) {
        console.error('检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
    }
}

checkHWCOptimizedTable();