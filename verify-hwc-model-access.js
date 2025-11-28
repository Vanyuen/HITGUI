/**
 * 验证Mongoose模型是否能正确访问热温冷比优化表
 */

const mongoose = require('mongoose');

async function verifyModelAccess() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        // ========== 1. 直接查询集合（底层API）==========
        console.log('========== 1. 直接查询集合 ==========\n');
        const db = mongoose.connection.db;

        const lowerCount = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();
        console.log(`hit_dlt_redcombinationshotwarmcoldoptimizeds: ${lowerCount.toLocaleString()} 条`);

        if (lowerCount > 0) {
            const sample = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({});
            console.log('\n样本数据字段:', Object.keys(sample));
            console.log('base_issue:', sample.base_issue);
            console.log('target_issue:', sample.target_issue);
        }

        // ========== 2. 使用Mongoose模型查询 ==========
        console.log('\n========== 2. 使用Mongoose模型查询 ==========\n');

        // 定义Schema（与server.js中相同）
        const schema = new mongoose.Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            hot_warm_cold_data: {
                type: Map,
                of: [Number]
            }
        });

        // 创建模型（与server.js中相同的模型名）
        const Model = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', schema);

        // 查询记录数
        const modelCount = await Model.countDocuments();
        console.log(`通过Mongoose模型查询: ${modelCount.toLocaleString()} 条`);

        if (modelCount > 0) {
            const modelSample = await Model.findOne({}).lean();
            console.log('\n通过模型查询的样本数据:');
            console.log('base_issue:', modelSample.base_issue);
            console.log('target_issue:', modelSample.target_issue);
            console.log('hot_warm_cold_data类型:', typeof modelSample.hot_warm_cold_data);
            console.log('hot_warm_cold_data是Map?', modelSample.hot_warm_cold_data instanceof Map);

            // 检查25119-25124的数据
            console.log('\n========== 3. 查询最新期号数据 ==========\n');
            const recentData = await Model.find({
                target_issue: { $gte: '25119', $lte: '25124' }
            }).lean();

            console.log(`找到${recentData.length}条记录:`);
            recentData.forEach(d => {
                console.log(`  ${d.base_issue} → ${d.target_issue}`);
            });

            // 检查25114-25118的数据
            console.log('\n========== 4. 查询任务期号范围数据 (25114-25118) ==========\n');
            const taskData = await Model.find({
                $or: [
                    { base_issue: '25114', target_issue: '25114' },
                    { base_issue: '25114', target_issue: '25115' },
                    { base_issue: '25115', target_issue: '25116' },
                    { base_issue: '25116', target_issue: '25117' },
                    { base_issue: '25117', target_issue: '25118' },
                    { base_issue: '25118', target_issue: '25119' }
                ]
            }).lean();

            console.log(`找到${taskData.length}条记录:`);
            taskData.forEach(d => {
                console.log(`  ${d.base_issue} → ${d.target_issue}`);
            });

            if (taskData.length === 0) {
                console.log('⚠️ 未找到任何记录！这就是为什么fallback到动态计算');
            }
        }

        // ========== 5. 检查集合名称映射 ==========
        console.log('\n========== 5. 检查Mongoose集合名称映射 ==========\n');
        console.log('模型名称:', Model.modelName);
        console.log('实际集合名称:', Model.collection.name);
        console.log('预期集合名称: hit_dlt_redcombinationshotwarmcoldoptimizeds');
        console.log('名称匹配?', Model.collection.name === 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

        await mongoose.disconnect();
        console.log('\n🔌 已断开MongoDB连接');

    } catch (error) {
        console.error('❌ 验证失败:', error);
        await mongoose.disconnect();
    }
}

verifyModelAccess();
