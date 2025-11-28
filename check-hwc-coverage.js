/**
 * 详细检查热温冷比优化表的期号覆盖情况
 */

const mongoose = require('mongoose');

async function checkHWCCoverage() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const HWCModel = mongoose.model('HWCCoverage', DLTRedCombinationsHotWarmColdOptimizedSchema);

        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_coverage', hit_dltsSchema);

        // 统计信息
        const hwcCount = await HWCModel.countDocuments();
        const dltCount = await hit_dlts.countDocuments();

        console.log(`📊 表记录数对比:`);
        console.log(`   hit_dlts: ${dltCount} 期`);
        console.log(`   热温冷比优化表: ${hwcCount} 条`);
        console.log(`   差异: ${dltCount - hwcCount} 条\n`);

        // 获取热温冷比优化表的期号范围
        const hwcMin = await HWCModel.findOne({ is_predicted: false }).sort({ target_issue: 1 }).select('base_issue target_issue').lean();
        const hwcMax = await HWCModel.findOne({ is_predicted: false }).sort({ target_issue: -1 }).select('base_issue target_issue').lean();

        console.log(`📋 热温冷比优化表期号范围:`);
        console.log(`   最小: ${hwcMin.base_issue}→${hwcMin.target_issue}`);
        console.log(`   最大: ${hwcMax.base_issue}→${hwcMax.target_issue}\n`);

        // 获取hit_dlts的期号范围
        const dltMin = await hit_dlts.findOne({}).sort({ Issue: 1 }).select('Issue').lean();
        const dltMax = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('Issue').lean();

        console.log(`📋 hit_dlts期号范围:`);
        console.log(`   最小: ${dltMin.Issue}`);
        console.log(`   最大: ${dltMax.Issue}\n`);

        // 检查缺失的期号
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 检查缺失的期号范围\n`);

        // 获取所有hit_dlts的期号
        const allDltIssues = await hit_dlts.find({}).sort({ Issue: 1 }).select('Issue').lean();
        const allDltIssueSet = new Set(allDltIssues.map(r => String(r.Issue)));

        // 获取所有热温冷比优化表的target_issue
        const allHwcTargets = await HWCModel.find({ is_predicted: false }).select('target_issue').lean();
        const allHwcTargetSet = new Set(allHwcTargets.map(r => String(r.target_issue)));

        // 找出缺失的期号
        const missingIssues = [];
        for (const issue of allDltIssueSet) {
            if (!allHwcTargetSet.has(issue)) {
                missingIssues.push(parseInt(issue));
            }
        }

        missingIssues.sort((a, b) => a - b);

        console.log(`   缺失期号数量: ${missingIssues.length}`);
        if (missingIssues.length > 0) {
            console.log(`   缺失期号范围:`);

            // 分组显示连续缺失范围
            let rangeStart = missingIssues[0];
            let rangeEnd = missingIssues[0];

            for (let i = 1; i <= missingIssues.length; i++) {
                if (i === missingIssues.length || missingIssues[i] !== rangeEnd + 1) {
                    if (rangeStart === rangeEnd) {
                        console.log(`      ${rangeStart}`);
                    } else {
                        console.log(`      ${rangeStart} - ${rangeEnd} (共${rangeEnd - rangeStart + 1}期)`);
                    }
                    if (i < missingIssues.length) {
                        rangeStart = missingIssues[i];
                        rangeEnd = missingIssues[i];
                    }
                } else {
                    rangeEnd = missingIssues[i];
                }
            }
        }

        // 检查是否有重复
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 检查已存在的期号（用于重复键检测）\n`);

        // 检查10073→10074是否存在
        const exists10074 = await HWCModel.findOne({
            base_issue: '10073',
            target_issue: '10074'
        }).lean();

        console.log(`   base_issue=10073, target_issue=10074: ${exists10074 ? '✅ 已存在' : '❌ 不存在'}`);

        if (exists10074) {
            console.log(`      _id: ${exists10074._id}`);
            console.log(`      is_predicted: ${exists10074.is_predicted}`);
            console.log(`      插入时间: ${exists10074._id.getTimestamp().toLocaleString('zh-CN')}`);
        }

        // 检查period 10074-10080
        console.log(`\n   检查期号10074-10080范围:`);
        const period10074_10080 = await HWCModel.find({
            target_issue: { $gte: '10074', $lte: '10080' }
        }).sort({ target_issue: 1 }).select('base_issue target_issue is_predicted').lean();

        period10074_10080.forEach(record => {
            console.log(`      ${record.base_issue}→${record.target_issue}, is_predicted=${record.is_predicted}`);
        });

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkHWCCoverage();
