require('dotenv').config();
const mongoose = require('mongoose');

/**
 * 生成所有324,632个红球组合并计算连号字段
 */

/**
 * 分析连号统计
 */
function analyzeConsecutive(redBalls) {
    const sorted = [...redBalls].sort((a, b) => a - b);
    let groups = 0;
    let maxLength = 0;
    let currentLength = 1;
    let inGroup = false;

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
            if (!inGroup) {
                groups++;
                inGroup = true;
                currentLength = 2;
            } else {
                currentLength++;
            }
            maxLength = Math.max(maxLength, currentLength);
        } else {
            inGroup = false;
            currentLength = 1;
        }
    }

    return {
        consecutiveGroups: groups,
        maxConsecutiveLength: maxLength
    };
}

/**
 * 计算和值
 */
function calculateSum(balls) {
    return balls.reduce((sum, ball) => sum + ball, 0);
}

/**
 * 计算跨度
 */
function calculateSpan(balls) {
    const sorted = [...balls].sort((a, b) => a - b);
    return sorted[sorted.length - 1] - sorted[0];
}

/**
 * 计算区间比 (1-12:13-24:25-35)
 */
function calculateZoneRatio(balls) {
    let zone1 = 0, zone2 = 0, zone3 = 0;
    balls.forEach(ball => {
        if (ball >= 1 && ball <= 12) zone1++;
        else if (ball >= 13 && ball <= 24) zone2++;
        else if (ball >= 25 && ball <= 35) zone3++;
    });
    return `${zone1}:${zone2}:${zone3}`;
}

/**
 * 计算奇偶比
 */
function calculateOddEvenRatio(balls) {
    let odd = 0, even = 0;
    balls.forEach(ball => {
        if (ball % 2 === 1) odd++;
        else even++;
    });
    return `${odd}:${even}`;
}

async function generateAllCombinations() {
    console.log('🚀 开始生成所有红球组合...\n');

    try {
        // 1. 连接数据库
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lottery';
        await mongoose.connect(MONGO_URI);
        console.log('✅ 数据库连接成功\n');

        // 2. 定义Schema
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
            consecutive_groups: { type: Number, default: 0, min: 0, max: 4 },
            max_consecutive_length: { type: Number, default: 0, min: 0, max: 5 },
            created_at: { type: Date, default: Date.now }
        });

        const DLTRedCombinations = mongoose.model(
            'hit_dlts',
            dltRedCombinationsSchema,
            'hit_dlt_redcombinations'
        );

        // 3. 清空现有数据（可选）
        const existingCount = await DLTRedCombinations.countDocuments();
        if (existingCount > 0) {
            console.log(`⚠️  数据库中已有 ${existingCount} 条记录`);
            console.log('   将清空现有数据并重新生成...\n');
            await DLTRedCombinations.deleteMany({});
            console.log('✅ 已清空现有数据\n');
        }

        // 4. 生成所有组合
        console.log('📊 开始生成所有 C(35,5) = 324,632 个组合...\n');

        const combinations = [];
        let combinationId = 1;
        let generatedCount = 0;

        // 5个红球从35个中选择: C(35,5)
        for (let a = 1; a <= 31; a++) {
            for (let b = a + 1; b <= 32; b++) {
                for (let c = b + 1; c <= 33; c++) {
                    for (let d = c + 1; d <= 34; d++) {
                        for (let e = d + 1; e <= 35; e++) {
                            const balls = [a, b, c, d, e];
                            const consecutiveStats = analyzeConsecutive(balls);

                            combinations.push({
                                combination_id: combinationId++,
                                red_ball_1: a,
                                red_ball_2: b,
                                red_ball_3: c,
                                red_ball_4: d,
                                red_ball_5: e,
                                sum_value: calculateSum(balls),
                                span_value: calculateSpan(balls),
                                zone_ratio: calculateZoneRatio(balls),
                                odd_even_ratio: calculateOddEvenRatio(balls),
                                consecutive_groups: consecutiveStats.consecutiveGroups,
                                max_consecutive_length: consecutiveStats.maxConsecutiveLength,
                                created_at: new Date()
                            });

                            generatedCount++;

                            // 每生成1000个显示进度
                            if (generatedCount % 50000 === 0) {
                                console.log(`   生成进度: ${generatedCount} / 324632 (${((generatedCount / 324632) * 100).toFixed(1)}%)`);
                            }
                        }
                    }
                }
            }
        }

        console.log(`\n✅ 组合生成完成: 共 ${combinations.length} 个\n`);

        // 5. 批量插入数据库
        console.log('📥 开始批量插入数据库...\n');
        const batchSize = 10000;
        let inserted = 0;

        for (let i = 0; i < combinations.length; i += batchSize) {
            const batch = combinations.slice(i, i + batchSize);
            try {
                const result = await DLTRedCombinations.insertMany(batch, { ordered: false });
                inserted += result.length;
                console.log(`   插入进度: ${inserted} / ${combinations.length} (${((inserted / combinations.length) * 100).toFixed(1)}%)`);
            } catch (insertError) {
                console.error(`\n❌ 批次${i}-${i+batchSize}插入失败:`);
                console.error(`   错误: ${insertError.message}`);
                if (insertError.writeErrors && insertError.writeErrors.length > 0) {
                    console.error(`   失败记录数: ${insertError.writeErrors.length}`);
                    console.error(`   第一个错误:`, insertError.writeErrors[0]);
                }
                throw insertError;
            }
        }

        console.log(`\n✅ 数据插入完成！\n`);

        // 6. 验证
        const finalCount = await DLTRedCombinations.countDocuments();
        console.log(`📊 数据库验证: 共 ${finalCount} 条记录\n`);

        // 7. 统计连号分布
        console.log('📊 连号组数分布:');
        for (let i = 0; i <= 4; i++) {
            const count = await DLTRedCombinations.countDocuments({ consecutive_groups: i });
            console.log(`   ${i}连号: ${count} 个`);
        }

        console.log('\n📊 最长连号分布:');
        for (let i = 0; i <= 5; i++) {
            const count = await DLTRedCombinations.countDocuments({ max_consecutive_length: i });
            const label = i === 0 ? '无连号' : `长${i}连号`;
            console.log(`   ${label}: ${count} 个`);
        }

        console.log('\n✅ 所有组合已生成并导入数据库！');

    } catch (error) {
        console.error('\n❌ 生成失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
    }
}

// 执行生成
generateAllCombinations().then(() => {
    console.log('\n🎉 生成脚本执行完成！');
    process.exit(0);
}).catch(error => {
    console.error('❌ 生成脚本执行失败:', error);
    process.exit(1);
});
