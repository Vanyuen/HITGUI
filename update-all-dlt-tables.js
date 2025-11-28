/**
 * 统一更新所有大乐透相关数据表
 * 模式:
 *   - full: 全量更新（清空hit_dlts重新导入）
 *   - repair: 快速修复（仅重新生成衍生数据）
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 连接数据库
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');
}

// hit_dlts Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: Number, required: true, unique: true },
    Red1: { type: Number, required: true },
    Red2: { type: Number, required: true },
    Red3: { type: Number, required: true },
    Red4: { type: Number, required: true },
    Red5: { type: Number, required: true },
    Blue1: { type: Number, required: true },
    Blue2: { type: Number, required: true },
    PoolPrize: { type: String },
    FirstPrizeCount: { type: Number },
    FirstPrizeAmount: { type: String },
    SecondPrizeCount: { type: Number },
    SecondPrizeAmount: { type: String },
    TotalSales: { type: String },
    DrawDate: { type: Date, required: true }
});

const hit_dlts = mongoose.model('hit_dlts', dltSchema);

// DLTComboFeatures Schema
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

// DLTRedCombinationsHotWarmColdOptimized Schema - 热温冷比优化表
const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    base_issue: { type: String, required: true },
    target_issue: { type: String, required: true },
    hot_warm_cold_data: {
        type: Map,
        of: [Number], // 每个比例对应的combination_id数组
        required: true
    },
    total_combinations: { type: Number, required: true },
    hit_analysis: {
        target_winning_reds: [Number],
        target_winning_blues: [Number],
        red_hit_data: {
            type: Map,
            of: [Number]
        },
        hit_statistics: {
            hit_0: { type: Number, default: 0 },
            hit_1: { type: Number, default: 0 },
            hit_2: { type: Number, default: 0 },
            hit_3: { type: Number, default: 0 },
            hit_4: { type: Number, default: 0 },
            hit_5: { type: Number, default: 0 }
        },
        is_drawn: { type: Boolean, default: false }
    },
    statistics: {
        ratio_counts: {
            type: Map,
            of: Number
        }
    },
    created_at: { type: Date, default: Date.now }
});

dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ target_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1, target_issue: 1 }, { unique: true });

const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    dltRedCombinationsHotWarmColdOptimizedSchema
);

// DLTRedCombination Schema - 红球组合表
const dltRedCombinationSchema = new mongoose.Schema({
    combination_id: { type: Number, required: true, unique: true },
    red_ball_1: { type: Number, required: true },
    red_ball_2: { type: Number, required: true },
    red_ball_3: { type: Number, required: true },
    red_ball_4: { type: Number, required: true },
    red_ball_5: { type: Number, required: true }
});

let DLTRedCombination;
try {
    DLTRedCombination = mongoose.model('hit_dlts');
} catch (err) {
    DLTRedCombination = mongoose.model('hit_dlts', dltRedCombinationSchema);
}

// 组合特征生成工具函数
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

// 解析CSV行
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// 解析日期
function parseDate(dateStr) {
    const [month, day, year] = dateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
}

// 计算热温冷比
function calculateHotWarmColdRatio(missingValues) {
    let hot = 0, warm = 0, cold = 0;
    missingValues.forEach(missing => {
        if (missing <= 4) hot++;
        else if (missing <= 9) warm++;
        else cold++;
    });
    return `${hot}:${warm}:${cold}`;
}

// 步骤1: 导入CSV到hit_dlts
async function importCSVToHIT_DLT(csvPath) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📦 步骤1/4: 导入CSV到hit_dlts表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // 跳过表头

    console.log(`📊 CSV文件: ${path.basename(csvPath)}`);
    console.log(`📊 数据行数: ${dataLines.length}\n`);

    console.log('🗑️  清空现有数据...');
    await hit_dlts.deleteMany({});
    console.log('✅ 数据已清空\n');

    const batchSize = 100;
    let totalImported = 0;

    for (let i = 0; i < dataLines.length; i += batchSize) {
        const batch = dataLines.slice(i, i + batchSize);
        const records = [];

        for (const line of batch) {
            try {
                const values = parseCSVLine(line);
                if (values.length < 16) continue;

                const record = {
                    ID: parseInt(values[0]),
                    Issue: parseInt(values[1]),
                    Red1: parseInt(values[2]),
                    Red2: parseInt(values[3]),
                    Red3: parseInt(values[4]),
                    Red4: parseInt(values[5]),
                    Red5: parseInt(values[6]),
                    Blue1: parseInt(values[7]),
                    Blue2: parseInt(values[8]),
                    PoolPrize: values[9].replace(/"/g, ''),
                    FirstPrizeCount: parseInt(values[10]),
                    FirstPrizeAmount: values[11].replace(/"/g, ''),
                    SecondPrizeCount: parseInt(values[12]),
                    SecondPrizeAmount: values[13].replace(/"/g, ''),
                    TotalSales: values[14].replace(/"/g, ''),
                    DrawDate: parseDate(values[15])
                };

                records.push(record);
            } catch (error) {
                console.warn(`⚠️  跳过无效行: ${error.message}`);
            }
        }

        if (records.length > 0) {
            await hit_dlts.insertMany(records, { ordered: false });
            totalImported += records.length;
            console.log(`   已导入: ${totalImported} / ${dataLines.length}`);
        }
    }

    console.log(`\n✅ hit_dlts导入完成，共 ${totalImported} 条记录\n`);
    return totalImported;
}

// 步骤2: 生成遗漏值表
async function generateMissingTables() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔄 步骤2/4: 生成遗漏值表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allRecords = await hit_dlts.find({}).sort({ Issue: 1 }).lean();
    console.log(`📊 基于 ${allRecords.length} 期数据生成遗漏值\n`);

    const redMissing = Array(35).fill(0);
    const blueMissing = Array(12).fill(0);
    const redMissingRecords = [];
    const blueMissingRecords = [];

    for (let i = 0; i < allRecords.length; i++) {
        const record = allRecords[i];
        const drawnReds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const drawnBlues = [record.Blue1, record.Blue2];

        for (let j = 0; j < 35; j++) redMissing[j]++;
        for (let j = 0; j < 12; j++) blueMissing[j]++;

        drawnReds.forEach(ball => { redMissing[ball - 1] = 0; });
        drawnBlues.forEach(ball => { blueMissing[ball - 1] = 0; });

        const hotWarmColdRatio = calculateHotWarmColdRatio(redMissing);

        const redRecord = {
            ID: record.ID,
            Issue: record.Issue.toString(),
            DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : '',
            FrontHotWarmColdRatio: hotWarmColdRatio
        };
        for (let j = 0; j < 35; j++) {
            redRecord[(j + 1).toString()] = redMissing[j];
        }
        redMissingRecords.push(redRecord);

        const blueRecord = {
            ID: record.ID,
            Issue: record.Issue.toString(),
            DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : ''
        };
        for (let j = 0; j < 12; j++) {
            blueRecord[(j + 1).toString()] = blueMissing[j];
        }
        blueMissingRecords.push(blueRecord);

        if ((i + 1) % 500 === 0) {
            console.log(`   处理进度: ${i + 1} / ${allRecords.length}`);
        }
    }

    console.log(`\n🗑️  清空旧的遗漏值数据...`);
    await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').deleteMany({});
    await mongoose.connection.db.collection('hit_dlts').deleteMany({});

    console.log('💾 插入新的遗漏值数据...\n');
    const batchSize = 500;

    for (let i = 0; i < redMissingRecords.length; i += batchSize) {
        const batch = redMissingRecords.slice(i, i + batchSize);
        await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').insertMany(batch);
        console.log(`   红球遗漏: ${Math.min(i + batchSize, redMissingRecords.length)} / ${redMissingRecords.length}`);
    }

    for (let i = 0; i < blueMissingRecords.length; i += batchSize) {
        const batch = blueMissingRecords.slice(i, i + batchSize);
        await mongoose.connection.db.collection('hit_dlts').insertMany(batch);
        console.log(`   蓝球遗漏: ${Math.min(i + batchSize, blueMissingRecords.length)} / ${blueMissingRecords.length}`);
    }

    console.log(`\n✅ 遗漏值表生成完成\n`);
}

// 步骤3: 生成组合特征表
async function generateComboFeatures() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔄 步骤3/5: 生成组合特征表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allRecords = await hit_dlts.find({}).sort({ ID: 1 }).lean();
    console.log(`📊 基于 ${allRecords.length} 期数据生成组合特征\n`);

    const batchSize = 100;
    let successCount = 0;
    let updateCount = 0;

    for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, Math.min(i + batchSize, allRecords.length));
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
                            Issue: record.Issue.toString(),
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

        if (bulkOps.length > 0) {
            const result = await DLTComboFeatures.bulkWrite(bulkOps, { ordered: false });
            successCount += result.upsertedCount;
            updateCount += result.modifiedCount;

            const progress = Math.min(i + batchSize, allRecords.length);
            console.log(`   处理进度: ${progress} / ${allRecords.length} - 新增: ${successCount}, 更新: ${updateCount}`);
        }
    }

    console.log(`\n✅ 组合特征表生成完成，新增: ${successCount}, 更新: ${updateCount}\n`);
}

// 步骤4: 清理过期缓存
async function cleanupExpiredCache() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧹 步骤4/5: 清理过期缓存');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const latestIssue = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('Issue');
    const latestIssueNum = latestIssue ? latestIssue.Issue : 0;

    console.log(`📊 最新期号: ${latestIssueNum}`);
    console.log(`🗑️  清理目标期号 < ${latestIssueNum} 的缓存...\n`);

    const result = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcolds').deleteMany({
        target_issue: { $lt: latestIssueNum.toString() }
    });

    console.log(`✅ 已清理 ${result.deletedCount} 条过期缓存\n`);
}

// 步骤5: 生成热温冷比优化表
async function generateHotWarmColdOptimizedTable() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔥 步骤5/6: 生成热温冷比优化表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const startTime = Date.now();

    // 获取所有期号（按升序）
    const allIssues = await hit_dlts.find({}).sort({ Issue: 1 }).lean();
    console.log(`📊 找到 ${allIssues.length} 期数据\n`);

    if (allIssues.length < 2) {
        console.log('⚠️  数据不足（需要至少2期），跳过热温冷比生成\n');
        return;
    }

    // 获取所有红球组合（324,632个）
    console.log('📥 加载红球组合数据...');
    const allRedCombinations = await DLTRedCombination.find({}).lean();

    if (!allRedCombinations || allRedCombinations.length === 0) {
        console.log('⚠️  红球组合表为空！请先运行 generate-all-combinations.js\n');
        return;
    }

    console.log(`   加载了 ${allRedCombinations.length} 个红球组合\n`);

    // 批量生成：每次处理一个目标期号
    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 开始批量生成热温冷比数据...\n');

    for (let i = 1; i < allIssues.length; i++) {
        const baseIssue = allIssues[i - 1]; // 前一期作为基准期
        const targetIssue = allIssues[i];   // 当前期作为目标期

        const baseIssueStr = baseIssue.Issue.toString();
        const targetIssueStr = targetIssue.Issue.toString();

        try {
            // 检查是否已存在
            const existing = await DLTRedCombinationsHotWarmColdOptimized.findOne({
                base_issue: baseIssueStr,
                target_issue: targetIssueStr
            });

            if (existing) {
                skippedCount++;
                processedCount++;
                continue;
            }

            // 获取基准期的红球遗漏值
            const baseMissingRecord = await mongoose.connection.db
                .collection('hit_dlt_basictrendchart_redballmissing_histories')
                .findOne({ ID: baseIssue.ID });

            if (!baseMissingRecord) {
                console.log(`⚠️  跳过（无遗漏数据）: 基准=${baseIssueStr}, 目标=${targetIssueStr}`);
                errorCount++;
                processedCount++;
                continue;
            }

            // 计算每个组合的热温冷比
            const hotWarmColdMap = new Map(); // 比例 -> [combination_id, ...]

            for (const combo of allRedCombinations) {
                const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

                // 获取每个红球的遗漏值
                const missingValues = balls.map(ball => {
                    const key = String(ball);
                    return baseMissingRecord[key] || 0;
                });

                // 计算热温冷比（遗漏值≤4为热号, 5-9为温号, ≥10为冷号）
                let hot = 0, warm = 0, cold = 0;
                missingValues.forEach(missing => {
                    if (missing <= 4) hot++;
                    else if (missing <= 9) warm++;
                    else cold++;
                });

                const ratio = `${hot}:${warm}:${cold}`;

                // 按比例分组
                if (!hotWarmColdMap.has(ratio)) {
                    hotWarmColdMap.set(ratio, []);
                }
                hotWarmColdMap.get(ratio).push(combo.combination_id);
            }

            // 转换为普通对象（MongoDB Map格式）
            const hotWarmColdData = {};
            const ratioCounts = {};
            for (const [ratio, combinationIds] of hotWarmColdMap.entries()) {
                hotWarmColdData[ratio] = combinationIds;
                ratioCounts[ratio] = combinationIds.length;
            }

            // 保存到数据库
            await DLTRedCombinationsHotWarmColdOptimized.create({
                base_issue: baseIssueStr,
                target_issue: targetIssueStr,
                hot_warm_cold_data: hotWarmColdData,
                total_combinations: allRedCombinations.length,
                hit_analysis: {
                    target_winning_reds: [targetIssue.Red1, targetIssue.Red2, targetIssue.Red3, targetIssue.Red4, targetIssue.Red5],
                    target_winning_blues: [targetIssue.Blue1, targetIssue.Blue2],
                    red_hit_data: {},
                    hit_statistics: {
                        hit_0: 0,
                        hit_1: 0,
                        hit_2: 0,
                        hit_3: 0,
                        hit_4: 0,
                        hit_5: 0
                    },
                    is_drawn: true
                },
                statistics: {
                    ratio_counts: ratioCounts
                }
            });

            createdCount++;
            processedCount++;

            // 每10期输出一次进度
            if (processedCount % 10 === 0) {
                const progress = ((processedCount / (allIssues.length - 1)) * 100).toFixed(1);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`📈 进度: ${progress}% (${processedCount}/${allIssues.length - 1}期), 新建${createdCount}条, 跳过${skippedCount}条, 耗时${elapsed}秒`);
            }

        } catch (error) {
            console.log(`❌ 处理失败 - 基准=${baseIssueStr}, 目标=${targetIssueStr}: ${error.message}`);
            errorCount++;
            processedCount++;
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ 热温冷比生成完成!`);
    console.log(`   处理: ${processedCount}期`);
    console.log(`   新建: ${createdCount}条`);
    console.log(`   跳过: ${skippedCount}条`);
    console.log(`   错误: ${errorCount}条`);
    console.log(`   耗时: ${totalTime}秒\n`);
}

// 步骤6: 验证数据
async function verifyData() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✔️  步骤6/6: 验证数据完整性');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const dltCount = await hit_dlts.countDocuments();
    const dltLatest = await hit_dlts.findOne({}).sort({ Issue: -1 });

    const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    const blueMissingCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
    const comboFeaturesCount = await DLTComboFeatures.countDocuments();
    const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();

    console.log(`📊 hit_dlts: ${dltCount} 期，最新期号 ${dltLatest?.Issue}`);
    console.log(`📊 红球遗漏: ${redMissingCount} 期`);
    console.log(`📊 蓝球遗漏: ${blueMissingCount} 期`);
    console.log(`📊 组合特征: ${comboFeaturesCount} 期`);
    console.log(`📊 热温冷比: ${hwcOptimizedCount} 条\n`);

    const expectedHWCCount = dltCount > 0 ? dltCount - 1 : 0; // 期号数-1（第一期没有前一期基准）

    const allComplete =
        dltCount === redMissingCount &&
        dltCount === blueMissingCount &&
        dltCount === comboFeaturesCount &&
        hwcOptimizedCount === expectedHWCCount;

    if (allComplete) {
        console.log('✅ 数据完整性验证通过！\n');
        return true;
    } else {
        console.log('⚠️  数据不一致，请检查：');
        if (dltCount !== redMissingCount) {
            console.log(`   红球遗漏: 期望${dltCount}期, 实际${redMissingCount}期`);
        }
        if (dltCount !== blueMissingCount) {
            console.log(`   蓝球遗漏: 期望${dltCount}期, 实际${blueMissingCount}期`);
        }
        if (dltCount !== comboFeaturesCount) {
            console.log(`   组合特征: 期望${dltCount}期, 实际${comboFeaturesCount}期`);
        }
        if (hwcOptimizedCount !== expectedHWCCount) {
            console.log(`   热温冷比: 期望${expectedHWCCount}条, 实际${hwcOptimizedCount}条`);
        }
        console.log('\n');
        return false;
    }
}

// 主函数
async function updateAllTables(mode, csvPath) {
    try {
        await connectDB();

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🚀 开始统一更新大乐透数据表（包含热温冷比）');
        console.log(`   模式: ${mode === 'full' ? '全量更新' : '快速修复'}`);
        console.log('═══════════════════════════════════════════════════════════════\n');

        const startTime = Date.now();

        if (mode === 'full') {
            if (!csvPath || !fs.existsSync(csvPath)) {
                throw new Error('CSV文件不存在: ' + csvPath);
            }
            await importCSVToHIT_DLT(csvPath);
        }

        await generateMissingTables();
        await generateComboFeatures();
        await generateHotWarmColdOptimizedTable();
        await cleanupExpiredCache();
        const isValid = await verifyData();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('═══════════════════════════════════════════════════════════════');
        if (isValid) {
            console.log(`✅ 更新完成！耗时 ${duration} 秒`);
        } else {
            console.log(`⚠️  更新完成但存在数据问题，耗时 ${duration} 秒`);
        }
        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ 更新失败:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

// 命令行参数解析
const args = process.argv.slice(2);
const mode = args[0] === '--repair' ? 'repair' : 'full';
const csvPath = args[1] || 'E:\\HITdata\\BIGHIPPINESS\\BIGHAPPINESS.csv';

// 执行更新
updateAllTables(mode, csvPath);
