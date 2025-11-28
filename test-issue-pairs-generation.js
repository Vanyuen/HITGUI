/**
 * 测试期号对生成逻辑（降序数组适配）
 * 验证三种模式：全部历史期号、最近N期、自定义范围
 */

const mongoose = require('mongoose');

// 数据库连接
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 期号范围解析函数（模拟）
async function resolveIssueRangeInternal(rangeConfig) {
    const { rangeType, recentCount, startIssue, endIssue } = rangeConfig;

    // 获取DLT模型
    const hit_dlts = mongoose.connection.collection('hit_dlts');

    switch (rangeType) {
        case 'all': {
            // 全部历史期号 - 返回降序数组
            const allData = await hit_dlts.find({})
                .sort({ Issue: 1 })
                .project({ Issue: 1 })
                .toArray();

            if (!allData.length) {
                throw new Error('数据库无已开奖数据');
            }

            const latestAllIssue = parseInt(allData[allData.length - 1].Issue);
            const nextAllIssue = String(latestAllIssue + 1);

            const allIssues = [nextAllIssue];
            for (let i = allData.length - 1; i >= 0; i--) {
                allIssues.push(allData[i].Issue.toString());
            }

            console.log(`✅ 全部历史期号: ${allIssues.length}期（降序，推算期: ${nextAllIssue}）`);
            return allIssues;
        }

        case 'recent': {
            // 最近N期 - 返回降序数组
            const requestedCount = parseInt(recentCount) || 100;

            const recentData = await hit_dlts.find({})
                .sort({ Issue: -1 })
                .limit(requestedCount)
                .project({ Issue: 1 })
                .toArray();

            if (!recentData.length) {
                throw new Error('数据库无已开奖数据');
            }

            const latestRecentIssue = parseInt(recentData[0].Issue);
            const nextRecentIssue = String(latestRecentIssue + 1);

            const recentIssues = [nextRecentIssue];
            recentData.forEach(record => {
                recentIssues.push(record.Issue.toString());
            });

            console.log(`✅ 最近${requestedCount}期: ${recentIssues.length}期（降序，推算期: ${nextRecentIssue}）`);
            return recentIssues;
        }

        case 'custom': {
            // 自定义范围 - 返回降序数组
            if (!startIssue || !endIssue) {
                throw new Error('自定义范围需要指定起始期号和结束期号');
            }

            const normalizedStart = parseInt(startIssue);
            const normalizedEnd = parseInt(endIssue);

            if (normalizedStart > normalizedEnd) {
                throw new Error('起始期号不能大于结束期号');
            }

            // 获取最新已开奖期号
            const latestRecord = await hit_dlts.find({})
                .sort({ Issue: -1 })
                .limit(1)
                .project({ Issue: 1 })
                .toArray();

            if (!latestRecord.length) {
                throw new Error('数据库中无可用的开奖数据');
            }

            const latestIssue = parseInt(latestRecord[0].Issue);

            // 查询范围内的已开奖期号（降序）
            const actualEndIssue = Math.min(normalizedEnd, latestIssue);
            const customData = await hit_dlts.find({
                Issue: {
                    $gte: normalizedStart,
                    $lte: actualEndIssue
                }
            })
                .sort({ Issue: -1 })
                .project({ Issue: 1 })
                .toArray();

            const customIssues = customData.map(record => record.Issue.toString());

            // 如果结束期号超出已开奖，添加推算期
            if (normalizedEnd > latestIssue) {
                const nextCustomIssue = String(latestIssue + 1);
                customIssues.unshift(nextCustomIssue);
                console.log(`⚠️ 自定义范围 ${normalizedStart}-${normalizedEnd}: ${customIssues.length}期（降序，含推算期: ${nextCustomIssue}）`);
            } else {
                console.log(`✅ 自定义范围 ${normalizedStart}-${normalizedEnd}: ${customIssues.length}期（降序，全部已开奖）`);
            }

            return customIssues;
        }

        default:
            throw new Error('不支持的期号范围类型');
    }
}

// 期号对生成函数（模拟）
async function generateIssuePairsForTargets(targetIssues, latestIssue) {
    if (!targetIssues || targetIssues.length === 0) {
        return [];
    }

    console.log(`\n📊 开始生成期号对: 共 ${targetIssues.length} 个目标期号（降序输入）`);
    console.log(`   最新已开奖期号: ${latestIssue}`);
    console.log(`   期号范围: ${targetIssues[0]} ~ ${targetIssues[targetIssues.length - 1]}`);

    const hit_dlts = mongoose.connection.collection('hit_dlts');
    const pairs = [];

    // 从前往后遍历降序数组
    for (let i = 0; i < targetIssues.length; i++) {
        const targetIssue = targetIssues[i];
        const targetIssueNum = parseInt(targetIssue);
        const isPredicted = targetIssueNum > latestIssue;

        let baseIssue = null;

        if (i === targetIssues.length - 1) {
            // 最后一个目标期号：需要查找数组外的前一期
            const previousRecord = await hit_dlts.findOne(
                { Issue: { $lt: targetIssueNum } },
                { sort: { Issue: -1 }, projection: { Issue: 1 } }
            );

            if (previousRecord) {
                baseIssue = previousRecord.Issue.toString();
                console.log(`   ✅ 期号对 #${i + 1}: ${baseIssue} → ${targetIssue} (查询数据库)`);
            } else {
                console.log(`   ⚠️ 跳过目标期号 ${targetIssue}：无前置基准期`);
                continue;
            }
        } else {
            // 其他目标期号：数组中下一个元素就是基准期（ID-1规则）
            baseIssue = targetIssues[i + 1];
            console.log(`   ✅ 期号对 #${i + 1}: ${baseIssue} → ${targetIssue} ${isPredicted ? '(🔮推算)' : '(✅已开奖)'}`);
        }

        pairs.push({
            base: baseIssue,
            target: targetIssue,
            isPredicted: isPredicted
        });
    }

    console.log(`✅ 期号对生成完成: ${pairs.length} 对（从后往前顺序）`);
    if (pairs.length > 0) {
        console.log(`   第1对（最新）: ${pairs[0].base} → ${pairs[0].target}`);
        console.log(`   第${pairs.length}对（最旧）: ${pairs[pairs.length - 1].base} → ${pairs[pairs.length - 1].target}`);
    }

    return pairs;
}

// 主测试函数
async function testIssuePairsGeneration() {
    try {
        console.log('🧪 开始测试期号对生成逻辑（降序数组适配）...\n');

        // 连接数据库
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功\n');

        // 获取最新已开奖期号
        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 }, projection: { Issue: 1 } });
        const latestIssue = parseInt(latestRecord.Issue);

        console.log(`📅 最新已开奖期号: ${latestIssue}\n`);
        console.log('='.repeat(80));

        // 测试1：全部历史期号（仅显示前5对和后5对）
        console.log('\n📊 测试1: 全部历史期号');
        console.log('-'.repeat(80));
        const allIssues = await resolveIssueRangeInternal({ rangeType: 'all' });
        console.log(`   期号数: ${allIssues.length}`);
        console.log(`   数组顺序: ${allIssues[0]} (最新) → ${allIssues[allIssues.length - 1]} (最旧)`);

        const allPairs = await generateIssuePairsForTargets(allIssues.slice(0, 10), latestIssue); // 仅测试前10期
        console.log(`\n   前10对期号对:`);
        allPairs.forEach((pair, i) => {
            console.log(`     ${i + 1}. ${pair.base} → ${pair.target} ${pair.isPredicted ? '(推算)' : '(已开奖)'}`);
        });

        console.log('\n' + '='.repeat(80));

        // 测试2：最近10期
        console.log('\n📊 测试2: 最近10期');
        console.log('-'.repeat(80));
        const recentIssues = await resolveIssueRangeInternal({ rangeType: 'recent', recentCount: 10 });
        console.log(`   期号数: ${recentIssues.length}`);
        console.log(`   数组顺序: ${recentIssues[0]} (最新) → ${recentIssues[recentIssues.length - 1]} (最旧)`);

        const recentPairs = await generateIssuePairsForTargets(recentIssues, latestIssue);
        console.log(`\n   期号对列表:`);
        recentPairs.forEach((pair, i) => {
            console.log(`     ${i + 1}. ${pair.base} → ${pair.target} ${pair.isPredicted ? '(推算)' : '(已开奖)'}`);
        });

        console.log('\n' + '='.repeat(80));

        // 测试3：自定义范围（25100-25120）
        console.log('\n📊 测试3: 自定义范围 (25100-25120)');
        console.log('-'.repeat(80));
        const customIssues1 = await resolveIssueRangeInternal({
            rangeType: 'custom',
            startIssue: '25100',
            endIssue: '25120'
        });
        console.log(`   期号数: ${customIssues1.length}`);
        console.log(`   数组顺序: ${customIssues1[0]} (最新) → ${customIssues1[customIssues1.length - 1]} (最旧)`);

        const customPairs1 = await generateIssuePairsForTargets(customIssues1, latestIssue);
        console.log(`\n   前5对期号对:`);
        customPairs1.slice(0, 5).forEach((pair, i) => {
            console.log(`     ${i + 1}. ${pair.base} → ${pair.target} ${pair.isPredicted ? '(推算)' : '(已开奖)'}`);
        });
        console.log(`   ...`);
        console.log(`   后5对期号对:`);
        customPairs1.slice(-5).forEach((pair, i) => {
            console.log(`     ${customPairs1.length - 4 + i}. ${pair.base} → ${pair.target} ${pair.isPredicted ? '(推算)' : '(已开奖)'}`);
        });

        console.log('\n' + '='.repeat(80));

        // 测试4：自定义范围超出已开奖（25100-25130）
        console.log('\n📊 测试4: 自定义范围超出已开奖 (25100-25130)');
        console.log('-'.repeat(80));
        const customIssues2 = await resolveIssueRangeInternal({
            rangeType: 'custom',
            startIssue: '25100',
            endIssue: '25130'
        });
        console.log(`   期号数: ${customIssues2.length}`);
        console.log(`   数组顺序: ${customIssues2[0]} (最新) → ${customIssues2[customIssues2.length - 1]} (最旧)`);

        const customPairs2 = await generateIssuePairsForTargets(customIssues2, latestIssue);
        console.log(`\n   前5对期号对:`);
        customPairs2.slice(0, 5).forEach((pair, i) => {
            console.log(`     ${i + 1}. ${pair.base} → ${pair.target} ${pair.isPredicted ? '(推算)' : '(已开奖)'}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ 所有测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ 数据库连接已关闭');
        process.exit(0);
    }
}

// 运行测试
testIssuePairsGeneration();
