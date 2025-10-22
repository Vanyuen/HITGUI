// 简单直接的AC值添加脚本
require('dotenv').config();
const mongoose = require('mongoose');

function calculateACValue(numbers) {
    if (!numbers || numbers.length < 2) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const differences = new Set();

    for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            differences.add(sorted[j] - sorted[i]);
        }
    }

    return Math.max(0, differences.size - (sorted.length - 1));
}

async function addACValues() {
    try {
        console.log('🚀 开始添加AC值字段\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_redcombinations');

        const total = await collection.countDocuments();
        console.log(`📊 总文档数: ${total.toLocaleString()}\n`);

        let processed = 0;
        let updated = 0;
        const batchSize = 1000;
        const bulkOps = [];
        const startTime = Date.now();

        console.log('⏳ 开始处理...\n');

        const cursor = collection.find({});

        for await (const doc of cursor) {
            const numbers = [
                doc.red_ball_1,
                doc.red_ball_2,
                doc.red_ball_3,
                doc.red_ball_4,
                doc.red_ball_5
            ];

            const acValue = calculateACValue(numbers);

            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { ac_value: acValue } }
                }
            });

            if (bulkOps.length >= batchSize) {
                const result = await collection.bulkWrite(bulkOps);
                updated += result.modifiedCount;
                processed += bulkOps.length;
                bulkOps.length = 0;

                const progress = ((processed / total) * 100).toFixed(2);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const speed = (processed / elapsed).toFixed(0);
                console.log(`  进度: ${processed.toLocaleString()}/${total.toLocaleString()} (${progress}%) | 速度: ${speed}条/秒`);
            }
        }

        // 处理剩余的
        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            updated += result.modifiedCount;
            processed += bulkOps.length;
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n✅ 处理完成！`);
        console.log(`  总处理数: ${processed.toLocaleString()}`);
        console.log(`  总更新数: ${updated.toLocaleString()}`);
        console.log(`  总耗时: ${totalTime}秒\n`);

        // 验证
        const withAC = await collection.countDocuments({ ac_value: { $exists: true } });
        console.log(`📊 验证: ${withAC.toLocaleString()} 个文档有 ac_value 字段\n`);

        // 显示几个示例
        console.log('📋 示例文档:');
        const samples = await collection.find({ ac_value: { $exists: true } }).limit(5).toArray();
        samples.forEach((s, i) => {
            const numbers = [s.red_ball_1, s.red_ball_2, s.red_ball_3, s.red_ball_4, s.red_ball_5];
            console.log(`  [${i + 1}] ID=${s.combination_id}, 号码=[${numbers.join(',')}], AC值=${s.ac_value}`);
        });

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
}

addACValues();
