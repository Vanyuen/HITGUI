/**
 * 命中分析计算方法对比验证脚本
 * 对比原方法（笛卡尔积）vs 优化方法（计数算法）
 */

// 模拟数据
const actualRed = [3, 7, 12, 23, 28];  // 实际开奖红球
const actualBlue = [5, 11];             // 实际开奖蓝球

// 生成测试用的预测组合
function generateTestCombinations() {
    // 红球组合示例（生成1000个随机组合）
    const redCombinations = [];
    for (let i = 0; i < 1000; i++) {
        const combo = [];
        const available = Array.from({ length: 35 }, (_, i) => i + 1);
        for (let j = 0; j < 5; j++) {
            const idx = Math.floor(Math.random() * available.length);
            combo.push(available.splice(idx, 1)[0]);
        }
        redCombinations.push(combo.sort((a, b) => a - b));
    }

    // 蓝球组合示例（生成66个标准组合）
    const blueCombinations = [];
    for (let i = 1; i <= 12; i++) {
        for (let j = i + 1; j <= 12; j++) {
            blueCombinations.push([i, j]);
        }
    }

    return { redCombinations, blueCombinations };
}

// 计算命中数
function countHits(combination, actual) {
    return combination.filter(num => actual.includes(num)).length;
}

// === 方法1: 原方法（笛卡尔积嵌套循环）===
function calculateByCartesianProduct(redCombinations, blueCombinations) {
    console.log('\n📊 方法1: 笛卡尔积嵌套循环');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // 步骤1: 计算红球命中
    const redHits = redCombinations.map(combo => ({
        combination: combo,
        hits: countHits(combo, actualRed)
    }));

    // 步骤2: 计算蓝球命中
    const blueHits = blueCombinations.map(combo => ({
        combination: combo,
        hits: countHits(combo, actualBlue)
    }));

    // 步骤3: 嵌套循环计算奖项
    const prizeStats = {
        first_prize: { count: 0, amount: 0 },
        second_prize: { count: 0, amount: 0 },
        third_prize: { count: 0, amount: 0 },
        fourth_prize: { count: 0, amount: 0 },
        fifth_prize: { count: 0, amount: 0 },
        sixth_prize: { count: 0, amount: 0 },
        seventh_prize: { count: 0, amount: 0 },
        eighth_prize: { count: 0, amount: 0 },
        ninth_prize: { count: 0, amount: 0 }
    };

    const FIXED_PRIZES = {
        first: 10000000,
        second: 100000,
        third: 10000,
        fourth: 3000,
        fifth: 300,
        sixth: 200,
        seventh: 100,
        eighth: 15,
        ninth: 5
    };

    let loopCount = 0;
    for (const redHit of redHits) {
        for (const blueHit of blueHits) {
            loopCount++;
            const r = redHit.hits;
            const b = blueHit.hits;

            if (r === 5 && b === 2) {
                prizeStats.first_prize.count++;
                prizeStats.first_prize.amount += FIXED_PRIZES.first;
            } else if (r === 5 && b === 1) {
                prizeStats.second_prize.count++;
                prizeStats.second_prize.amount += FIXED_PRIZES.second;
            } else if (r === 5 && b === 0) {
                prizeStats.third_prize.count++;
                prizeStats.third_prize.amount += FIXED_PRIZES.third;
            } else if (r === 4 && b === 2) {
                prizeStats.fourth_prize.count++;
                prizeStats.fourth_prize.amount += FIXED_PRIZES.fourth;
            } else if ((r === 4 && b === 1) || (r === 3 && b === 2)) {
                prizeStats.fifth_prize.count++;
                prizeStats.fifth_prize.amount += FIXED_PRIZES.fifth;
            } else if ((r === 4 && b === 0) || (r === 3 && b === 1) || (r === 2 && b === 2)) {
                prizeStats.sixth_prize.count++;
                prizeStats.sixth_prize.amount += FIXED_PRIZES.sixth;
            } else if ((r === 3 && b === 0) || (r === 2 && b === 1) || (r === 1 && b === 2)) {
                prizeStats.seventh_prize.count++;
                prizeStats.seventh_prize.amount += FIXED_PRIZES.seventh;
            } else if ((r === 2 && b === 0) || (r === 1 && b === 1) || (r === 0 && b === 2)) {
                prizeStats.eighth_prize.count++;
                prizeStats.eighth_prize.amount += FIXED_PRIZES.eighth;
            } else if ((r === 1 && b === 0) || (r === 0 && b === 1)) {
                prizeStats.ninth_prize.count++;
                prizeStats.ninth_prize.amount += FIXED_PRIZES.ninth;
            }
        }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`⏱️  耗时: ${duration}ms`);
    console.log(`🔄 循环次数: ${loopCount.toLocaleString()}次`);
    console.log(`📈 时间复杂度: O(R × B) = O(${redCombinations.length} × ${blueCombinations.length})`);

    return { prizeStats, duration, loopCount };
}

// === 方法2: 优化方法（命中分布计数）===
function calculateByOptimizedCount(redCombinations, blueCombinations) {
    console.log('\n🚀 方法2: 优化计数算法');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // 步骤1: 统计红球命中分布 O(R)
    const redDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
    for (const combo of redCombinations) {
        const hits = countHits(combo, actualRed);
        redDistribution[hits]++;
    }

    // 步骤2: 统计蓝球命中分布 O(B)
    const blueDistribution = { 2: 0, 1: 0, 0: 0 };
    for (const combo of blueCombinations) {
        const hits = countHits(combo, actualBlue);
        blueDistribution[hits]++;
    }

    // 步骤3: 数学计算奖项 O(1)
    const R5 = redDistribution[5];
    const R4 = redDistribution[4];
    const R3 = redDistribution[3];
    const R2 = redDistribution[2];
    const R1 = redDistribution[1];
    const R0 = redDistribution[0];

    const B2 = blueDistribution[2];
    const B1 = blueDistribution[1];
    const B0 = blueDistribution[0];

    const FIXED_PRIZES = {
        first: 10000000,
        second: 100000,
        third: 10000,
        fourth: 3000,
        fifth: 300,
        sixth: 200,
        seventh: 100,
        eighth: 15,
        ninth: 5
    };

    const prizeStats = {
        first_prize: {
            count: R5 * B2,
            amount: (R5 * B2) * FIXED_PRIZES.first
        },
        second_prize: {
            count: R5 * B1,
            amount: (R5 * B1) * FIXED_PRIZES.second
        },
        third_prize: {
            count: R5 * B0,
            amount: (R5 * B0) * FIXED_PRIZES.third
        },
        fourth_prize: {
            count: R4 * B2,
            amount: (R4 * B2) * FIXED_PRIZES.fourth
        },
        fifth_prize: {
            count: (R4 * B1) + (R3 * B2),
            amount: ((R4 * B1) + (R3 * B2)) * FIXED_PRIZES.fifth
        },
        sixth_prize: {
            count: (R4 * B0) + (R3 * B1) + (R2 * B2),
            amount: ((R4 * B0) + (R3 * B1) + (R2 * B2)) * FIXED_PRIZES.sixth
        },
        seventh_prize: {
            count: (R3 * B0) + (R2 * B1) + (R1 * B2),
            amount: ((R3 * B0) + (R2 * B1) + (R1 * B2)) * FIXED_PRIZES.seventh
        },
        eighth_prize: {
            count: (R2 * B0) + (R1 * B1) + (R0 * B2),
            amount: ((R2 * B0) + (R1 * B1) + (R0 * B2)) * FIXED_PRIZES.eighth
        },
        ninth_prize: {
            count: (R1 * B0) + (R0 * B1),
            amount: ((R1 * B0) + (R0 * B1)) * FIXED_PRIZES.ninth
        }
    };

    const endTime = Date.now();
    const duration = endTime - startTime;
    const loopCount = redCombinations.length + blueCombinations.length;

    console.log(`⏱️  耗时: ${duration}ms`);
    console.log(`🔄 循环次数: ${loopCount.toLocaleString()}次`);
    console.log(`📈 时间复杂度: O(R + B) = O(${redCombinations.length} + ${blueCombinations.length})`);
    console.log('\n📊 命中分布统计:');
    console.log(`  红球: 5红=${R5}, 4红=${R4}, 3红=${R3}, 2红=${R2}, 1红=${R1}, 0红=${R0}`);
    console.log(`  蓝球: 2蓝=${B2}, 1蓝=${B1}, 0蓝=${B0}`);

    return { prizeStats, duration, loopCount };
}

// 对比结果
function compareResults(result1, result2) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 结果对比');
    console.log('='.repeat(60));

    console.log('\n🏆 奖项统计:');
    console.log('-'.repeat(60));
    console.log('奖项      方法1(次数) 方法1(奖金)    方法2(次数) 方法2(奖金)    是否一致');
    console.log('-'.repeat(60));

    const prizes = [
        'first_prize', 'second_prize', 'third_prize', 'fourth_prize',
        'fifth_prize', 'sixth_prize', 'seventh_prize', 'eighth_prize', 'ninth_prize'
    ];

    const prizeNames = {
        first_prize: '一等奖',
        second_prize: '二等奖',
        third_prize: '三等奖',
        fourth_prize: '四等奖',
        fifth_prize: '五等奖',
        sixth_prize: '六等奖',
        seventh_prize: '七等奖',
        eighth_prize: '八等奖',
        ninth_prize: '九等奖'
    };

    let allMatch = true;
    for (const prize of prizes) {
        const count1 = result1.prizeStats[prize].count;
        const amount1 = result1.prizeStats[prize].amount;
        const count2 = result2.prizeStats[prize].count;
        const amount2 = result2.prizeStats[prize].amount;

        const match = (count1 === count2 && amount1 === amount2);
        allMatch = allMatch && match;

        const status = match ? '✅' : '❌';
        console.log(
            `${prizeNames[prize]}   ${String(count1).padEnd(10)} ¥${String(amount1).padEnd(12)} ${String(count2).padEnd(10)} ¥${String(amount2).padEnd(12)} ${status}`
        );
    }

    console.log('\n⚡ 性能对比:');
    console.log('-'.repeat(60));
    console.log(`方法1耗时: ${result1.duration}ms (循环${result1.loopCount.toLocaleString()}次)`);
    console.log(`方法2耗时: ${result2.duration}ms (循环${result2.loopCount.toLocaleString()}次)`);

    if (result2.duration > 0) {
        const speedup = (result1.duration / result2.duration).toFixed(2);
        const loopReduction = ((1 - result2.loopCount / result1.loopCount) * 100).toFixed(2);
        console.log(`\n🚀 性能提升: ${speedup}倍加速`);
        console.log(`🔻 循环减少: ${loopReduction}%`);
    }

    console.log('\n🎯 验证结果:');
    console.log('-'.repeat(60));
    if (allMatch) {
        console.log('✅ 两种方法结果完全一致！优化方法可以安全使用。');
    } else {
        console.log('❌ 结果不一致！需要检查优化算法。');
    }
}

// 主函数
function main() {
    console.log('🔬 命中分析计算方法对比验证');
    console.log('='.repeat(60));
    console.log(`实际开奖号码:`);
    console.log(`  红球: ${actualRed.join(', ')}`);
    console.log(`  蓝球: ${actualBlue.join(', ')}`);

    const { redCombinations, blueCombinations } = generateTestCombinations();

    console.log(`\n测试规模:`);
    console.log(`  红球组合数: ${redCombinations.length.toLocaleString()}`);
    console.log(`  蓝球组合数: ${blueCombinations.length.toLocaleString()}`);
    console.log(`  总组合数: ${(redCombinations.length * blueCombinations.length).toLocaleString()}`);

    // 运行方法1
    const result1 = calculateByCartesianProduct(redCombinations, blueCombinations);

    // 运行方法2
    const result2 = calculateByOptimizedCount(redCombinations, blueCombinations);

    // 对比结果
    compareResults(result1, result2);

    console.log('\n' + '='.repeat(60));
    console.log('💡 实际应用场景预估:');
    console.log('='.repeat(60));

    const scenarios = [
        { name: '默认模式', red: 100, blue: 66 },
        { name: '无限制模式', red: 132740, blue: 66 },
        { name: '真正无限制', red: 324632, blue: 66 }
    ];

    for (const scenario of scenarios) {
        const oldLoops = scenario.red * scenario.blue;
        const newLoops = scenario.red + scenario.blue;
        const speedup = (oldLoops / newLoops).toFixed(2);

        console.log(`\n${scenario.name}:`);
        console.log(`  组合数: ${scenario.red.toLocaleString()} × ${scenario.blue} = ${oldLoops.toLocaleString()}`);
        console.log(`  原方法循环: ${oldLoops.toLocaleString()}次`);
        console.log(`  优化方法循环: ${newLoops.toLocaleString()}次`);
        console.log(`  预估加速: ${speedup}倍`);

        if (result2.duration > 0 && result1.loopCount > 0) {
            const timePerLoop = result1.duration / result1.loopCount;
            const estimatedOldTime = (oldLoops * timePerLoop / 1000).toFixed(2);
            const estimatedNewTime = (newLoops * timePerLoop / 1000).toFixed(2);
            console.log(`  预估原耗时: ${estimatedOldTime}秒`);
            console.log(`  预估优化后: ${estimatedNewTime}秒`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📝 结论: 优化方法在保证结果完全一致的前提下，大幅提升性能！');
    console.log('='.repeat(60));
}

// 运行
main();
