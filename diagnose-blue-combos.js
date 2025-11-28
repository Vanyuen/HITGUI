/**
 * 诊断蓝球组合查询问题
 */

const mongoose = require('mongoose');

async function diagnoseBlueCombos() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const db = mongoose.connection.db;

        // 1. 查找任务结果
        const taskResults = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const result = await taskResults.findOne({
            task_id: 'hwc-pos-20251029-vvz',
            period: '25105'
        });

        if (!result) {
            console.log('❌ 未找到任务结果');
            process.exit(1);
        }

        console.log('📋 任务结果信息:');
        console.log(`   期号: ${result.period}`);
        console.log(`   蓝球组合ID数量: ${result.blue_combinations.length}`);
        console.log(`   前10个蓝球ID: ${result.blue_combinations.slice(0, 10).join(', ')}\n`);

        // 2. 检查两个集合
        const collections = ['hit_dlt_bluecombinations', 'hit_dlts'];

        for (const collName of collections) {
            console.log(`📦 检查集合: ${collName}`);
            const coll = db.collection(collName);
            const totalCount = await coll.countDocuments();
            console.log(`   总记录数: ${totalCount}`);

            if (totalCount > 0) {
                const sample = await coll.findOne({});
                console.log(`   字段列表: ${Object.keys(sample).join(', ')}`);

                // 查询匹配的记录
                const found = await coll.find({
                    combination_id: { $in: result.blue_combinations }
                }).toArray();
                console.log(`   匹配的记录数: ${found.length}`);

                if (found.length > 0) {
                    console.log(`   样本数据:`, found[0]);
                }
            }
            console.log('');
        }

        await mongoose.connection.close();
        console.log('✅ 诊断完成');

    } catch (error) {
        console.error('❌ 诊断失败:', error);
        process.exit(1);
    }
}

diagnoseBlueCombos();
