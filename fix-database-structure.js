/**
 * 修复数据库结构问题
 * 步骤：
 * 1. 备份当前数据（遗漏值表）
 * 2. 从CSV重新导入正确的开奖号码数据
 * 3. 验证导入结果
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 定义正确的Schema
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

async function fixDatabase() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功\n');

        const hit_dlts = mongoose.model('hit_dlts', dltSchema);

        // 步骤1: 备份当前数据
        console.log('📦 步骤1: 备份当前数据...');
        const db = mongoose.connection.db;
        const oldCollection = db.collection('hit_dlts');
        const backupCount = await oldCollection.countDocuments();
        console.log(`   当前 hit_dlts 表有 ${backupCount} 条记录`);

        if (backupCount > 0) {
            console.log('   创建备份表 hit_dlts_backup_missing_values...');
            await db.collection('hit_dlts').aggregate([
                { $out: 'hit_dlts_backup_missing_values' }
            ]).toArray();
            console.log('   ✅ 备份完成\n');
        }

        // 步骤2: 清空现有数据
        console.log('🗑️  步骤2: 清空现有 hit_dlts 数据...');
        await hit_dlts.deleteMany({});
        console.log('   ✅ 数据已清空\n');

        // 步骤3: 从CSV导入正确数据
        const csvPath = path.resolve('E:\\HITdata\\BIGHIPPINESS\\BIGHAPPINESS.csv');
        console.log(`📥 步骤3: 从CSV导入数据`);
        console.log(`   文件路径: ${csvPath}\n`);

        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV文件不存在: ${csvPath}`);
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        console.log(`   文件总行数: ${lines.length}`);

        // 跳过表头
        const header = lines[0];
        console.log(`   表头: ${header}\n`);

        const dataLines = lines.slice(1);
        console.log(`   数据行数: ${dataLines.length}\n`);

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
                        console.warn(`   ⚠️  第 ${i + batch.indexOf(line) + 2} 行数据不完整，跳过`);
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
                        FirstPrizeCount: parseInt(values[10]) || 0,
                        FirstPrizeAmount: values[11].replace(/"/g, ''),
                        SecondPrizeCount: parseInt(values[12]) || 0,
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
                await hit_dlts.insertMany(records, { ordered: false });
                totalImported += records.length;
                console.log(`   ✅ 已导入: ${totalImported} / ${dataLines.length}`);
            }
        }

        console.log(`\n   ✅ 数据导入完成！共导入 ${totalImported} 条记录\n`);

        if (errors.length > 0) {
            console.log(`   ⚠️  错误记录 (${errors.length} 条):`);
            errors.slice(0, 10).forEach(err => {
                console.log(`      第 ${err.line} 行: ${err.error}`);
            });
        }

        // 步骤4: 验证导入结果
        console.log('\n✔️  步骤4: 验证导入结果...');
        const count = await hit_dlts.countDocuments();
        console.log(`   数据库记录总数: ${count}`);

        const earliest = await hit_dlts.findOne().sort({ Issue: 1 });
        console.log(`\n   最早期号: ${earliest.Issue} (ID=${earliest.ID})`);
        console.log(`   红球: [${earliest.Red1}, ${earliest.Red2}, ${earliest.Red3}, ${earliest.Red4}, ${earliest.Red5}]`);
        console.log(`   蓝球: [${earliest.Blue1}, ${earliest.Blue2}]`);

        const latest = await hit_dlts.findOne().sort({ Issue: -1 });
        console.log(`\n   最新期号: ${latest.Issue} (ID=${latest.ID})`);
        console.log(`   红球: [${latest.Red1}, ${latest.Red2}, ${latest.Red3}, ${latest.Red4}, ${latest.Red5}]`);
        console.log(`   蓝球: [${latest.Blue1}, ${latest.Blue2}]`);

        // 验证字段完整性
        const hasRed1 = await hit_dlts.countDocuments({ Red1: { $exists: true } });
        const hasBlue1 = await hit_dlts.countDocuments({ Blue1: { $exists: true } });

        console.log(`\n   字段验证:`);
        console.log(`   - Red1字段: ${hasRed1} / ${count} (${hasRed1 === count ? '✅' : '❌'})`);
        console.log(`   - Blue1字段: ${hasBlue1} / ${count} (${hasBlue1 === count ? '✅' : '❌'})`);

        if (hasRed1 === count && hasBlue1 === count) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('✅ 数据库修复成功！');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('\n下一步操作：');
            console.log('1. 在管理后台点击"一键更新全部数据表"');
            console.log('2. 等待所有步骤完成（预计1-3分钟）');
            console.log('3. 验证数据完整性通过');
            console.log('═══════════════════════════════════════════════════════════════\n');
        } else {
            console.log('\n⚠️  数据验证未完全通过，请检查CSV文件格式');
        }

    } catch (error) {
        console.error('\n❌ 修复失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

fixDatabase();
