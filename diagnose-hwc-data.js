/**
 * 深入检查HWC优化表数据情况
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const HwcOpt = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'HIT_DLT_RedCombinationsHotWarmColdOptimized');

    // 1. 检查HWC表总记录数
    const totalCount = await HwcOpt.countDocuments();
    console.log('=== HWC优化表概况 ===');
    console.log('总记录数:', totalCount);

    // 2. 查看最新的几条记录
    const latestRecords = await HwcOpt.find()
        .sort({ target_issue: -1 })
        .limit(10)
        .select('base_issue target_issue')
        .lean();

    console.log('\n=== 最新10条记录 ===');
    for (const r of latestRecords) {
        console.log(`  ${r.base_issue} → ${r.target_issue}`);
    }

    // 3. 检查target_issue最大值
    const maxTargetIssue = await HwcOpt.findOne()
        .sort({ target_issue: -1 })
        .select('base_issue target_issue')
        .lean();
    console.log('\n=== 最大target_issue ===');
    console.log('最大:', maxTargetIssue?.base_issue, '→', maxTargetIssue?.target_issue);

    // 4. 检查25141相关的所有记录
    const issue25141Records = await HwcOpt.find({
        $or: [
            { base_issue: '25141' },
            { target_issue: '25141' },
            { base_issue: 25141 },
            { target_issue: 25141 }
        ]
    }).select('base_issue target_issue').lean();

    console.log('\n=== 25141相关记录 ===');
    console.log('记录数:', issue25141Records.length);
    for (const r of issue25141Records) {
        console.log(`  ${r.base_issue} → ${r.target_issue}`);
    }

    // 5. 检查25140相关的所有记录
    const issue25140Records = await HwcOpt.find({
        $or: [
            { base_issue: '25140' },
            { target_issue: '25140' },
            { base_issue: 25140 },
            { target_issue: 25140 }
        ]
    }).select('base_issue target_issue').lean();

    console.log('\n=== 25140相关记录 ===');
    console.log('记录数:', issue25140Records.length);
    for (const r of issue25140Records) {
        console.log(`  ${r.base_issue} → ${r.target_issue}`);
    }

    // 6. 检查25142相关的所有记录
    const issue25142Records = await HwcOpt.find({
        $or: [
            { base_issue: '25142' },
            { target_issue: '25142' },
            { base_issue: 25142 },
            { target_issue: 25142 }
        ]
    }).select('base_issue target_issue').lean();

    console.log('\n=== 25142相关记录 ===');
    console.log('记录数:', issue25142Records.length);
    for (const r of issue25142Records) {
        console.log(`  ${r.base_issue} → ${r.target_issue}`);
    }

    await mongoose.disconnect();
}

diagnose().catch(e => { console.error(e); process.exit(1); });
