/**
 * 测试同出排除（按期号）历史排除功能
 * 验证：
 * 1. 从目标期-1开始倒推N期提取历史同出组合
 * 2. 2码、3码、4码组合正确生成
 * 3. 预测组合中包含历史同出组合的能被正确排除
 */

const mongoose = require('mongoose');

// MongoDB连接
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const DLTSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
}, { collection: 'hit_dlts' });

const DLT = mongoose.model('DLT_CoOccurTest', DLTSchema);

/**
 * 从红球数组生成组合
 */
function generateCombinations(redBalls, size) {
    const results = [];
    const sortedBalls = redBalls.map(n => String(n).padStart(2, '0')).sort();

    function combine(start, current) {
        if (current.length === size) {
            results.push(current.join('-'));
            return;
        }

        for (let i = start; i <= sortedBalls.length - (size - current.length); i++) {
            combine(i + 1, [...current, sortedBalls[i]]);
        }
    }

    combine(0, []);
    return results;
}

/**
 * 检查预测组合是否包含历史组合
 */
function containsHistoricalCombo(predictionRedBalls, historicalCombos, comboSize) {
    const predictionCombos = generateCombinations(predictionRedBalls, comboSize);

    for (const combo of predictionCombos) {
        if (historicalCombos.has(combo)) {
            return { matched: true, combo };
        }
    }

    return { matched: false };
}

async function testCoOccurrenceHistoricalExclusion() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        // ========================================
        // 测试场景1：正常情况（预测25121期，历史10期）
        // ========================================
        console.log('========================================');
        console.log('测试场景1：预测25121期（历史10期）');
        console.log('========================================');

        const targetIssue1 = 25121;
        const baseIssue1 = targetIssue1 - 1; // 25120
        const lookbackCount = 10;

        console.log(`目标期号: ${targetIssue1}`);
        console.log(`基准期号（目标期-1）: ${baseIssue1}`);

        // 查找基准期记录
        const baseRecord1 = await DLT.findOne({ Issue: baseIssue1 });
        if (!baseRecord1) {
            console.log(`❌ 基准期${baseIssue1}不存在，测试失败`);
            return;
        }

        console.log(`基准期ID: ${baseRecord1.ID}\n`);

        // 从基准期倒推N期
        const historicalRecords1 = await DLT.find({ ID: { $lte: baseRecord1.ID } })
            .sort({ ID: -1 })
            .limit(lookbackCount)
            .lean();

        console.log(`从基准期${baseIssue1}（ID=${baseRecord1.ID}）倒推${lookbackCount}期：`);
        console.log(`实际获取: ${historicalRecords1.length}期\n`);

        // 提取历史同出组合
        const combo2Set = new Set();
        const combo3Set = new Set();
        const combo4Set = new Set();

        console.log('历史期号明细（从新到旧）:');
        historicalRecords1.forEach((record, index) => {
            const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            console.log(`  ${index + 1}. 期号${record.Issue}（ID=${record.ID}）: 红球 ${redBalls.join(' ')}`);

            // 生成2码组合
            const combo2 = generateCombinations(redBalls, 2);
            combo2.forEach(c => combo2Set.add(c));

            // 生成3码组合
            const combo3 = generateCombinations(redBalls, 3);
            combo3.forEach(c => combo3Set.add(c));

            // 生成4码组合
            const combo4 = generateCombinations(redBalls, 4);
            combo4.forEach(c => combo4Set.add(c));
        });

        console.log(`\n📊 历史同出组合统计:`);
        console.log(`  2码组合: ${combo2Set.size}个`);
        console.log(`  3码组合: ${combo3Set.size}个`);
        console.log(`  4码组合: ${combo4Set.size}个`);

        // 显示部分2码组合示例
        const combo2Array = Array.from(combo2Set).sort();
        console.log(`\n  2码组合示例（前10个）: ${combo2Array.slice(0, 10).join(', ')}`);

        // ========================================
        // 测试场景2：验证排除逻辑
        // ========================================
        console.log('\n========================================');
        console.log('测试场景2：验证排除逻辑');
        console.log('========================================');

        // 模拟预测组合
        const testPredictions = [
            { name: '组合A（应被排除）', red: [1, 2, 3, 4, 5] },   // 假设包含历史组合
            { name: '组合B（可能保留）', red: [25, 26, 27, 28, 29] }, // 假设不包含历史组合
        ];

        // 获取第一期历史数据作为参考
        const firstHistorical = historicalRecords1[0];
        const firstRedBalls = [firstHistorical.Red1, firstHistorical.Red2, firstHistorical.Red3, firstHistorical.Red4, firstHistorical.Red5];

        // 创建一个包含第一期历史红球的测试预测（确保被排除）
        testPredictions[0].red = [...firstRedBalls];
        console.log(`\n测试预测组合A使用第一期历史红球: ${firstRedBalls.join(' ')}`);

        for (const prediction of testPredictions) {
            console.log(`\n测试预测: ${prediction.name}`);
            console.log(`  红球: ${prediction.red.join(' ')}`);

            // 检查2码组合
            const check2 = containsHistoricalCombo(prediction.red, combo2Set, 2);
            if (check2.matched) {
                console.log(`  ❌ 包含历史2码组合: ${check2.combo} → 应被排除`);
            } else {
                console.log(`  ✅ 不包含历史2码组合 → 保留（2码检查通过）`);
            }

            // 检查3码组合
            const check3 = containsHistoricalCombo(prediction.red, combo3Set, 3);
            if (check3.matched) {
                console.log(`  ❌ 包含历史3码组合: ${check3.combo} → 应被排除`);
            } else {
                console.log(`  ✅ 不包含历史3码组合 → 保留（3码检查通过）`);
            }

            // 检查4码组合
            const check4 = containsHistoricalCombo(prediction.red, combo4Set, 4);
            if (check4.matched) {
                console.log(`  ❌ 包含历史4码组合: ${check4.combo} → 应被排除`);
            } else {
                console.log(`  ✅ 不包含历史4码组合 → 保留（4码检查通过）`);
            }

            // 综合判断（OR逻辑）
            const shouldExclude = check2.matched || check3.matched || check4.matched;
            if (shouldExclude) {
                console.log(`  🔴 最终判定: 排除（任意一个码数匹配即排除）`);
            } else {
                console.log(`  🟢 最终判定: 保留（所有码数检查均通过）`);
            }
        }

        // ========================================
        // 测试场景3：验证$lte vs $lt的区别
        // ========================================
        console.log('\n========================================');
        console.log('测试场景3：验证$lte vs $lt的区别');
        console.log('========================================');

        // 使用 $lt（不包含基准期）
        const recordsWithLt = await DLT.find({ ID: { $lt: baseRecord1.ID } })
            .sort({ ID: -1 })
            .limit(lookbackCount)
            .lean();

        // 使用 $lte（包含基准期）
        const recordsWithLte = await DLT.find({ ID: { $lte: baseRecord1.ID } })
            .sort({ ID: -1 })
            .limit(lookbackCount)
            .lean();

        console.log(`使用 $lt（不包含基准期）: 获取${recordsWithLt.length}期`);
        if (recordsWithLt.length > 0) {
            console.log(`  最新期号: ${recordsWithLt[0].Issue}（ID=${recordsWithLt[0].ID}）`);
        }

        console.log(`使用 $lte（包含基准期）: 获取${recordsWithLte.length}期`);
        if (recordsWithLte.length > 0) {
            console.log(`  最新期号: ${recordsWithLte[0].Issue}（ID=${recordsWithLte[0].ID}）`);
        }

        if (recordsWithLt[0]?.Issue !== baseIssue1 && recordsWithLte[0]?.Issue === baseIssue1) {
            console.log('✅ 验证通过：$lte正确包含了基准期，$lt不包含基准期');
        } else {
            console.log('❌ 验证失败：查询结果不符合预期');
        }

        console.log('\n========================================');
        console.log('✅ 所有测试完成');
        console.log('========================================');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 已断开MongoDB连接');
    }
}

// 运行测试
testCoOccurrenceHistoricalExclusion();
