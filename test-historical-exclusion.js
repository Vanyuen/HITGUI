/**
 * 测试历史和值/跨度排除功能
 * 验证：从目标期-1开始倒推N期的逻辑是否正确
 */

const mongoose = require('mongoose');

// MongoDB连接
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const DLTSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number, // ⚠️ Issue是Number类型，不是String！
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
}, { collection: 'hit_dlts' }); // 使用小写集合名称

const DLT = mongoose.model('DLT_Test', DLTSchema);

async function testHistoricalExclusion() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB');

        // ========================================
        // 测试场景1：正常情况（预测25121期，历史记录充足）
        // ========================================
        console.log('\n========================================');
        console.log('测试场景1：预测25121期（历史记录充足）');
        console.log('========================================');

        const targetIssue1 = 25121; // ⚠️ 使用Number类型
        const baseIssue1 = targetIssue1 - 1; // 25120
        console.log(`目标期号: ${targetIssue1}`);
        console.log(`基准期号（目标期-1）: ${baseIssue1}`);

        // 查找基准期记录
        const baseRecord1 = await DLT.findOne({ Issue: baseIssue1 });
        if (!baseRecord1) {
            console.log(`❌ 基准期${baseIssue1}不存在，测试失败`);
            return;
        }

        console.log(`基准期ID: ${baseRecord1.ID}`);

        // 从基准期倒推10期
        const lookbackCount = 10;
        const historicalRecords1 = await DLT.find({ ID: { $lte: baseRecord1.ID } })
            .sort({ ID: -1 })
            .limit(lookbackCount)
            .lean();

        console.log(`\n从基准期${baseIssue1}（ID=${baseRecord1.ID}）倒推${lookbackCount}期：`);
        console.log(`实际获取: ${historicalRecords1.length}期`);
        console.log('\n期号列表（从新到旧）:');

        const sumValues1 = [];
        const spanValues1 = [];

        historicalRecords1.forEach((record, index) => {
            const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            const sum = redBalls.reduce((a, b) => a + b, 0);
            const span = Math.max(...redBalls) - Math.min(...redBalls);

            sumValues1.push(sum);
            spanValues1.push(span);

            console.log(`  ${index + 1}. 期号${record.Issue}（ID=${record.ID}）: 红球${redBalls.join(',')} | 和值=${sum} | 跨度=${span}`);
        });

        console.log(`\n排除和值列表（去重）: ${[...new Set(sumValues1)].sort((a, b) => a - b).join(', ')}`);
        console.log(`排除跨度列表（去重）: ${[...new Set(spanValues1)].sort((a, b) => a - b).join(', ')}`);

        // ========================================
        // 测试场景2：历史数据不足（预测早期期号）
        // ========================================
        console.log('\n========================================');
        console.log('测试场景2：历史数据不足（预测早期期号）');
        console.log('========================================');

        // 找到数据库中第11期作为目标期（确保历史只有10期）
        const allIssues = await DLT.find({}).sort({ ID: 1 }).limit(11).lean();
        if (allIssues.length < 11) {
            console.log('⚠️ 数据库历史数据不足11期，跳过此测试');
        } else {
            const targetIssue2 = allIssues[10].Issue; // 第11期 (Number类型)
            const baseIssue2 = targetIssue2 - 1;

            console.log(`目标期号: ${targetIssue2}`);
            console.log(`基准期号（目标期-1）: ${baseIssue2}`);

            const baseRecord2 = await DLT.findOne({ Issue: baseIssue2 });
            if (!baseRecord2) {
                console.log(`❌ 基准期${baseIssue2}不存在`);
            } else {
                console.log(`基准期ID: ${baseRecord2.ID}`);

                const historicalRecords2 = await DLT.find({ ID: { $lte: baseRecord2.ID } })
                    .sort({ ID: -1 })
                    .limit(lookbackCount)
                    .lean();

                console.log(`\n从基准期${baseIssue2}（ID=${baseRecord2.ID}）倒推${lookbackCount}期：`);
                console.log(`实际获取: ${historicalRecords2.length}期 ${historicalRecords2.length < lookbackCount ? '⚠️ 不足10期' : '✅'}`);

                if (historicalRecords2.length > 0) {
                    console.log('\n期号列表（从新到旧）:');
                    historicalRecords2.forEach((record, index) => {
                        const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
                        const sum = redBalls.reduce((a, b) => a + b, 0);
                        const span = Math.max(...redBalls) - Math.min(...redBalls);
                        console.log(`  ${index + 1}. 期号${record.Issue}（ID=${record.ID}）: 和值=${sum} | 跨度=${span}`);
                    });
                }
            }
        }

        // ========================================
        // 测试场景3：验证$lte vs $lt的区别
        // ========================================
        console.log('\n========================================');
        console.log('测试场景3：验证$lte vs $lt的区别');
        console.log('========================================');

        if (baseRecord1) {
            // 使用 $lt（旧代码的BUG）
            const recordsWithLt = await DLT.find({ ID: { $lt: baseRecord1.ID } })
                .sort({ ID: -1 })
                .limit(lookbackCount)
                .lean();

            // 使用 $lte（修复后的代码）
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
testHistoricalExclusion();
