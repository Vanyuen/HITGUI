#!/usr/bin/env node

const mongoose = require('mongoose');

/**
 * 生成热温冷优化表数据 - v2.1 (支持完整Schema + 增量更新)
 * 新增字段:
 * - base_id / target_id (性能优化)
 * - is_predicted (推算期标识)
 * - total_combinations (总组合数)
 * - hit_analysis (命中分析数据)
 * - created_at / updated_at (时间戳)
 *
 * 更新模式:
 * - --all: 全量更新（清空所有记录，重新生成全部数据）
 * - --incremental: 增量更新（清除推算期记录，生成最新数据+推算期）
 */
async function generateHwcOptimizedDataV2(issuePairs, forceRegenerate = false) {
    console.log(`\n🚀 开始生成热温冷优化表数据 (v2.0 - 完整Schema)...`);
    console.log(`📊 总期号对数: ${issuePairs.length}`);

    let generatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 预加载所有红球组合
    console.log('📥 预加载所有红球组合...');
    const RedCombinations = mongoose.connection.db.collection('hit_dlt_redcombinations');
    const allCombinations = await RedCombinations
        .find({})
        .project({ combination_id: 1, combination: 1 })
        .toArray();

    console.log(`✅ 加载 ${allCombinations.length} 个组合`);

    if (allCombinations.length === 0) {
        console.error('❌ 没有找到任何红球组合，无法生成热温冷比优化表');
        return;
    }

    // 预加载所有期号数据（获取ID映射）
    console.log('📥 预加载期号ID映射...');
    const DltIssues = mongoose.connection.db.collection('hit_dlts');
    const allIssues = await DltIssues
        .find({})
        .project({ Issue: 1, ID: 1, Red1: 1, Red2: 1, Red3: 1, Red4: 1, Red5: 1, Blue1: 1, Blue2: 1 })
        .toArray();

    // 构建 Issue -> ID 映射
    const issueToId = {};
    const issueData = {};
    allIssues.forEach(doc => {
        issueToId[doc.Issue] = doc.ID;
        issueData[doc.Issue] = {
            id: doc.ID,
            reds: [doc.Red1, doc.Red2, doc.Red3, doc.Red4, doc.Red5],
            blues: [doc.Blue1, doc.Blue2]
        };
    });

    console.log(`✅ 加载 ${Object.keys(issueToId).length} 个期号映射`);

    const MissingCollection = mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

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

            // 获取 base_id 和 target_id
            const base_id = issueToId[base_issue];
            const target_id = issueToId[target_issue];

            if (!base_id) {
                console.log(`  ⚠️  未找到基准期号 ${base_issue} 的ID，跳过`);
                errorCount++;
                continue;
            }

            // 判断是否为推算期（target_issue 不在已开奖数据中）
            const is_predicted = !issueData[target_issue];

            console.log(`  📊 base_id: ${base_id}, target_id: ${target_id || 'N/A'}, is_predicted: ${is_predicted}`);

            // 查询基准期的遗漏值数据
            const missingData = await MissingCollection.findOne({ Issue: base_issue });

            if (!missingData) {
                console.log(`  ⚠️  未找到期号 ${base_issue} 的遗漏值数据，跳过`);
                errorCount++;
                continue;
            }

            console.log(`  🔥 计算热温冷比...`);
            const hwcMap = {};

            // 计算所有组合的热温冷比
            for (const combo of allCombinations) {
                if (!combo.combination || !Array.isArray(combo.combination)) {
                    continue;
                }

                const ratio = calculateHotColdRatioByMissing(combo.combination, missingData);

                if (!hwcMap[ratio]) {
                    hwcMap[ratio] = [];
                }
                hwcMap[ratio].push(combo.combination_id);
            }

            const ratioCount = Object.keys(hwcMap).length;
            console.log(`  ✅ 共 ${ratioCount} 种热温冷比`);

            // 计算命中分析数据（仅当目标期已开奖时）
            let hit_analysis = null;
            if (!is_predicted && issueData[target_issue]) {
                console.log(`  🎯 计算命中分析数据...`);
                hit_analysis = await calculateHitAnalysis(
                    issueData[target_issue].reds,
                    issueData[target_issue].blues,
                    allCombinations
                );
                console.log(`  ✅ 命中分析完成`);
            }

            // 构建完整的文档
            const now = new Date();
            const document = {
                base_issue,
                target_issue,
                base_id,
                target_id: target_id || null,
                is_predicted,
                hot_warm_cold_data: hwcMap,
                total_combinations: allCombinations.length,
                hit_analysis: hit_analysis,
                created_at: now,
                updated_at: now
            };

            // 保存到数据库
            console.log(`  💾 保存到数据库...`);
            if (existing) {
                await HwcOptimized.updateOne(
                    { base_issue, target_issue },
                    {
                        $set: {
                            ...document,
                            updated_at: now
                        }
                    }
                );
            } else {
                await HwcOptimized.insertOne(document);
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
function calculateHotColdRatioByMissing(combination, missingData) {
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

// 辅助函数：计算命中分析数据
async function calculateHitAnalysis(winningReds, winningBlues, allCombinations) {
    const redHitMap = {}; // 红球命中数 -> 组合ID数组
    const blueHitMap = {}; // 蓝球命中数 -> 组合ID数组

    // 初始化 Map (红球: 0-5, 蓝球暂不处理)
    for (let i = 0; i <= 5; i++) {
        redHitMap[i] = [];
    }

    // 计算每个组合的红球命中数
    for (const combo of allCombinations) {
        if (!combo.combination || !Array.isArray(combo.combination)) {
            continue;
        }

        // 计算红球命中数
        const redHits = combo.combination.filter(ball => winningReds.includes(ball)).length;
        redHitMap[redHits].push(combo.combination_id);
    }

    return {
        target_winning_reds: winningReds,
        target_winning_blues: winningBlues,
        red_hit_data: redHitMap
    };
}

async function main() {
    try {
        // 解析命令行参数
        const args = process.argv.slice(2);
        let mode = 'recent';
        let startIssue, endIssue, recentCount = 100;
        let forceRegenerate = false;
        let enablePrediction = false;
        let incrementalMode = false;
        let incrementalRecentCount = 10; // 增量模式默认生成最近10期

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--all') {
                mode = 'all';
                enablePrediction = true; // 全量模式自动包含推算期
            } else if (args[i] === '--incremental') {
                incrementalMode = true;
                mode = 'incremental';
                enablePrediction = true; // 增量模式自动包含推算期
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

        const collection = mongoose.connection.db.collection('hit_dlts');
        const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取最新期号（用于增量模式）
        const latestIssueDoc = await collection.findOne({}, { sort: { ID: -1 }, projection: { Issue: 1 } });
        const latestIssue = latestIssueDoc ? latestIssueDoc.Issue : null;

        if (!latestIssue) {
            console.error('❌ 未找到任何期号数据');
            process.exit(1);
        }

        console.log(`📊 数据库最新期号: ${latestIssue}`);

        // 增量模式：清理推算期数据
        if (incrementalMode) {
            console.log('\n🔄 增量更新模式');
            console.log('─'.repeat(60));

            // 1. 删除所有推算期记录
            const predictedDeleteResult = await HwcOptimized.deleteMany({ is_predicted: true });
            console.log(`✅ 删除推算期记录: ${predictedDeleteResult.deletedCount} 条`);

            // 2. 删除最近N期的已开奖记录（确保数据最新）
            const recentIssues = await collection.find({})
                .project({ Issue: 1, ID: 1 })
                .sort({ ID: -1 })
                .limit(incrementalRecentCount)
                .toArray();

            if (recentIssues.length > 0) {
                const recentIssuesList = recentIssues.map(doc => doc.Issue);
                const recentDeleteResult = await HwcOptimized.deleteMany({
                    $or: [
                        { base_issue: { $in: recentIssuesList } },
                        { target_issue: { $in: recentIssuesList } }
                    ],
                    is_predicted: false
                });
                console.log(`✅ 删除最近${incrementalRecentCount}期相关记录: ${recentDeleteResult.deletedCount} 条`);
            }

            console.log('─'.repeat(60));
        }

        // 全量模式：清空所有数据
        if (mode === 'all') {
            console.log('\n🔄 全量更新模式');
            console.log('─'.repeat(60));
            const deleteResult = await HwcOptimized.deleteMany({});
            console.log(`✅ 清空优化表: ${deleteResult.deletedCount} 条记录`);
            console.log('─'.repeat(60));
        }

        // 获取期号列表
        let issues;

        if (mode === 'all') {
            console.log('\n📋 模式: 全量生成（所有期号对 + 推算期）');
            issues = await collection.find({}).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();
        } else if (mode === 'incremental') {
            console.log(`\n📋 模式: 增量生成（最近${incrementalRecentCount}期 + 推算期）`);
            issues = await collection.find({})
                .project({ Issue: 1, ID: 1 })
                .sort({ ID: -1 })
                .limit(incrementalRecentCount)
                .toArray();
            issues.reverse(); // 转为升序
        } else if (mode === 'range' && startIssue && endIssue) {
            console.log(`\n📋 模式: 生成指定范围 ${startIssue} - ${endIssue}`);
            issues = await collection.find({
                Issue: {
                    $gte: startIssue,
                    $lte: endIssue
                }
            }).project({ Issue: 1, ID: 1 }).sort({ ID: 1 }).toArray();
        } else {
            console.log(`\n📋 模式: 生成最近 ${recentCount} 期`);
            issues = await collection.find({})
                .project({ Issue: 1, ID: 1 })
                .sort({ ID: -1 })
                .limit(recentCount)
                .toArray();
            issues.reverse(); // 转为升序
        }

        if (issues.length < 1) {
            console.error('❌ 数据不足');
            process.exit(1);
        }

        console.log(`✅ 找到 ${issues.length} 期数据`);
        console.log(`   期号范围: ${issues[0].Issue} - ${issues[issues.length - 1].Issue}`);

        // 构建期号对列表
        const issuePairs = [];
        for (let i = 1; i < issues.length; i++) {
            issuePairs.push({
                base_issue: issues[i - 1].Issue,
                target_issue: issues[i].Issue
            });
        }

        // 如果启用预测，生成预测期
        if (enablePrediction && issues.length > 0) {
            const baseIssue = issues[issues.length - 1].Issue;
            const predictedIssue = String(parseInt(baseIssue) + 1);

            console.log(`🔮 生成推算期: ${baseIssue} → ${predictedIssue}`);

            issuePairs.push({
                base_issue: baseIssue,
                target_issue: predictedIssue
            });
        }

        console.log(`📊 待生成期号对数: ${issuePairs.length}`);

        // 生成优化数据
        await generateHwcOptimizedDataV2(issuePairs, forceRegenerate);

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
    generateHwcOptimizedDataV2,
    calculateHotColdRatioByMissing,
    calculateHitAnalysis
};
