/**
 * 检查现有热温冷比优化表的记录结构
 */

const mongoose = require('mongoose');

async function checkExistingStructure() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const HWCModel = mongoose.model('HWCCheck', DLTRedCombinationsHotWarmColdOptimizedSchema);

        const totalCount = await HWCModel.countDocuments();
        console.log(`📊 总记录数: ${totalCount}\n`);

        // 检查是否有 hit_analysis.is_drawn 字段
        const withIsDrawnCount = await HWCModel.countDocuments({ 'hit_analysis.is_drawn': true });
        console.log(`📊 有 hit_analysis.is_drawn=true 字段的记录: ${withIsDrawnCount}/${totalCount}`);

        // 检查是否有 is_predicted 字段
        const withIsPredictedCount = await HWCModel.countDocuments({ is_predicted: { $exists: true } });
        console.log(`📊 有 is_predicted 字段的记录: ${withIsPredictedCount}/${totalCount}`);

        const drawnCount = await HWCModel.countDocuments({ is_predicted: false });
        const predictedCount = await HWCModel.countDocuments({ is_predicted: true });
        console.log(`   - is_predicted=false: ${drawnCount}`);
        console.log(`   - is_predicted=true: ${predictedCount}\n`);

        // 获取一条已开奖记录的样本
        const drawnSample = await HWCModel.findOne({ is_predicted: false }).lean();
        console.log('📋 已开奖记录样本结构:');
        console.log(`   字段: ${Object.keys(drawnSample).join(', ')}`);
        console.log(`   base_issue: ${drawnSample.base_issue}`);
        console.log(`   target_issue: ${drawnSample.target_issue}`);
        console.log(`   is_predicted: ${drawnSample.is_predicted}`);
        console.log(`   有 hit_analysis 字段: ${drawnSample.hit_analysis ? '✅' : '❌'}`);
        if (drawnSample.hit_analysis) {
            console.log(`   hit_analysis 子字段: ${Object.keys(drawnSample.hit_analysis).join(', ')}`);
            console.log(`   hit_analysis.is_drawn: ${drawnSample.hit_analysis.is_drawn}`);
        }
        console.log(`   有 base_id 字段: ${drawnSample.base_id !== undefined ? '✅' : '❌'}`);
        console.log(`   有 target_id 字段: ${drawnSample.target_id !== undefined ? '✅' : '❌'}`);
        console.log(`   有 version 字段: ${drawnSample.version !== undefined ? '✅' : '❌'}\n`);

        // 使用增量逻辑的查询测试
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 测试增量逻辑查询（模拟 server.js:28934-28941）\n');

        const latestOptimizedRecord = await HWCModel
            .findOne({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .select('target_issue')
            .lean();

        console.log(`   查询结果: ${latestOptimizedRecord ? '✅ 找到记录' : '❌ 未找到记录'}`);
        if (latestOptimizedRecord) {
            console.log(`   target_issue: ${latestOptimizedRecord.target_issue}`);
        } else {
            console.log(`   ⚠️  查询返回 null，导致 latestProcessedIssue = 0`);
            console.log(`   ⚠️  这会触发处理所有已开奖期（2791期），导致重复键错误！\n`);
        }

        // 尝试替代查询（使用 is_predicted）
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 测试替代查询（使用 is_predicted=false）\n');

        const alternativeQuery = await HWCModel
            .findOne({ is_predicted: false })
            .sort({ target_issue: -1 })
            .select('target_issue')
            .lean();

        console.log(`   查询结果: ${alternativeQuery ? '✅ 找到记录' : '❌ 未找到记录'}`);
        if (alternativeQuery) {
            console.log(`   target_issue: ${alternativeQuery.target_issue}`);
        }

        // 检查是否有重复的 base_issue + target_issue 组合
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 检查是否有重复键\n');

        const duplicates = await HWCModel.aggregate([
            {
                $group: {
                    _id: { base_issue: '$base_issue', target_issue: '$target_issue' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (duplicates.length > 0) {
            console.log(`   ⚠️  发现 ${duplicates.length} 组重复键:`);
            duplicates.slice(0, 5).forEach(dup => {
                console.log(`      base_issue=${dup._id.base_issue}, target_issue=${dup._id.target_issue}, 数量=${dup.count}`);
            });
        } else {
            console.log(`   ✅ 没有重复键，所有记录的 (base_issue, target_issue) 组合唯一`);
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkExistingStructure();
