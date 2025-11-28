/**
 * 验证脚本：检查25114-25124范围的热温冷优化数据是否已生成
 *
 * 用途：确认管理中心一键更新后，数据是否正确生成
 * 运行：node verify-hwc-data-25114-25124.js
 */

const mongoose = require('mongoose');

// MongoDB连接
const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
const hit_dlts = mongoose.model('HIT_DLT_Verify', dltSchema);

const hwcOptimizedSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });
const HWCOptimized = mongoose.model('HIT_DLT_HWCOptimized_Verify', hwcOptimizedSchema);

async function verifyHWCData() {
    console.log('🔍 开始验证热温冷优化数据...\n');

    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 1. 获取25114-25124范围的所有已开奖期号（按ID排序）
        const startIssue = 25114;
        const endIssue = 25124;

        const allIssues = await hit_dlts.find({
            Issue: { $gte: startIssue, $lte: endIssue }
        }).select('Issue ID').sort({ ID: 1 }).lean();

        console.log(`📊 期号范围: ${startIssue}-${endIssue}`);
        console.log(`📊 查询到 ${allIssues.length} 期已开奖数据\n`);

        if (allIssues.length === 0) {
            console.log('❌ 数据库中没有该范围的开奖数据，请检查期号范围');
            await mongoose.disconnect();
            return;
        }

        // 2. 生成预期的期号对列表（基于ID相邻）
        const expectedPairs = [];

        // 第一个期号的上一期（ID-1）
        const firstIssue = allIssues[0];
        const previousIssue = await hit_dlts.findOne({ ID: firstIssue.ID - 1 })
            .select('Issue ID')
            .lean();

        if (previousIssue) {
            expectedPairs.push({
                base_issue: previousIssue.Issue.toString(),
                target_issue: firstIssue.Issue.toString(),
                base_id: previousIssue.ID,
                target_id: firstIssue.ID
            });
        } else {
            console.log(`⚠️  第一个期号 ${firstIssue.Issue}(ID=${firstIssue.ID}) 没有上一期(ID=${firstIssue.ID - 1})`);
        }

        // 其余期号的相邻配对
        for (let i = 1; i < allIssues.length; i++) {
            expectedPairs.push({
                base_issue: allIssues[i - 1].Issue.toString(),
                target_issue: allIssues[i].Issue.toString(),
                base_id: allIssues[i - 1].ID,
                target_id: allIssues[i].ID
            });
        }

        console.log(`📋 预期期号对数量: ${expectedPairs.length}\n`);
        console.log('预期期号对列表:');
        expectedPairs.forEach((pair, index) => {
            console.log(`  ${index + 1}. ${pair.base_issue}→${pair.target_issue} (ID ${pair.base_id}→${pair.target_id})`);
        });
        console.log('');

        // 3. 查询数据库中实际存在的期号对
        const existingPairs = await HWCOptimized.find({
            $or: expectedPairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        }).select('base_issue target_issue hot_warm_cold_data').lean();

        console.log(`✅ 数据库中已存在: ${existingPairs.length} 个期号对\n`);

        // 4. 对比分析
        const existingSet = new Set(
            existingPairs.map(p => `${p.base_issue}-${p.target_issue}`)
        );

        const missingPairs = [];
        const validPairs = [];

        for (const pair of expectedPairs) {
            const key = `${pair.base_issue}-${pair.target_issue}`;
            if (existingSet.has(key)) {
                validPairs.push(pair);
            } else {
                missingPairs.push(pair);
            }
        }

        // 5. 输出验证结果
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📊 验证结果汇总');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ 已存在数据: ${validPairs.length}/${expectedPairs.length} 个期号对`);
        console.log(`❌ 缺失数据:   ${missingPairs.length}/${expectedPairs.length} 个期号对\n`);

        if (validPairs.length > 0) {
            console.log('✅ 已生成的期号对:');
            validPairs.forEach((pair, index) => {
                console.log(`  ${index + 1}. ${pair.base_issue}→${pair.target_issue} ✅`);
            });
            console.log('');

            // 检查第一个有效期号对的数据结构
            const firstValidKey = `${validPairs[0].base_issue}-${validPairs[0].target_issue}`;
            const firstValidPair = existingPairs.find(p =>
                `${p.base_issue}-${p.target_issue}` === firstValidKey
            );

            if (firstValidPair && firstValidPair.hot_warm_cold_data) {
                const ratioCount = Object.keys(firstValidPair.hot_warm_cold_data).length;
                const firstRatio = Object.keys(firstValidPair.hot_warm_cold_data)[0];
                const firstRatioCount = firstValidPair.hot_warm_cold_data[firstRatio]?.length || 0;

                console.log('📊 数据结构验证（以第一个期号对为例）:');
                console.log(`  期号对: ${firstValidPair.base_issue}→${firstValidPair.target_issue}`);
                console.log(`  热温冷比种类: ${ratioCount} 种`);
                console.log(`  首个比例: ${firstRatio} (包含 ${firstRatioCount} 个组合ID)`);
                console.log('');
            }
        }

        if (missingPairs.length > 0) {
            console.log('❌ 缺失的期号对:');
            missingPairs.forEach((pair, index) => {
                console.log(`  ${index + 1}. ${pair.base_issue}→${pair.target_issue} ❌`);
            });
            console.log('');
            console.log('⚠️  建议操作: 请重新执行管理中心的"一键更新数据"功能');
        }

        // 6. 最终结论
        console.log('═══════════════════════════════════════════════════════════');
        if (missingPairs.length === 0) {
            console.log('🎉 验证通过！所有期号对的热温冷优化数据已生成');
            console.log('✅ 可以进行性能测试，预期Step1耗时将降至<100ms/期');
        } else {
            console.log('⚠️  验证未通过！仍有期号对数据缺失');
            console.log('📝 下一步操作：');
            console.log('   1. 重新执行管理中心的"一键更新数据"功能');
            console.log('   2. 检查控制台日志，确认数据生成过程');
            console.log('   3. 再次运行本验证脚本');
        }
        console.log('═══════════════════════════════════════════════════════════\n');

        await mongoose.disconnect();
        console.log('✅ 验证完成，MongoDB连接已关闭');

    } catch (error) {
        console.error('❌ 验证过程出错:', error.message);
        console.error('堆栈信息:', error.stack);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// 执行验证
verifyHWCData();
