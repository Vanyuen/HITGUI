// 测试批量导入功能
const http = require('http');

const API_BASE_URL = 'http://localhost:3003';

// 测试数据 (从用户提供的新格式示例提取 - 包含表头)
const testData = `ID    Issue    Red1    Red2    Red3    Red4    Red5    Blue1    Blue2    PoolPrize    FirstPrizeCount    FirstPrizeAmount    SecondPrizeCount    SecondPrizeAmount    TotalSales    DrawDate
2789    25121    2    3    8    13    21    7    12    1,201,113,535    10    9,198,484    114    150,688    356,833,346    10/25/2025
2788    25120    11    13    22    26    35    2    8    1,229,721,100    8    9,990,487    113    132,079    325,832,725    10/22/2025`;

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
                ID: parseInt(fields[0]),                 // 位置1
                Issue: fields[1],                        // 位置2
                Red1: parseInt(fields[2]),              // 位置3
                Red2: parseInt(fields[3]),              // 位置4
                Red3: parseInt(fields[4]),              // 位置5
                Red4: parseInt(fields[5]),              // 位置6
                Red5: parseInt(fields[6]),              // 位置7
                Blue1: parseInt(fields[7]),             // 位置8
                Blue2: parseInt(fields[8]),             // 位置9
                PoolPrize: fields[9].replace(/,/g, ''),  // 位置10
                FirstPrizeCount: parseInt(fields[10]),   // 位置11
                FirstPrizeAmount: fields[11].replace(/,/g, ''), // 位置12
                SecondPrizeCount: parseInt(fields[12]),  // 位置13
                SecondPrizeAmount: fields[13].replace(/,/g, ''), // 位置14
                TotalSales: fields[14].replace(/,/g, ''), // 位置15
                DrawDate: formattedDate                  // 位置16
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
    console.log('========== 批量导入功能测试 ==========\n');

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

    } catch (error) {
        console.error('测试失败:', error.message);
    }

    console.log('\n========== 测试完成 ==========');
}

// 运行测试
runTest();
