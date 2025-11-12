/**
 * AC值数据迁移脚本
 *
 * 功能: 为所有红球组合计算并填充 ac_value 字段
 * AC值定义: 不重复差值数量 - 4
 * 范围: 0-6 (5个红球的组合)
 *
 * 运行方式: node migrate-ac-value.js
 */

const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

/**
 * 计算AC值 (Arithmetic Complexity - 算术复杂度)
 * AC值用于衡量号码组合的离散程度
 * AC = 去重后的号码差值数量 - (n-1)，其中n为号码个数
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
    return Math.max(0, acValue); // AC值不能为负
}

/**
 * 主迁移函数
 */
async function migrate() {
    try {
        console.log('\n========================================');
        console.log('🚀 开始AC值数据迁移');
        console.log('========================================\n');

        // 定义Schema
        const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations',
            new mongoose.Schema({}, { strict: false }));

        // 统计总数
        const total = await DLTRedCombinations.countDocuments({});
        console.log(`📊 总记录数: ${total.toLocaleString()}`);

        // 统计需要迁移的数量
        const needMigrate = await DLTRedCombinations.countDocuments({
            ac_value: { $exists: false }
        });
        console.log(`🔧 需要迁移的记录数: ${needMigrate.toLocaleString()}`);

        if (needMigrate === 0) {
            console.log('\n✅ 所有记录已包含AC值，无需迁移！');
            mongoose.disconnect();
            return;
        }

        console.log('\n⏳ 开始计算AC值...\n');

        const startTime = Date.now();
        const batchSize = 10000;
        let processed = 0;
        let successCount = 0;
        let errorCount = 0;

        while (true) {
            // 批量查询未计算AC值的组合
            const combinations = await DLTRedCombinations.find({
                ac_value: { $exists: false }
            }).limit(batchSize).lean();

            if (combinations.length === 0) {
                break; // 全部处理完成
            }

            // 构建批量更新操作
            const bulkOps = [];

            for (const combo of combinations) {
                try {
                    const balls = [
                        combo.red_ball_1,
                        combo.red_ball_2,
                        combo.red_ball_3,
                        combo.red_ball_4,
                        combo.red_ball_5
                    ];

                    const acValue = calculateACValue(balls);

                    bulkOps.push({
                        updateOne: {
                            filter: { combination_id: combo.combination_id },
                            update: { $set: { ac_value: acValue } }
                        }
                    });

                    successCount++;
                } catch (error) {
                    console.error(`❌ 处理组合 ${combo.combination_id} 失败:`, error.message);
                    errorCount++;
                }
            }

            // 批量写入数据库
            if (bulkOps.length > 0) {
                await DLTRedCombinations.bulkWrite(bulkOps);
            }

            processed += combinations.length;
            const progress = ((processed / needMigrate) * 100).toFixed(2);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const speed = (processed / elapsed).toFixed(0);

            console.log(`  ✓ 已处理: ${processed.toLocaleString()} / ${needMigrate.toLocaleString()} (${progress}%) | 速度: ${speed}条/秒 | 用时: ${elapsed}秒`);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n========================================');
        console.log('✅ AC值迁移完成！');
        console.log('========================================');
        console.log(`📊 成功: ${successCount.toLocaleString()} 条`);
        console.log(`❌ 失败: ${errorCount.toLocaleString()} 条`);
        console.log(`⏱️  总用时: ${totalTime} 秒`);
        console.log(`⚡ 平均速度: ${(successCount / totalTime).toFixed(0)} 条/秒`);
        console.log('========================================\n');

        // 验证结果
        console.log('🔍 验证迁移结果...\n');

        const withAC = await DLTRedCombinations.countDocuments({
            ac_value: { $exists: true }
        });
        console.log(`✅ 包含AC值的记录: ${withAC.toLocaleString()} / ${total.toLocaleString()}`);

        const withoutAC = await DLTRedCombinations.countDocuments({
            ac_value: { $exists: false }
        });
        console.log(`⚠️  缺少AC值的记录: ${withoutAC.toLocaleString()}`);

        // 统计AC值分布
        console.log('\n📊 AC值分布统计:');
        for (let ac = 0; ac <= 6; ac++) {
            const count = await DLTRedCombinations.countDocuments({ ac_value: ac });
            const percentage = ((count / total) * 100).toFixed(2);
            console.log(`   AC=${ac}: ${count.toLocaleString()} 条 (${percentage}%)`);
        }

        // 查询示例
        console.log('\n🔎 随机抽样验证:');
        const samples = await DLTRedCombinations.find({
            ac_value: { $exists: true }
        }).limit(5).lean();

        samples.forEach((sample, index) => {
            const balls = [
                sample.red_ball_1, sample.red_ball_2, sample.red_ball_3,
                sample.red_ball_4, sample.red_ball_5
            ];
            const calculatedAC = calculateACValue(balls);
            const match = calculatedAC === sample.ac_value ? '✅' : '❌';
            console.log(`   ${index + 1}. 组合 ${balls.join('-')} → AC=${sample.ac_value} (计算值=${calculatedAC}) ${match}`);
        });

        console.log('\n');

    } catch (error) {
        console.error('\n❌ 迁移失败:', error);
        console.error(error.stack);
    } finally {
        mongoose.disconnect();
        console.log('🔌 数据库连接已关闭\n');
    }
}

// 运行迁移
migrate();
