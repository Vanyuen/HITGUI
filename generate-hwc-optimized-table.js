#!/usr/bin/env node

const mongoose = require('mongoose');
const _ = require('lodash');

async function generateHwcOptimizedData(issuePairs, forceRegenerate = false) {
    console.log(`\n🚀 开始生成热温冷优化表数据...`);
    console.log(`📊 总期号对数: ${issuePairs.length}`);

    let generatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 加载所有红球组合（提前加载以减少重复查询）
    console.log('📥 预加载所有红球组合...');
    const allCombinations = await mongoose.connection.db.collection('hit_dlt_redcombinations')
        .find({})
        .project({ combination_id: 1, combination: 1 })
        .toArray();

    console.log(`✅ 加载 ${allCombinations.length} 个组合`);

    if (allCombinations.length === 0) {
        console.error('❌ 没有找到任何红球组合，无法生成热温冷比优化表');
        return;
    }

    const MissingCollection = mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');  // 修复: 使用小写复数形式，与服务端一致

    for (let i = 0; i < issuePairs.length; i++) {
        const { base_issue, target_issue } = issuePairs[i];
        const progress = ((i + 1) / issuePairs.length * 100).toFixed(1);

        console.log(`\n[${i + 1}/${issuePairs.length}] (${progress}%) 处理期号对: ${base_issue} → ${target_issue}`);

        try {
            // 检查是否已存在
            const existing = forceRegenerate ? null : await HwcOptimized.findOne({
                base_issue,
                target_issue
            });

            if (existing && !forceRegenerate) {
                console.log(`  ⏭️  已存在，跳过`);
                skippedCount++;
                continue;
            }

            // 查询基准期的遗漏值数据
            const missingData = await MissingCollection.findOne({ Issue: base_issue });

            if (!missingData) {
                console.log(`  ⚠️  未找到期号 ${base_issue} 的遗漏值数据，跳过`);
                errorCount++;
                continue;
            }

            console.log(`  🔥 计算热温冷比...`);
            const hwcMap = {};

            // 检查所有组合的热温冷比
            for (const combo of allCombinations) {
                if (!combo.combination || !Array.isArray(combo.combination)) {
                    console.warn('  ⚠️ 无效组合，跳过');
                    continue;
                }

                const ratio = await calculateHotColdRatioByMissing(combo.combination, missingData);

                // 确保每个ratio下都有数组
                if (!hwcMap[ratio]) {
                    hwcMap[ratio] = [];
                }
                hwcMap[ratio].push(combo.combination_id);
            }

            const ratioCount = Object.keys(hwcMap).length;
            console.log(`  ✅ 共 ${ratioCount} 种热温冷比`);

            // 打印每种比例的数量
            Object.keys(hwcMap).sort().forEach(ratio => {
                console.log(`     ${ratio}: ${hwcMap[ratio].length} 个组合`);
            });

            // 保存到数据库
            console.log(`  💾 保存到数据库...`);
            if (existing) {
                await HwcOptimized.updateOne(
                    { base_issue, target_issue },
                    { $set: {
                        hot_warm_cold_data: hwcMap || {}, // 确保总是有对象
                        generated_at: new Date(),
                        combination_count: allCombinations.length
                    }}
                );
            } else {
                await HwcOptimized.insertOne({
                    base_issue,
                    target_issue,
                    hot_warm_cold_data: hwcMap || {}, // 确保总是有对象
                    generated_at: new Date(),
                    combination_count: allCombinations.length
                });
            }

            console.log(`  ✅ 生成成功！`);
            generatedCount++;

        } catch (error) {
            console.error(`  ❌ 生成失败: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n✅ 生成完成！`);
    console.log(`   - 成功生成: ${generatedCount} 个期号对`);
    console.log(`   - 跳过已存在: ${skippedCount} 个期号对`);
    console.log(`   - 错误数量: ${errorCount} 个期号对`);

    if (errorCount > 0) {
        console.warn('⚠️ 部分期号对生成失败，请检查日志');
    }

    return {
        generatedCount,
        skippedCount,
        errorCount
    };
}

// 辅助函数：根据遗漏值计算热温冷比
async function calculateHotColdRatioByMissing(combination, missingData) {
    let hot = 0, warm = 0, cold = 0;

    combination.forEach(ball => {
        const ballKey = typeof ball === 'number' ? ball.toString() : ball;
        const missing = parseInt(missingData[ballKey] || 0, 10);

        if (missing <= 4) hot++;
        else if (missing >= 5 && missing <= 9) warm++;
        else cold++;
    });

    return `${hot}:${warm}:${cold}`;
}

async function main() {
    try {
        // 解析命令行参数
        const args = process.argv.slice(2);
        let mode = 'recent';
        let startIssue, endIssue, recentCount = 100;
        let forceRegenerate = false;
        let enablePrediction = false;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--all') {
                mode = 'all';
            } else if (args[i] === '--recent' && args[i + 1]) {
                mode = 'recent';
                recentCount = parseInt(args[i + 1]);
                i++;
            } else if (args[i] === '--start' && args[i + 1]) {
                mode = 'range';
                startIssue = args[i + 1];
                i++;
            } else if (args[i] === '--end' && args[i + 1]) {
                endIssue = args[i + 1];
                i++;
            } else if (args[i] === '--force') {
                forceRegenerate = true;
            } else if (args[i] === '--predict') {
                enablePrediction = true;
            }
        }

        // 连接数据库
        console.log('📡 连接数据库...');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功\n');

        // 获取期号列表
        let issues;
        const collection = mongoose.connection.db.collection('hit_dlts');

        if (mode === 'all') {
            console.log('📋 模式: 生成所有期号对');
            issues = await collection.find({}).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();
        } else if (mode === 'range' && startIssue && endIssue) {
            console.log(`📋 模式: 生成指定范围 ${startIssue} - ${endIssue}`);
            issues = await collection.find({
                Issue: {
                    $gte: startIssue,
                    $lte: endIssue
                }
            }).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();
        } else {
            console.log(`📋 模式: 生成最近 ${recentCount} 期`);
            issues = await collection.find({})
                .project({ Issue: 1, ID: 1 })
                .sort({ ID: -1 })
                .limit(recentCount)
                .toArray();
            issues.reverse(); // 转为升序
        }

        if (issues.length < 2) {
            console.error('❌ 数据不足，至少需要2期数据');
            process.exit(1);
        }

        console.log(`✅ 找到 ${issues.length} 期数据`);
        console.log(`   期号范围: ${issues[0].Issue} - ${issues[issues.length - 1].Issue}`);

        // 构建期号对列表
        const issuePairs = [];
        for (let i = 1; i < issues.length; i++) {
            issuePairs.push({
                base_issue: issues[i - 1].Issue,  // 前一期作为基准
                target_issue: issues[i].Issue      // 当前期作为目标
            });
        }

        // 如果启用预测且没有下一期，生成预测期
        if (enablePrediction && issues.length > 0) {
            const latestIssue = issues[issues.length - 1].Issue;
            const predictedIssue = (parseInt(latestIssue) + 1).toString();

            console.log(`🔮 启用预测模式，预测期号: ${predictedIssue}`);

            issuePairs.push({
                base_issue: latestIssue,     // 最后一期作为基准
                target_issue: predictedIssue // 推算的下一期作为目标
            });
        }

        console.log(`📊 生成 ${issuePairs.length} 个期号对`);

        // 生成优化数据
        await generateHwcOptimizedData(issuePairs, forceRegenerate);

        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('\n🎉 任务完成！');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

// 在文件末尾添加
if (require.main === module) {
    main();
}

module.exports = {
    generateHwcOptimizedData,
    calculateHotColdRatioByMissing
};