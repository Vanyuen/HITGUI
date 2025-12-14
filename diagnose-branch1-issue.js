/**
 * 诊断Branch 1修复后仍然失败的原因
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 1. 检查最新任务结果
    const TaskResult = mongoose.model('PredictionTaskResult', new mongoose.Schema({}, { strict: false }), 'PredictionTaskResult');
    const results = await TaskResult.find({ task_id: 'hwc-pos-20251212-l15' }).lean();

    console.log('=== 任务结果分析 ===');
    console.log('总期数:', results.length);

    for (const r of results) {
        console.log(`\n期号 ${r.target_issue}:`);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  combination_count:', r.combination_count);
        console.log('  base_issue:', r.base_issue);
        if (r.combinations) {
            console.log('  combinations数组长度:', r.combinations.length);
        }
    }

    // 2. 检查数据库最大期号
    const HitDlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    const maxIssue = await HitDlts.findOne().sort({ Issue: -1 }).select('Issue ID').lean();
    console.log('\n=== 数据库最大期号 ===');
    console.log('最大期号:', maxIssue?.Issue, 'ID:', maxIssue?.ID);

    // 3. 检查HWC优化表数据
    const HwcOpt = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'HIT_DLT_RedCombinationsHotWarmColdOptimized');

    // 检查25141-25142的数据
    const hwcData = await HwcOpt.findOne({
        base_issue: '25141',
        target_issue: '25142'
    }).lean();

    console.log('\n=== HWC优化表 25141-25142 ===');
    if (hwcData) {
        console.log('存在！');
        if (hwcData.ratio_counts) {
            const ratios = Object.keys(hwcData.ratio_counts);
            console.log('  ratio类型数量:', ratios.length);
            for (const ratio of ratios.slice(0, 5)) {
                const count = hwcData.ratio_counts[ratio]?.length || 0;
                console.log(`  ${ratio}: ${count}个组合`);
            }
        }
    } else {
        console.log('不存在！');
    }

    // 4. 检查任务配置
    const Task = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false }), 'PredictionTask');
    const task = await Task.findOne({ task_id: 'hwc-pos-20251212-l15' }).lean();

    console.log('\n=== 任务配置 ===');
    if (task) {
        console.log('task_id:', task.task_id);
        console.log('task_type:', task.task_type);
        console.log('issue_range:', JSON.stringify(task.issue_range));
        console.log('exclude_conditions:', JSON.stringify(task.exclude_conditions, null, 2));
        if (task.hwc_positive_ratios) {
            console.log('hwc_positive_ratios:', task.hwc_positive_ratios);
        }
    }

    await mongoose.disconnect();
}

diagnose().catch(e => { console.error(e); process.exit(1); });
