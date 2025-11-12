// 测试导入新期号 25122 和 25123
const http = require('http');

const API_BASE_URL = 'http://localhost:3003';

// 测试数据 - 25122 和 25123 期（虚构数据用于测试）
const testData = `ID    Issue    Red1    Red2    Red3    Red4    Red5    Blue1    Blue2    PoolPrize    FirstPrizeCount    FirstPrizeAmount    SecondPrizeCount    SecondPrizeAmount    TotalSales    DrawDate
2790    25122    5    10    15    20    25    3    9    1,250,000,000    12    8,500,000    120    140,000    360,000,000    10/28/2025
2791    25123    7    14    21    28    35    6    11    1,300,000,000    15    7,800,000    135    125,000    370,000,000    10/30/2025`;

// 解析批量数据 (与前端逻辑一致)
function parseBatchData(text) {
    const lines = text.trim().split('\n');
    const records = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // 跳过第一行（表头）
        if (index === 0 && line.includes('Issue') && line.includes('DrawDate')) {
            console.log(`✓ 跳过表头行`);
            return;
        }

        const fields = line.trim().split(/\s+/);

        if (fields.length < 16) {
            console.log(`第${lineNum}行: 字段不足（需要16个，实际${fields.length}个）`);
            return;
        }

        try {
            // 日期格式转换: MM/DD/YYYY → YYYY-MM-DD
            let formattedDate;
            if (fields[15].includes('/')) {
                const dateParts = fields[15].split('/');
                formattedDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
            } else {
                formattedDate = fields[15];
            }

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
                PoolPrize: fields[9].replace(/,/g, ''),
                FirstPrizeCount: parseInt(fields[10]),
                FirstPrizeAmount: fields[11].replace(/,/g, ''),
                SecondPrizeCount: parseInt(fields[12]),
                SecondPrizeAmount: fields[13].replace(/,/g, ''),
                TotalSales: fields[14].replace(/,/g, ''),
                DrawDate: formattedDate
            };

            records.push(record);
            console.log(`✓ 解析成功: ID ${record.ID}, 期号 ${record.Issue}, 红球 ${record.Red1}-${record.Red2}-${record.Red3}-${record.Red4}-${record.Red5}, 蓝球 ${record.Blue1}-${record.Blue2}`);
        } catch (err) {
            console.log(`第${lineNum}行: 解析错误 - ${err.message}`);
        }
    });

    return records;
}

// 发送POST请求
function postData(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);

        const options = {
            hostname: 'localhost',
            port: 3003,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('无法解析响应: ' + body));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function runTest() {
    console.log('========== 导入新期号 25122 和 25123 ==========\n');

    // 1. 解析测试数据
    console.log('步骤1: 解析测试数据');
    const records = parseBatchData(testData);
    console.log(`解析完成，共 ${records.length} 条记录\n`);

    // 2. 检查重复期号
    console.log('步骤2: 检查重复期号');
    try {
        const issues = records.map(r => r.Issue);
        const checkResult = await postData('/api/dlt/check-duplicates', { issues });

        if (checkResult.success) {
            console.log(`✓ 检查完成，发现 ${checkResult.duplicates.length} 个重复期号`);
            if (checkResult.duplicates.length > 0) {
                console.log('重复期号:', checkResult.duplicates.map(d => d.Issue).join(', '));
            }
        } else {
            console.log(`✗ 检查失败: ${checkResult.message}`);
            return;
        }
        console.log('');

        // 3. 执行批量导入 (覆盖模式)
        console.log('步骤3: 执行批量导入（覆盖模式）');
        const importResult = await postData('/api/dlt/batch-import', {
            records,
            action: 'overwrite'
        });

        if (importResult.success) {
            console.log(`✓ 导入成功!`);
            console.log(`  - 新增: ${importResult.inserted} 条`);
            console.log(`  - 更新: ${importResult.updated} 条`);
            console.log(`  - 总计: ${importResult.imported} 条`);
            if (importResult.errors && importResult.errors.length > 0) {
                console.log(`  - 失败: ${importResult.errors.length} 条`);
                importResult.errors.forEach(err => {
                    console.log(`    期号 ${err.issue}: ${err.error}`);
                });
            }
        } else {
            console.log(`✗ 导入失败: ${importResult.message}`);
        }

        // 4. 验证导入结果
        console.log('\n步骤4: 验证数据是否已成功导入');
        const mongoose = require('mongoose');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        const DLT = mongoose.model('HIT_DLT', new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT' }));

        const check122 = await DLT.findOne({ Issue: '25122' }).lean();
        const check123 = await DLT.findOne({ Issue: '25123' }).lean();

        console.log('期号 25122:', check122 ? '✅ 已存在' : '❌ 不存在');
        console.log('期号 25123:', check123 ? '✅ 已存在' : '❌ 不存在');

        if (check122) {
            console.log(`  红球: ${check122.Red1} ${check122.Red2} ${check122.Red3} ${check122.Red4} ${check122.Red5}`);
            console.log(`  蓝球: ${check122.Blue1} ${check122.Blue2}`);
        }
        if (check123) {
            console.log(`  红球: ${check123.Red1} ${check123.Red2} ${check123.Red3} ${check123.Red4} ${check123.Red5}`);
            console.log(`  蓝球: ${check123.Blue1} ${check123.Blue2}`);
        }

        await mongoose.connection.close();

    } catch (error) {
        console.error('测试失败:', error.message);
    }

    console.log('\n========== 测试完成 ==========');
}

// 运行测试
runTest();
