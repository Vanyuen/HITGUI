/**
 * 统一更新所有大乐透相关数据表
 * 模式:
 *   - full: 全量更新（清空HIT_DLT重新导入）
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

// HIT_DLT Schema
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

const DLT = mongoose.model('HIT_DLT', dltSchema);

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

// 步骤1: 导入CSV到HIT_DLT
async function importCSVToHIT_DLT(csvPath) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📦 步骤1/4: 导入CSV到HIT_DLT表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // 跳过表头

    console.log(`📊 CSV文件: ${path.basename(csvPath)}`);
    console.log(`📊 数据行数: ${dataLines.length}\n`);

    console.log('🗑️  清空现有数据...');
    await DLT.deleteMany({});
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
            await DLT.insertMany(records, { ordered: false });
            totalImported += records.length;
            console.log(`   已导入: ${totalImported} / ${dataLines.length}`);
        }
    }

    console.log(`\n✅ HIT_DLT导入完成，共 ${totalImported} 条记录\n`);
    return totalImported;
}

// 步骤2: 生成遗漏值表
async function generateMissingTables() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔄 步骤2/4: 生成遗漏值表');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allRecords = await DLT.find({}).sort({ Issue: 1 }).lean();
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
    await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').deleteMany({});

    console.log('💾 插入新的遗漏值数据...\n');
    const batchSize = 500;

    for (let i = 0; i < redMissingRecords.length; i += batchSize) {
        const batch = redMissingRecords.slice(i, i + batchSize);
        await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').insertMany(batch);
        console.log(`   红球遗漏: ${Math.min(i + batchSize, redMissingRecords.length)} / ${redMissingRecords.length}`);
    }

    for (let i = 0; i < blueMissingRecords.length; i += batchSize) {
        const batch = blueMissingRecords.slice(i, i + batchSize);
        await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').insertMany(batch);
        console.log(`   蓝球遗漏: ${Math.min(i + batchSize, blueMissingRecords.length)} / ${blueMissingRecords.length}`);
    }

    console.log(`\n✅ 遗漏值表生成完成\n`);
}

// 步骤3: 清理过期缓存
async function cleanupExpiredCache() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧹 步骤3/4: 清理过期缓存');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const latestIssue = await DLT.findOne({}).sort({ Issue: -1 }).select('Issue');
    const latestIssueNum = latestIssue ? latestIssue.Issue : 0;

    console.log(`📊 最新期号: ${latestIssueNum}`);
    console.log(`🗑️  清理目标期号 < ${latestIssueNum} 的缓存...\n`);

    const result = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcolds').deleteMany({
        target_issue: { $lt: latestIssueNum.toString() }
    });

    console.log(`✅ 已清理 ${result.deletedCount} 条过期缓存\n`);
}

// 步骤4: 验证数据
async function verifyData() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✔️  步骤4/4: 验证数据完整性');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const dltCount = await DLT.countDocuments();
    const dltLatest = await DLT.findOne({}).sort({ Issue: -1 });

    const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    const blueMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();

    console.log(`📊 HIT_DLT: ${dltCount} 期，最新期号 ${dltLatest?.Issue}`);
    console.log(`📊 红球遗漏: ${redMissingCount} 期`);
    console.log(`📊 蓝球遗漏: ${blueMissingCount} 期\n`);

    if (dltCount === redMissingCount && dltCount === blueMissingCount) {
        console.log('✅ 数据完整性验证通过！\n');
        return true;
    } else {
        console.log('⚠️  数据不一致，请检查！\n');
        return false;
    }
}

// 主函数
async function updateAllTables(mode, csvPath) {
    try {
        await connectDB();

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🚀 开始统一更新大乐透数据表');
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
