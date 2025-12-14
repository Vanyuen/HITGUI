/**
 * 检查HWC优化表数据范围
 */
const mongoose = require('mongoose');

async function checkHwcDataRange() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_Range', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== HWC优化表数据范围检查 ===\n');

    // 0. 看看一条记录的完整结构
    const sample = await HwcOptimized.findOne({}).lean();
    console.log('样本记录字段:', Object.keys(sample || {}).join(', '));
    if (sample) {
        console.log('样本 base_issue:', sample.base_issue, typeof sample.base_issue);
        console.log('样本 target_issue:', sample.target_issue, typeof sample.target_issue);
    }
    console.log('');

    // 1. 总记录数
    const totalCount = await HwcOptimized.countDocuments({});
    console.log(`总记录数: ${totalCount}`);

    // 2. 期号范围
    const minIssue = await HwcOptimized.findOne({}).sort({ target_issue: 1 }).lean();
    const maxIssue = await HwcOptimized.findOne({}).sort({ target_issue: -1 }).lean();
    console.log(`target_issue范围: ${minIssue?.target_issue || 'N/A'} ~ ${maxIssue?.target_issue || 'N/A'}`);
    console.log(`base_issue范围: ${minIssue?.base_issue || 'N/A'} ~ ${maxIssue?.base_issue || 'N/A'}`);

    // 3. 检查任务需要的期号对是否存在
    const neededPairs = [
        { base: '25041', target: '25042' }, // 第一期
        { base: '25090', target: '25091' }, // 批次1边界
        { base: '25091', target: '25092' }, // 批次2开始
        { base: '25140', target: '25141' }, // 批次2边界
        { base: '25141', target: '25142' }, // 推算期
    ];

    console.log('\n=== 检查任务需要的期号对 (使用字符串查询) ===');
    for (const pair of neededPairs) {
        const data = await HwcOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        }).lean();
        console.log(`${pair.base}→${pair.target}: ${data ? '✅ 存在' : '❌ 不存在'}`);
    }

    // 3b. 对比用数字查询
    console.log('\n=== 检查任务需要的期号对 (使用数字查询对比) ===');
    for (const pair of neededPairs) {
        const data = await HwcOptimized.findOne({
            base_issue: parseInt(pair.base),
            target_issue: parseInt(pair.target)
        }).lean();
        console.log(`${pair.base}→${pair.target}: ${data ? '✅ 存在' : '❌ 不存在'}`);
    }

    // 4. 检查现有数据覆盖的期号
    console.log('\n=== 现有数据覆盖情况 ===');
    const distinctTargets = await HwcOptimized.distinct('target_issue');
    distinctTargets.sort((a, b) => a - b);
    console.log(`数据库中有${distinctTargets.length}个不同的target_issue`);
    console.log(`范围: ${distinctTargets[0]} ~ ${distinctTargets[distinctTargets.length - 1]}`);

    // 5. 检查25042-25142范围内有多少期号有HWC数据
    const taskRange = [];
    for (let i = 25042; i <= 25142; i++) {
        taskRange.push(i);
    }
    const existingInRange = distinctTargets.filter(t => t >= 25042 && t <= 25142);
    console.log(`\n任务范围(25042-25142)内有HWC数据的期号: ${existingInRange.length}/${taskRange.length}期`);

    if (existingInRange.length < taskRange.length) {
        // 找出缺失的期号
        const missingPeriods = taskRange.filter(p => !distinctTargets.includes(p));
        console.log(`\n缺失HWC数据的期号:`);
        if (missingPeriods.length <= 20) {
            console.log(missingPeriods.join(', '));
        } else {
            console.log(`${missingPeriods.slice(0, 20).join(', ')}... (共${missingPeriods.length}期)`);
        }
    }

    // 6. 列出最近10条HWC记录
    console.log('\n=== 最近10条HWC记录 ===');
    const recentRecords = await HwcOptimized.find({})
        .sort({ target_issue: -1 })
        .limit(10)
        .select('base_issue target_issue')
        .lean();
    for (const r of recentRecords) {
        console.log(`  ${r.base_issue}→${r.target_issue}`);
    }

    await mongoose.disconnect();
}

checkHwcDataRange().catch(e => { console.error(e); process.exit(1); });
