/**
 * 导入正确格式的大乐透数据到 hit_dlts 表
 * 运行: node import-correct-data.js
 */
const fs = require('fs');
const mongoose = require('mongoose');

const CSV_PATH = 'E:\\HITdata\\BIGHIPPINESS\\BIGHAPPINESS.csv';

// 定义完整的 Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: String },
    Red1: Number, Red2: Number, Red3: Number, Red4: Number, Red5: Number,
    Blue1: Number, Blue2: Number,
    PoolPrize: String,
    FirstPrizeCount: Number,
    FirstPrizeAmount: String,
    SecondPrizeCount: Number,
    SecondPrizeAmount: String,
    TotalSales: String,
    DrawDate: Date,
    statistics: {
        frontSum: Number,
        frontSpan: Number,
        frontHotWarmColdRatio: String,
        frontZoneRatio: String,
        frontOddEvenRatio: String,
        frontAcValue: Number,
        backSum: Number,
        backOddEvenRatio: String,
        consecutiveCount: Number,
        repeatCount: Number
    },
    updatedAt: Date
}, { collection: 'hit_dlts' });

// AC值计算函数
function calculateACValue(balls) {
    const sorted = [...balls].sort((a, b) => a - b);
    const differences = new Set();
    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            differences.add(sorted[j] - sorted[i]);
        }
    }
    return differences.size - (sorted.length - 1);
}

// 解析日期
function parseDrawDate(dateStr) {
    // 格式: "12/6/2025" -> Date
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
    }
    return new Date(dateStr);
}

async function importData() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const HitDlt = mongoose.model('hit_dlts', dltSchema);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📥 导入正确格式的大乐透数据');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 读取 CSV 文件
    console.log(`📂 读取文件: ${CSV_PATH}`);
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = csvContent.trim().split('\n');

    // 跳过表头
    const header = lines[0];
    console.log(`📋 表头: ${header}\n`);

    const dataLines = lines.slice(1);
    console.log(`📊 数据行数: ${dataLines.length}\n`);

    // 解析所有记录
    const records = [];
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        // CSV 解析（处理带逗号的数字字段）
        const fields = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current);

        try {
            const record = {
                ID: parseInt(fields[0]),
                Issue: fields[1],
                Red1: parseInt(fields[2]),
                Red2: parseInt(fields[3]),
                Red3: parseInt(fields[4]),
                Red4: parseInt(fields[5]),
                Red5: parseInt(fields[6]),
                Blue1: parseInt(fields[7]),
                Blue2: parseInt(fields[8]),
                PoolPrize: fields[9] ? fields[9].replace(/,/g, '') : '',
                FirstPrizeCount: parseInt(fields[10]) || 0,
                FirstPrizeAmount: fields[11] ? fields[11].replace(/,/g, '') : '',
                SecondPrizeCount: parseInt(fields[12]) || 0,
                SecondPrizeAmount: fields[13] ? fields[13].replace(/,/g, '') : '',
                TotalSales: fields[14] ? fields[14].replace(/,/g, '') : '',
                DrawDate: parseDrawDate(fields[15])
            };

            // 验证必填字段
            if (isNaN(record.ID) || isNaN(record.Red1) || isNaN(record.Blue1)) {
                errors.push({ line: i + 2, reason: '字段解析失败', data: line.substring(0, 100) });
                continue;
            }

            // 验证红球范围 (1-35)
            const reds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            if (reds.some(r => r < 1 || r > 35)) {
                errors.push({ line: i + 2, reason: '红球超出范围', data: reds.join(',') });
                continue;
            }

            // 验证蓝球范围 (1-12)
            const blues = [record.Blue1, record.Blue2];
            if (blues.some(b => b < 1 || b > 12)) {
                errors.push({ line: i + 2, reason: '蓝球超出范围', data: blues.join(',') });
                continue;
            }

            records.push(record);
        } catch (err) {
            errors.push({ line: i + 2, reason: err.message, data: line.substring(0, 100) });
        }
    }

    console.log(`✅ 成功解析: ${records.length} 条`);
    if (errors.length > 0) {
        console.log(`⚠️  解析失败: ${errors.length} 条`);
        errors.slice(0, 5).forEach(e => console.log(`   行 ${e.line}: ${e.reason}`));
    }

    // 按 ID 排序（升序）
    records.sort((a, b) => a.ID - b.ID);

    // 清空现有数据并导入
    console.log('\n🗑️  清空现有 hit_dlts 数据...');
    await HitDlt.deleteMany({});

    console.log('📥 批量导入新数据...\n');

    // 分批导入
    const batchSize = 500;
    let importedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await HitDlt.insertMany(batch, { ordered: false });
        importedCount += batch.length;
        console.log(`📈 进度: ${importedCount}/${records.length} (${(importedCount / records.length * 100).toFixed(1)}%)`);
    }

    console.log(`\n✅ 数据导入完成，共 ${importedCount} 条记录\n`);

    // 验证导入结果
    const verifyCount = await HitDlt.countDocuments();
    const sampleRecord = await HitDlt.findOne({ ID: records[records.length - 1].ID }).lean();

    console.log('📊 验证结果:');
    console.log(`   总记录数: ${verifyCount}`);
    console.log(`   最新记录 ID: ${sampleRecord?.ID}, Issue: ${sampleRecord?.Issue}`);
    console.log(`   红球: ${sampleRecord?.Red1} ${sampleRecord?.Red2} ${sampleRecord?.Red3} ${sampleRecord?.Red4} ${sampleRecord?.Red5}`);
    console.log(`   蓝球: ${sampleRecord?.Blue1} ${sampleRecord?.Blue2}`);

    await mongoose.disconnect();
    console.log('\n✅ 导入完成！');
}

importData().catch(err => {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
});
