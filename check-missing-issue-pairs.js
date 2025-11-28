/**
 * 检查用户日志中提到的缺失期号对
 */

const mongoose = require('mongoose');

async function checkMissingPairs() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const schema = new mongoose.Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            hot_warm_cold_data: { type: Map, of: [Number] }
        });

        const Model = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', schema);

        // 从用户日志中提取的期号对（注意：都是同期配对！）
        const userLogPairs = [
            { base: '25114', target: '25114' },
            { base: '25115', target: '25115' },
            { base: '25116', target: '25116' },
            { base: '25117', target: '25117' },
            { base: '25118', target: '25118' },
            { base: '25119', target: '25119' },
            { base: '25120', target: '25120' },
            { base: '25121', target: '25121' },
            { base: '25122', target: '25122' },
            { base: '25123', target: '25123' },
            { base: '25124', target: '25124' }
        ];

        console.log('========== 检查用户任务使用的期号对（同期配对）==========\n');

        for (const pair of userLogPairs) {
            const exists = await Model.findOne({
                base_issue: pair.base,
                target_issue: pair.target
            }).lean();

            if (exists) {
                console.log(`✅ ${pair.base}→${pair.target}: 存在`);
            } else {
                console.log(`❌ ${pair.base}→${pair.target}: 缺失 ⚠️`);
            }
        }

        // 再检查一下数据库中实际存在的25114-25124范围的期号对
        console.log('\n========== 数据库中实际存在的25114-25124范围期号对 ==========\n');
        const allPairs = await Model.find({
            $or: [
                { base_issue: { $gte: '25114', $lte: '25124' } },
                { target_issue: { $gte: '25114', $lte: '25124' } }
            ]
        }).select('base_issue target_issue').lean();

        console.log(`共找到 ${allPairs.length} 条记录:\n`);
        allPairs.forEach(p => {
            console.log(`  ${p.base_issue} → ${p.target_issue}`);
        });

        // 分析配对模式
        console.log('\n========== 配对模式分析 ==========\n');
        const samePairs = allPairs.filter(p => p.base_issue === p.target_issue);
        const adjacentPairs = allPairs.filter(p => {
            const base = parseInt(p.base_issue);
            const target = parseInt(p.target_issue);
            return target === base + 1;
        });

        console.log(`同期配对（base=target）: ${samePairs.length} 条`);
        if (samePairs.length > 0) {
            samePairs.forEach(p => console.log(`  ${p.base_issue}→${p.target_issue}`));
        }

        console.log(`\n相邻期配对（target=base+1）: ${adjacentPairs.length} 条`);
        if (adjacentPairs.length > 0) {
            adjacentPairs.forEach(p => console.log(`  ${p.base_issue}→${p.target_issue}`));
        }

        await mongoose.disconnect();
        console.log('\n🔌 已断开MongoDB连接');

    } catch (error) {
        console.error('❌ 检查失败:', error);
        await mongoose.disconnect();
    }
}

checkMissingPairs();
