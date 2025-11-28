/**
 * 详细检查热温冷比优化表的2792条记录
 */

const mongoose = require('mongoose');

async function checkHWCDetails() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const HWCModel = mongoose.model('HWCDetails', DLTRedCombinationsHotWarmColdOptimizedSchema);

        const totalCount = await HWCModel.countDocuments();
        console.log(`📊 总记录数: ${totalCount}\n`);

        // 检查 is_predicted 分布
        const drawnCount = await HWCModel.countDocuments({ is_predicted: false });
        const predictedCount = await HWCModel.countDocuments({ is_predicted: true });

        console.log(`📋 记录类型分布:`);
        console.log(`   已开奖期: ${drawnCount} 条`);
        console.log(`   推算期: ${predictedCount} 条\n`);

        // 检查是否包含7001期
        const has7001AsTarget = await HWCModel.findOne({ target_issue: '7001' }).lean();
        const has7001AsBase = await HWCModel.findOne({ base_issue: '7001' }).lean();

        console.log(`🔍 期号7001检查:`);
        console.log(`   作为 target_issue: ${has7001AsTarget ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`   作为 base_issue: ${has7001AsBase ? '✅ 存在' : '❌ 不存在'}\n`);

        if (has7001AsTarget) {
            console.log(`   7001作为target_issue的记录:`);
            console.log(`      base_issue: ${has7001AsTarget.base_issue}`);
            console.log(`      target_issue: ${has7001AsTarget.target_issue}`);
            console.log(`      is_predicted: ${has7001AsTarget.is_predicted}`);
            console.log(`      插入时间: ${has7001AsTarget._id ? has7001AsTarget._id.getTimestamp().toLocaleString('zh-CN') : 'N/A'}\n`);
        }

        // 获取最小和最大的 target_issue（数值排序）
        const allRecords = await HWCModel.find({ is_predicted: false }).select('base_issue target_issue').lean();
        const targetIssues = allRecords.map(r => parseInt(r.target_issue)).sort((a, b) => a - b);

        console.log(`📋 target_issue 范围（已开奖期）:`);
        console.log(`   最小: ${targetIssues[0]}`);
        console.log(`   最大: ${targetIssues[targetIssues.length - 1]}`);
        console.log(`   数量: ${targetIssues.length}\n`);

        // 检查推算期
        const predictedRecords = await HWCModel.find({ is_predicted: true }).select('base_issue target_issue').lean();
        console.log(`📋 推算期记录:`);
        if (predictedRecords.length > 0) {
            predictedRecords.forEach(rec => {
                console.log(`   ${rec.base_issue} → ${rec.target_issue}`);
            });
        } else {
            console.log(`   无推算期记录`);
        }
        console.log('');

        // 检查是否有重复的 target_issue
        const targetIssueCounts = {};
        allRecords.forEach(r => {
            const ti = r.target_issue;
            targetIssueCounts[ti] = (targetIssueCounts[ti] || 0) + 1;
        });

        const duplicates = Object.entries(targetIssueCounts).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`⚠️  发现重复的 target_issue:`);
            duplicates.forEach(([issue, count]) => {
                console.log(`   期号 ${issue}: ${count} 条记录`);
            });
        } else {
            console.log(`✅ 没有重复的 target_issue`);
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkHWCDetails();
