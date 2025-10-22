require('dotenv').config();
const mongoose = require('mongoose');

/**
 * 分析连号统计
 * @param {Array<Number>} redBalls - 5个红球号码
 * @returns {Object} - { consecutiveGroups: 连号组数, maxConsecutiveLength: 最长连号长度 }
 */
function analyzeConsecutive(redBalls) {
    const sorted = [...redBalls].sort((a, b) => a - b);
    let groups = 0;              // 连号组数
    let maxLength = 0;           // 最长连号长度
    let currentLength = 1;       // 当前连号长度
    let inGroup = false;

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
            // 发现连续号码
            if (!inGroup) {
                groups++;              // 新的连号组
                inGroup = true;
                currentLength = 2;     // 当前组至少2个
            } else {
                currentLength++;       // 当前组延长
            }
            maxLength = Math.max(maxLength, currentLength);
        } else {
            // 连号中断
            inGroup = false;
            currentLength = 1;
        }
    }

    return {
        consecutiveGroups: groups,
        maxConsecutiveLength: maxLength
    };
}

async function migrateConsecutiveFields() {
    console.log('🚀 开始连号字段数据迁移...');

    try {
        // 连接数据库
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lottery';
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功');

        // 获取红球组合集合（指定集合名）
        const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations', new mongoose.Schema({}, { strict: false }), 'hit_dlt_redcombinations');

        // 统计总数
        const totalCount = await DLTRedCombinations.countDocuments();
        console.log(`📊 总共需要处理 ${totalCount} 条红球组合记录`);

        if (totalCount === 0) {
            console.log('⚠️ 没有数据需要迁移');
            return;
        }

        // 分批处理，每批1000条
        const batchSize = 1000;
        let processed = 0;
        let updated = 0;
        let skipped = 0;

        console.log(`🔄 开始分批处理（每批 ${batchSize} 条）...`);

        while (processed < totalCount) {
            const combinations = await DLTRedCombinations.find({})
                .skip(processed)
                .limit(batchSize)
                .lean();

            console.log(`\n📦 处理第 ${Math.floor(processed / batchSize) + 1} 批（${combinations.length} 条）...`);

            // 批量更新操作
            const bulkOps = [];

            for (const combo of combinations) {
                // 检查是否已有连号字段
                if (combo.consecutive_groups !== undefined && combo.max_consecutive_length !== undefined) {
                    skipped++;
                    continue;
                }

                // 提取红球
                const redBalls = [
                    combo.red_ball_1,
                    combo.red_ball_2,
                    combo.red_ball_3,
                    combo.red_ball_4,
                    combo.red_ball_5
                ];

                // 计算连号统计
                const stats = analyzeConsecutive(redBalls);

                // 准备更新操作
                bulkOps.push({
                    updateOne: {
                        filter: { _id: combo._id },
                        update: {
                            $set: {
                                consecutive_groups: stats.consecutiveGroups,
                                max_consecutive_length: stats.maxConsecutiveLength
                            }
                        }
                    }
                });

                updated++;
            }

            // 执行批量更新
            if (bulkOps.length > 0) {
                await DLTRedCombinations.bulkWrite(bulkOps);
                console.log(`✅ 批量更新完成: ${bulkOps.length} 条`);
            }

            processed += combinations.length;
            const progress = ((processed / totalCount) * 100).toFixed(2);
            console.log(`📈 进度: ${processed}/${totalCount} (${progress}%)`);
        }

        console.log('\n✅ 数据迁移完成！');
        console.log(`📊 统计信息:`);
        console.log(`   - 总记录数: ${totalCount}`);
        console.log(`   - 已更新: ${updated}`);
        console.log(`   - 已跳过: ${skipped}`);

        // 验证迁移结果
        console.log('\n🔍 验证迁移结果...');
        const sampleCombos = await DLTRedCombinations.find({}).limit(5).lean();

        console.log('\n📋 示例记录（前5条）:');
        sampleCombos.forEach((combo, index) => {
            const redBalls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
            console.log(`${index + 1}. 红球: [${redBalls.join(', ')}]`);
            console.log(`   连号组数: ${combo.consecutive_groups}`);
            console.log(`   最长连号: ${combo.max_consecutive_length}`);
        });

        // 统计各种连号分布
        console.log('\n📊 连号分布统计:');

        for (let i = 0; i <= 4; i++) {
            const count = await DLTRedCombinations.countDocuments({ consecutive_groups: i });
            console.log(`   ${i}连号: ${count} 条`);
        }

        console.log('\n📊 最长连号分布统计:');
        for (let i = 0; i <= 5; i++) {
            const count = await DLTRedCombinations.countDocuments({ max_consecutive_length: i });
            const label = i === 0 ? '无连号' : `长${i}连号`;
            console.log(`   ${label}: ${count} 条`);
        }

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
    }
}

// 执行迁移
migrateConsecutiveFields().then(() => {
    console.log('\n🎉 迁移脚本执行完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 迁移脚本执行失败:', error);
    process.exit(1);
});
