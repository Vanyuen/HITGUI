/**
 * 测试exclusion_chain功能
 * 验证排除条件执行链是否正确记录
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 连接MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';

async function testExclusionChain() {
    try {
        console.log('🔗 连接MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB连接成功\n');

        // 定义Schema（与server.js保持一致）
        const predictionTaskResultSchema = new mongoose.Schema({
            result_id: String,
            task_id: String,
            period: Number,
            red_combinations: [Number],
            blue_combinations: [Number],
            combination_count: Number,
            winning_numbers: Object,
            hit_analysis: Object,
            conflict_data: Object,
            cooccurrence_perball_data: Object,
            cooccurrence_byissues_data: Object,
            exclusion_chain: [{
                step: Number,
                condition: String,
                config: Object,
                excluded_combination_ids: [Number],
                excluded_count: Number,
                combinations_before: Number,
                combinations_after: Number,
                execution_time_ms: Number
            }],
            created_at: Date
        });

        const PredictionTaskResult = mongoose.model('HIT_DLT_PredictionTaskResult', predictionTaskResultSchema);

        // 查询最新的一条Result记录
        console.log('📊 查询最新的PredictionTaskResult记录...');
        const latestResult = await PredictionTaskResult.findOne()
            .sort({ created_at: -1 })
            .lean();

        if (!latestResult) {
            console.log('⚠️  未找到任何PredictionTaskResult记录');
            console.log('💡 请先创建一个预测任务以测试exclusion_chain功能');
            return;
        }

        console.log(`\n✅ 找到最新记录:`);
        console.log(`   任务ID: ${latestResult.task_id}`);
        console.log(`   期号: ${latestResult.period}`);
        console.log(`   创建时间: ${latestResult.created_at}`);

        // 检查exclusion_chain字段
        console.log(`\n📋 Exclusion Chain 信息:`);
        if (!latestResult.exclusion_chain || latestResult.exclusion_chain.length === 0) {
            console.log('   ❌ exclusion_chain字段为空');
            console.log('   💡 可能原因:');
            console.log('      1. 该记录是旧数据（在功能实施之前创建）');
            console.log('      2. 该期没有应用任何排除条件');
            console.log('      3. 服务器代码未正确执行');
        } else {
            console.log(`   ✅ exclusion_chain包含${latestResult.exclusion_chain.length}个步骤\n`);

            // 打印每个步骤的详细信息
            latestResult.exclusion_chain.forEach((step, index) => {
                console.log(`   步骤 ${step.step}: ${step.condition}`);
                console.log(`      - 排除组合数: ${step.excluded_count}`);
                console.log(`      - 排除前: ${step.combinations_before} 个组合`);
                console.log(`      - 排除后: ${step.combinations_after} 个组合`);
                console.log(`      - 执行耗时: ${step.execution_time_ms}ms`);
                if (step.config) {
                    console.log(`      - 配置: ${JSON.stringify(step.config).substring(0, 100)}...`);
                }
                console.log('');
            });

            // 统计信息
            const totalExcluded = latestResult.exclusion_chain.reduce((sum, step) => sum + step.excluded_count, 0);
            const totalTime = latestResult.exclusion_chain.reduce((sum, step) => sum + step.execution_time_ms, 0);

            console.log(`   📊 总计:`);
            console.log(`      - 总排除数: ${totalExcluded} 个组合`);
            console.log(`      - 总耗时: ${totalTime}ms`);
            console.log(`      - 最终剩余: ${latestResult.combination_count} 个组合`);
        }

        // 验证数据一致性
        if (latestResult.exclusion_chain && latestResult.exclusion_chain.length > 0) {
            const lastStep = latestResult.exclusion_chain[latestResult.exclusion_chain.length - 1];
            const redCombinationsCount = latestResult.red_combinations ? latestResult.red_combinations.length : 0;

            console.log(`\n🔍 数据一致性检查:`);
            console.log(`   最后一步的combinations_after: ${lastStep.combinations_after}`);
            console.log(`   red_combinations数组长度: ${redCombinationsCount}`);

            if (Math.abs(lastStep.combinations_after - redCombinationsCount) <= 100) {
                console.log(`   ✅ 数据一致性良好 (差异在100以内，可能是组合模式限制)`);
            } else {
                console.log(`   ⚠️  数据不一致，差异: ${Math.abs(lastStep.combinations_after - redCombinationsCount)}`);
            }
        }

        console.log('\n✅ 测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔗 MongoDB连接已关闭');
    }
}

// 运行测试
testExclusionChain();
