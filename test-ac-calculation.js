/**
 * AC值计算验证测试脚本
 *
 * 功能: 验证数据库中AC值计算的正确性
 * 测试内容:
 * 1. 随机抽样验证AC值计算
 * 2. 测试边界情况（AC=0, AC=6）
 * 3. 验证AC值分布是否合理
 *
 * 运行方式: node test-ac-calculation.js
 */

const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

/**
 * 计算AC值 (与server.js中的函数相同)
 */
function calculateACValue(numbers) {
    if (!numbers || numbers.length < 2) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const differences = new Set();

    // 计算所有号码对之间的差值并去重
    for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const diff = sorted[j] - sorted[i];
            differences.add(diff);
        }
    }

    // AC值 = 去重后的差值数量 - (n-1)
    const acValue = differences.size - (sorted.length - 1);
    return Math.max(0, acValue);
}

/**
 * 主测试函数
 */
async function testACValues() {
    try {
        console.log('\n========================================');
        console.log('🧪 AC值计算验证测试');
        console.log('========================================\n');

        const DLTRedCombinations = mongoose.model('hit_dlts',
            new mongoose.Schema({}, { strict: false }));

        // 1. 统计基本信息
        const total = await DLTRedCombinations.countDocuments({});
        const withAC = await DLTRedCombinations.countDocuments({
            ac_value: { $exists: true }
        });

        console.log('📊 数据库统计:');
        console.log(`   总记录数: ${total.toLocaleString()}`);
        console.log(`   包含AC值: ${withAC.toLocaleString()}`);
        console.log(`   覆盖率: ${((withAC / total) * 100).toFixed(2)}%\n`);

        if (withAC === 0) {
            console.log('❌ 错误: 数据库中没有AC值数据！请先运行 migrate-ac-value.js\n');
            return;
        }

        // 2. AC值分布验证
        console.log('📊 AC值分布统计:');
        for (let ac = 0; ac <= 6; ac++) {
            const count = await DLTRedCombinations.countDocuments({ ac_value: ac });
            const percentage = ((count / total) * 100).toFixed(2);
            const bar = '█'.repeat(Math.floor(percentage / 2));
            console.log(`   AC=${ac}: ${count.toLocaleString().padStart(8)} 条 (${percentage.padStart(5)}%) ${bar}`);
        }
        console.log('');

        // 3. 随机抽样验证 (100个样本)
        console.log('🔍 随机抽样验证 (100个样本):');
        const sampleSize = 100;
        const samples = await DLTRedCombinations.aggregate([
            { $sample: { size: sampleSize } }
        ]);

        let correctCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const sample of samples) {
            const balls = [
                sample.red_ball_1, sample.red_ball_2, sample.red_ball_3,
                sample.red_ball_4, sample.red_ball_5
            ];
            const calculatedAC = calculateACValue(balls);

            if (calculatedAC === sample.ac_value) {
                correctCount++;
            } else {
                errorCount++;
                errors.push({
                    id: sample.combination_id,
                    balls: balls.join('-'),
                    stored: sample.ac_value,
                    calculated: calculatedAC
                });
            }
        }

        console.log(`   ✅ 正确: ${correctCount} / ${sampleSize}`);
        console.log(`   ❌ 错误: ${errorCount} / ${sampleSize}`);

        if (errorCount > 0) {
            console.log('\n   错误详情:');
            errors.forEach((err, idx) => {
                console.log(`   ${idx + 1}. ID=${err.id}, 组合=${err.balls}, 存储=${err.stored}, 计算=${err.calculated}`);
            });
        }
        console.log('');

        // 4. 边界情况测试
        console.log('🎯 边界情况测试:');

        // AC=0 的组合 (最小AC值)
        const minAC = await DLTRedCombinations.findOne({ ac_value: 0 }).lean();
        if (minAC) {
            const balls = [minAC.red_ball_1, minAC.red_ball_2, minAC.red_ball_3,
                          minAC.red_ball_4, minAC.red_ball_5];
            const calculated = calculateACValue(balls);
            console.log(`   AC=0 示例: ${balls.join('-')} → 计算值=${calculated} ${calculated === 0 ? '✅' : '❌'}`);
        }

        // AC=6 的组合 (最大AC值)
        const maxAC = await DLTRedCombinations.findOne({ ac_value: 6 }).lean();
        if (maxAC) {
            const balls = [maxAC.red_ball_1, maxAC.red_ball_2, maxAC.red_ball_3,
                          maxAC.red_ball_4, maxAC.red_ball_5];
            const calculated = calculateACValue(balls);
            console.log(`   AC=6 示例: ${balls.join('-')} → 计算值=${calculated} ${calculated === 6 ? '✅' : '❌'}`);
        }
        console.log('');

        // 5. 特殊组合测试
        console.log('🧮 特殊组合验证:');

        // 连号组合 (AC值应该较小)
        const consecutive = await DLTRedCombinations.findOne({
            red_ball_1: 1, red_ball_2: 2, red_ball_3: 3, red_ball_4: 4, red_ball_5: 5
        }).lean();

        if (consecutive) {
            const balls = [1, 2, 3, 4, 5];
            const calculated = calculateACValue(balls);
            console.log(`   连号组合 1-2-3-4-5: AC=${consecutive.ac_value} (计算=${calculated}) ${calculated === consecutive.ac_value ? '✅' : '❌'}`);
        }

        // 极端分散组合 (AC值应该较大)
        const dispersed = await DLTRedCombinations.findOne({
            red_ball_1: 1, red_ball_2: 8, red_ball_3: 15, red_ball_4: 25, red_ball_5: 35
        }).lean();

        if (dispersed) {
            const balls = [dispersed.red_ball_1, dispersed.red_ball_2, dispersed.red_ball_3,
                          dispersed.red_ball_4, dispersed.red_ball_5];
            const calculated = calculateACValue(balls);
            console.log(`   分散组合 ${balls.join('-')}: AC=${dispersed.ac_value} (计算=${calculated}) ${calculated === dispersed.ac_value ? '✅' : '❌'}`);
        }
        console.log('');

        // 6. 索引验证
        console.log('📑 索引验证:');
        const indexes = await DLTRedCombinations.collection.getIndexes();
        const hasACIndex = Object.keys(indexes).some(key => key.includes('ac_value'));
        console.log(`   AC值索引: ${hasACIndex ? '✅ 已创建' : '❌ 未创建'}`);
        console.log('');

        // 7. 总结
        console.log('========================================');
        if (errorCount === 0 && correctCount === sampleSize) {
            console.log('✅ 测试通过! AC值计算完全正确');
        } else if (errorCount > 0) {
            console.log(`⚠️ 测试失败! 发现 ${errorCount} 个计算错误`);
        } else {
            console.log('⚠️ 测试部分完成，请检查上述结果');
        }
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ 测试失败:', error);
        console.error(error.stack);
    } finally {
        mongoose.disconnect();
        console.log('🔌 数据库连接已关闭\n');
    }
}

// 运行测试
testACValues();
