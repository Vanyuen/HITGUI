/**
 * 从CSV文件导入大乐透开奖数据
 * CSV字段: ID,Issue,Red1,Red2,Red3,Red4,Red5,Blue1,Blue2,PoolPrize,FirstPrizeCount,FirstPrizeAmount,SecondPrizeCount,SecondPrizeAmount,TotalSales,DrawDate
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 连接数据库
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功');
}

// 定义Schema（与server.js保持一致）
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: Number, required: true, unique: true },
    Red1: { type: Number, required: true, min: 1, max: 35 },
    Red2: { type: Number, required: true, min: 1, max: 35 },
    Red3: { type: Number, required: true, min: 1, max: 35 },
    Red4: { type: Number, required: true, min: 1, max: 35 },
    Red5: { type: Number, required: true, min: 1, max: 35 },
    Blue1: { type: Number, required: true, min: 1, max: 12 },
    Blue2: { type: Number, required: true, min: 1, max: 12 },
    PoolPrize: { type: String },
    FirstPrizeCount: { type: Number },
    FirstPrizeAmount: { type: String },
    SecondPrizeCount: { type: Number },
    SecondPrizeAmount: { type: String },
    TotalSales: { type: String },
    DrawDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
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

// 解析日期 (格式: 9/29/2025 -> 2025-09-29)
function parseDate(dateStr) {
    const [month, day, year] = dateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
}

// 导入CSV数据
async function importCSV(csvPath) {
    try {
        await connectDB();

        console.log(`\n开始读取CSV文件: ${csvPath}\n`);

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        console.log(`📊 文件总行数: ${lines.length}`);

        // 跳过表头
        const header = lines[0];
        console.log(`📋 表头: ${header}\n`);

        const dataLines = lines.slice(1);
        console.log(`📊 数据行数: ${dataLines.length}\n`);

        // 清空现有数据
        console.log('🗑️  清空现有数据...');
        await DLT.deleteMany({});
        console.log('✅ 数据已清空\n');

        // 批量插入数据
        const batchSize = 100;
        let totalImported = 0;
        let errors = [];

        for (let i = 0; i < dataLines.length; i += batchSize) {
            const batch = dataLines.slice(i, i + batchSize);
            const records = [];

            for (const line of batch) {
                try {
                    const values = parseCSVLine(line);

                    if (values.length < 16) {
                        console.warn(`⚠️  第 ${i + batch.indexOf(line) + 2} 行数据不完整，跳过`);
                        continue;
                    }

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
                    errors.push({ line: i + batch.indexOf(line) + 2, error: error.message });
                }
            }

            if (records.length > 0) {
                await DLT.insertMany(records, { ordered: false });
                totalImported += records.length;
                console.log(`✅ 已导入: ${totalImported} / ${dataLines.length}`);
            }
        }

        console.log(`\n✅ 数据导入完成！`);
        console.log(`📊 总共导入: ${totalImported} 条记录`);

        if (errors.length > 0) {
            console.log(`\n⚠️  错误记录 (${errors.length} 条):`);
            errors.slice(0, 10).forEach(err => {
                console.log(`   第 ${err.line} 行: ${err.error}`);
            });
            if (errors.length > 10) {
                console.log(`   ... 还有 ${errors.length - 10} 条错误`);
            }
        }

        // 验证结果
        console.log('\n验证导入结果:');
        const count = await DLT.countDocuments();
        console.log(`📊 数据库记录总数: ${count}`);

        const sample = await DLT.findOne().sort({ Issue: 1 });
        console.log('\n示例记录（最早期号）:');
        console.log(JSON.stringify(sample, null, 2));

        const latest = await DLT.findOne().sort({ Issue: -1 });
        console.log('\n示例记录（最新期号）:');
        console.log(JSON.stringify(latest, null, 2));

    } catch (error) {
        console.error('❌ 导入失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

// 执行导入
const csvPath = path.resolve('E:\\HITdata\\BIGHIPPINESS\\BIGHAPPINESS.csv');
importCSV(csvPath);
