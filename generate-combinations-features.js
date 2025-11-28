/**
 * 为所有324,632个红球组合生成combo_2/3/4特征
 * 一次性脚本，生成后不需要再次运行（除非重新生成组合表）
 *
 * 运行方式：node generate-combinations-features.js
 */

const mongoose = require('mongoose');

// 连接MongoDB
mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (err) => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
});

db.once('open', async () => {
    console.log('✅ MongoDB连接成功');
    await generateCombinationFeatures();
});

// ===== Schema定义 =====
const dltRedCombinationsSchema = new mongoose.Schema({
    combination_id: { type: Number, required: true, unique: true },
    red_ball_1: { type: Number, required: true, min: 1, max: 35 },
    red_ball_2: { type: Number, required: true, min: 1, max: 35 },
    red_ball_3: { type: Number, required: true, min: 1, max: 35 },
    red_ball_4: { type: Number, required: true, min: 1, max: 35 },
    red_ball_5: { type: Number, required: true, min: 1, max: 35 },
    sum_value: { type: Number, required: true, min: 15, max: 175 },
    span_value: { type: Number, required: true, min: 4, max: 34 },
    zone_ratio: { type: String, required: true },
    odd_even_ratio: { type: String, required: true },
    combo_2: [{ type: String }],
    combo_3: [{ type: String }],
    combo_4: [{ type: String }],
    created_at: { type: Date, default: Date.now }
});

const DLTRedCombinations = mongoose.model('hit_dlts', dltRedCombinationsSchema);

// ===== 组合特征生成工具函数 =====
function generateCombo2(balls) {
    const combos = [];
    for (let i = 0; i < balls.length - 1; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const num1 = String(balls[i]).padStart(2, '0');
            const num2 = String(balls[j]).padStart(2, '0');
            combos.push(`${num1}-${num2}`);
        }
    }
    return combos;
}

function generateCombo3(balls) {
    const combos = [];
    for (let i = 0; i < balls.length - 2; i++) {
        for (let j = i + 1; j < balls.length - 1; j++) {
            for (let k = j + 1; k < balls.length; k++) {
                const num1 = String(balls[i]).padStart(2, '0');
                const num2 = String(balls[j]).padStart(2, '0');
                const num3 = String(balls[k]).padStart(2, '0');
                combos.push(`${num1}-${num2}-${num3}`);
            }
        }
    }
    return combos;
}

function generateCombo4(balls) {
    const combos = [];
    for (let i = 0; i < balls.length - 3; i++) {
        for (let j = i + 1; j < balls.length - 2; j++) {
            for (let k = j + 1; k < balls.length - 1; k++) {
                for (let l = k + 1; l < balls.length; l++) {
                    const num1 = String(balls[i]).padStart(2, '0');
                    const num2 = String(balls[j]).padStart(2, '0');
                    const num3 = String(balls[k]).padStart(2, '0');
                    const num4 = String(balls[l]).padStart(2, '0');
                    combos.push(`${num1}-${num2}-${num3}-${num4}`);
                }
            }
        }
    }
    return combos;
}

// ===== 主函数 =====
async function generateCombinationFeatures() {
    try {
        console.log('\n========== 开始为324,632个红球组合生成特征 ==========\n');

        // 1. 检查总数
        const totalCount = await DLTRedCombinations.countDocuments();
        console.log(`📊 组合总数: ${totalCount.toLocaleString()}`);

        if (totalCount === 0) {
            console.log('⚠️  红球组合表为空，请先生成组合数据');
            process.exit(0);
        }

        // 2. 检查已有特征的组合数
        const existingCount = await DLTRedCombinations.countDocuments({
            combo_2: { $exists: true, $ne: [] }
        });
        console.log(`📋 已有特征的组合数: ${existingCount.toLocaleString()}`);

        if (existingCount === totalCount) {
            console.log('✅ 所有组合已有特征，无需重新生成');
            console.log('   如需重新生成，请手动清空combo_2/3/4字段\n');
            process.exit(0);
        }

        // 3. 批量生成特征
        console.log('\n🔄 开始生成特征...');
        console.log('   (预计耗时: 2-5分钟)\n');

        const batchSize = 1000; // 每批处理1000个组合
        let processedCount = 0;
        let updatedCount = 0;

        // 分批读取和更新
        let skip = 0;
        while (true) {
            const batch = await DLTRedCombinations.find({})
                .skip(skip)
                .limit(batchSize)
                .lean();

            if (batch.length === 0) break;

            const bulkOps = [];

            for (const combo of batch) {
                const balls = [
                    combo.red_ball_1,
                    combo.red_ball_2,
                    combo.red_ball_3,
                    combo.red_ball_4,
                    combo.red_ball_5
                ];

                const combo_2 = generateCombo2(balls);
                const combo_3 = generateCombo3(balls);
                const combo_4 = generateCombo4(balls);

                bulkOps.push({
                    updateOne: {
                        filter: { combination_id: combo.combination_id },
                        update: {
                            $set: {
                                combo_2,
                                combo_3,
                                combo_4
                            }
                        }
                    }
                });
            }

            // 执行批量更新
            if (bulkOps.length > 0) {
                const result = await DLTRedCombinations.bulkWrite(bulkOps, { ordered: false });
                updatedCount += result.modifiedCount;
            }

            processedCount += batch.length;
            skip += batchSize;

            // 进度显示
            const percent = ((processedCount / totalCount) * 100).toFixed(1);
            console.log(`   处理进度: ${processedCount.toLocaleString()} / ${totalCount.toLocaleString()} (${percent}%) - 已更新: ${updatedCount.toLocaleString()}`);
        }

        // 4. 验证结果
        const finalCount = await DLTRedCombinations.countDocuments({
            combo_2: { $exists: true, $ne: [] }
        });

        console.log('\n========== 生成完成 ==========');
        console.log(`✅ 总组合数: ${totalCount.toLocaleString()}`);
        console.log(`✅ 已更新数: ${updatedCount.toLocaleString()}`);
        console.log(`✅ 最终有特征的组合数: ${finalCount.toLocaleString()}`);

        // 5. 抽样验证
        console.log('\n========== 抽样验证 ==========');
        const sample = await DLTRedCombinations.findOne({ combo_2: { $exists: true } }).lean();
        if (sample) {
            console.log(`组合ID: ${sample.combination_id}`);
            console.log(`红球: [${sample.red_ball_1}, ${sample.red_ball_2}, ${sample.red_ball_3}, ${sample.red_ball_4}, ${sample.red_ball_5}]`);
            console.log(`2码组合数: ${sample.combo_2?.length || 0} (预期10个)`);
            console.log(`3码组合数: ${sample.combo_3?.length || 0} (预期10个)`);
            console.log(`4码组合数: ${sample.combo_4?.length || 0} (预期5个)`);
            console.log(`2码示例: ${sample.combo_2?.slice(0, 3).join(', ')}...`);
            console.log(`3码示例: ${sample.combo_3?.slice(0, 3).join(', ')}...`);
            console.log(`4码示例: ${sample.combo_4?.slice(0, 3).join(', ')}...`);
        }

        console.log('\n✅ 所有操作完成！');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 生成失败:', error);
        process.exit(1);
    }
}
