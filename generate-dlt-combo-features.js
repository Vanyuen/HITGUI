/**
 * 生成大乐透历史开奖记录的组合特征
 * 为HIT_DLT_ComboFeatures表生成数据
 *
 * 运行方式：node generate-dlt-combo-features.js
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
    await generateComboFeatures();
});

// ===== Schema定义 =====
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: String, required: true, unique: true },
    Red1: { type: Number, required: true },
    Red2: { type: Number, required: true },
    Red3: { type: Number, required: true },
    Red4: { type: Number, required: true },
    Red5: { type: Number, required: true },
    Blue1: { type: Number, required: true },
    Blue2: { type: Number, required: true },
    DrawDate: { type: Date, required: true }
});
const DLT = mongoose.model('HIT_DLT', dltSchema);

const dltComboFeaturesSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true, index: true },
    Issue: { type: String, required: true, index: true },
    combo_2: [{ type: String }],
    combo_3: [{ type: String }],
    combo_4: [{ type: String }],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

dltComboFeaturesSchema.index({ combo_2: 1 });
dltComboFeaturesSchema.index({ combo_3: 1 });
dltComboFeaturesSchema.index({ combo_4: 1 });

const DLTComboFeatures = mongoose.model('HIT_DLT_ComboFeatures', dltComboFeaturesSchema);

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
async function generateComboFeatures() {
    try {
        console.log('\n========== 开始生成大乐透历史开奖组合特征 ==========\n');

        // 1. 获取所有历史开奖记录（按ID排序）
        console.log('📊 正在读取历史开奖记录...');
        const allRecords = await DLT.find({}).sort({ ID: 1 }).lean();
        console.log(`✅ 共读取 ${allRecords.length} 期历史数据\n`);

        if (allRecords.length === 0) {
            console.log('⚠️  没有历史数据，退出程序');
            process.exit(0);
        }

        // 2. 检查已有数据
        const existingCount = await DLTComboFeatures.countDocuments();
        console.log(`📋 已有组合特征记录: ${existingCount} 条`);

        // 3. 批量生成特征
        console.log('\n🔄 开始生成组合特征...');
        const batchSize = 100; // 每批处理100条
        let successCount = 0;
        let updateCount = 0;
        let skipCount = 0;

        for (let i = 0; i < allRecords.length; i += batchSize) {
            const batch = allRecords.slice(i, Math.min(i + batchSize, allRecords.length));

            // 批量操作数组
            const bulkOps = [];

            for (const record of batch) {
                const balls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].sort((a, b) => a - b);

                const combo_2 = generateCombo2(balls);
                const combo_3 = generateCombo3(balls);
                const combo_4 = generateCombo4(balls);

                bulkOps.push({
                    updateOne: {
                        filter: { ID: record.ID },
                        update: {
                            $set: {
                                Issue: record.Issue,
                                combo_2,
                                combo_3,
                                combo_4,
                                updated_at: new Date()
                            },
                            $setOnInsert: {
                                created_at: new Date()
                            }
                        },
                        upsert: true
                    }
                });
            }

            // 执行批量操作
            if (bulkOps.length > 0) {
                const result = await DLTComboFeatures.bulkWrite(bulkOps, { ordered: false });
                successCount += result.upsertedCount;
                updateCount += result.modifiedCount;

                // 进度显示
                const progress = Math.min(i + batchSize, allRecords.length);
                const percent = ((progress / allRecords.length) * 100).toFixed(1);
                console.log(`   处理进度: ${progress}/${allRecords.length} (${percent}%) - 新增: ${successCount}, 更新: ${updateCount}`);
            }
        }

        // 4. 验证结果
        const finalCount = await DLTComboFeatures.countDocuments();

        console.log('\n========== 生成完成 ==========');
        console.log(`✅ 总记录数: ${allRecords.length}`);
        console.log(`✅ 新增记录: ${successCount}`);
        console.log(`✅ 更新记录: ${updateCount}`);
        console.log(`✅ 最终数据库记录数: ${finalCount}`);

        // 5. 抽样验证
        console.log('\n========== 抽样验证 ==========');
        const sample = await DLTComboFeatures.findOne().lean();
        if (sample) {
            console.log(`期号: ${sample.Issue} (ID: ${sample.ID})`);
            console.log(`2码组合数: ${sample.combo_2.length} (预期10个)`);
            console.log(`3码组合数: ${sample.combo_3.length} (预期10个)`);
            console.log(`4码组合数: ${sample.combo_4.length} (预期5个)`);
            console.log(`2码示例: ${sample.combo_2.slice(0, 3).join(', ')}...`);
            console.log(`3码示例: ${sample.combo_3.slice(0, 3).join(', ')}...`);
            console.log(`4码示例: ${sample.combo_4.slice(0, 3).join(', ')}...`);
        }

        console.log('\n✅ 所有操作完成！');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 生成失败:', error);
        process.exit(1);
    }
}
