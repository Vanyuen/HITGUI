/**
 * AC值功能测试脚本
 * 测试项目：
 * 1. 走势图API是否返回AC值
 * 2. 批量预测AC值排除功能
 * 3. AC值计算准确性验证
 */

const http = require('http');

// 工具函数：发送HTTP GET请求
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON: ' + data));
                }
            });
        }).on('error', reject);
    });
}

// 工具函数：发送HTTP POST请求
function httpPost(url, postData) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(postData);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(url, options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error('Invalid JSON: ' + responseData));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// 计算AC值（用于验证）
function calculateACValue(numbers) {
    if (!numbers || numbers.length < 2) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const differences = new Set();

    for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const diff = sorted[j] - sorted[i];
            differences.add(diff);
        }
    }

    const acValue = differences.size - (sorted.length - 1);
    return Math.max(0, acValue);
}

async function runTests() {
    console.log('='.repeat(80));
    console.log('AC值功能完整性测试');
    console.log('='.repeat(80));

    let passedTests = 0;
    let totalTests = 0;

    try {
        // 测试1: 走势图API返回AC值
        console.log('\n[测试1] 走势图API是否返回AC值');
        console.log('-'.repeat(80));
        totalTests++;

        const trendData = await httpGet('http://localhost:3003/api/dlt/trendchart?recentPeriods=5');

        if (!trendData.periods || trendData.periods.length === 0) {
            console.log('❌ 失败: 未获取到期号数据');
        } else {
            console.log(`✅ 获取到 ${trendData.periods.length} 期数据`);

            // 检查前3期的AC值
            let acValueFound = true;
            let acValueCorrect = true;

            for (let i = 0; i < Math.min(3, trendData.periods.length); i++) {
                const period = trendData.periods[i];
                const frontAcValue = period.statistics?.frontAcValue;

                if (frontAcValue === undefined) {
                    console.log(`❌ 期号 ${period.period}: AC值字段不存在`);
                    acValueFound = false;
                } else {
                    // 验证AC值计算是否正确
                    const expectedAC = calculateACValue(period.redBalls);
                    if (frontAcValue !== expectedAC) {
                        console.log(`❌ 期号 ${period.period}: AC值计算错误`);
                        console.log(`   号码: [${period.redBalls.join(',')}]`);
                        console.log(`   返回AC值: ${frontAcValue}, 期望AC值: ${expectedAC}`);
                        acValueCorrect = false;
                    } else {
                        console.log(`✅ 期号 ${period.period}: 号码=[${period.redBalls.join(',')}], AC值=${frontAcValue}`);
                    }
                }
            }

            if (acValueFound && acValueCorrect) {
                passedTests++;
                console.log('✅ 测试1通过: 走势图API正确返回AC值');
            } else {
                console.log('❌ 测试1失败');
            }
        }

        // 测试2: 批量预测 - AC值范围排除
        console.log('\n[测试2] 批量预测 - AC值范围排除功能');
        console.log('-'.repeat(80));
        totalTests++;

        const batchParams1 = {
            targetIssue: '2025001',
            excludeConditions: {
                ac: {
                    enabled: true,
                    ranges: [
                        { enabled: true, min: 0, max: 3 }  // 排除AC值0-3的组合
                    ]
                }
            }
        };

        const batchResult1 = await httpPost('http://localhost:3003/api/dlt/new-combination-prediction', batchParams1);

        if (batchResult1.error) {
            console.log(`❌ 失败: ${batchResult1.error}`);
        } else {
            console.log(`✅ 请求成功，返回 ${batchResult1.totalCount || batchResult1.combinations?.length || 0} 个组合`);

            // 验证返回的组合是否都不在排除范围内
            if (batchResult1.combinations && batchResult1.combinations.length > 0) {
                let allValid = true;
                const sampleSize = Math.min(5, batchResult1.combinations.length);

                for (let i = 0; i < sampleSize; i++) {
                    const combo = batchResult1.combinations[i];
                    const acValue = combo.acValue;

                    if (acValue >= 0 && acValue <= 3) {
                        console.log(`❌ 组合ID=${combo.id}: AC值=${acValue}，应该被排除但返回了`);
                        allValid = false;
                    } else {
                        console.log(`✅ 组合ID=${combo.id}: 号码=[${combo.numbers.join(',')}], AC值=${acValue} (未被排除)`);
                    }
                }

                if (allValid) {
                    passedTests++;
                    console.log('✅ 测试2通过: AC值范围排除功能正常');
                } else {
                    console.log('❌ 测试2失败: 排除逻辑有误');
                }
            } else {
                console.log('⚠️  无组合返回，无法验证排除逻辑');
            }
        }

        // 测试3: 批量预测 - AC值历史排除
        console.log('\n[测试3] 批量预测 - AC值历史排除功能');
        console.log('-'.repeat(80));
        totalTests++;

        const batchParams2 = {
            targetIssue: '2025001',
            excludeConditions: {
                ac: {
                    enabled: true,
                    ranges: [],
                    historical: {
                        enabled: true,
                        count: 3  // 排除最近3期出现过的AC值
                    }
                }
            }
        };

        const batchResult2 = await httpPost('http://localhost:3003/api/dlt/new-combination-prediction', batchParams2);

        if (batchResult2.error) {
            console.log(`❌ 失败: ${batchResult2.error}`);
        } else {
            console.log(`✅ 请求成功，返回 ${batchResult2.totalCount || batchResult2.combinations?.length || 0} 个组合`);

            // 获取最近3期的AC值用于验证
            const recentACs = [];
            if (trendData.periods) {
                for (let i = 0; i < Math.min(3, trendData.periods.length); i++) {
                    const ac = trendData.periods[i].statistics?.frontAcValue;
                    if (ac !== undefined) {
                        recentACs.push(ac);
                    }
                }
            }
            console.log(`   最近3期AC值: [${recentACs.join(', ')}]`);

            if (batchResult2.combinations && batchResult2.combinations.length > 0) {
                let allValid = true;
                const sampleSize = Math.min(5, batchResult2.combinations.length);

                for (let i = 0; i < sampleSize; i++) {
                    const combo = batchResult2.combinations[i];
                    const acValue = combo.acValue;

                    if (recentACs.includes(acValue)) {
                        console.log(`❌ 组合ID=${combo.id}: AC值=${acValue}，在历史AC值中但返回了`);
                        allValid = false;
                    } else {
                        console.log(`✅ 组合ID=${combo.id}: 号码=[${combo.numbers.join(',')}], AC值=${acValue} (不在历史AC值中)`);
                    }
                }

                if (allValid) {
                    passedTests++;
                    console.log('✅ 测试3通过: AC值历史排除功能正常');
                } else {
                    console.log('❌ 测试3失败: 历史排除逻辑有误');
                }
            } else {
                console.log('⚠️  无组合返回，无法验证历史排除逻辑');
            }
        }

        // 测试4: 数据库中AC值字段完整性
        console.log('\n[测试4] 数据库AC值字段完整性检查');
        console.log('-'.repeat(80));
        totalTests++;

        const statsResult = await httpGet('http://localhost:3003/api/dlt/combination-stats');

        if (statsResult.error) {
            console.log(`❌ 失败: ${statsResult.error}`);
        } else {
            // 获取一些组合样本检查AC值
            const sampleParams = {
                targetIssue: '2025001',
                excludeConditions: {}
            };

            const sampleResult = await httpPost('http://localhost:3003/api/dlt/new-combination-prediction', sampleParams);

            if (sampleResult.combinations && sampleResult.combinations.length > 0) {
                let allHaveAC = true;
                const checkCount = Math.min(10, sampleResult.combinations.length);

                for (let i = 0; i < checkCount; i++) {
                    const combo = sampleResult.combinations[i];
                    if (combo.acValue === undefined || combo.acValue === null) {
                        console.log(`❌ 组合ID=${combo.id}: AC值字段缺失`);
                        allHaveAC = false;
                    }
                }

                if (allHaveAC) {
                    passedTests++;
                    console.log(`✅ 测试4通过: 抽样检查${checkCount}个组合，AC值字段完整`);
                } else {
                    console.log('❌ 测试4失败: 部分组合缺少AC值字段');
                }
            } else {
                console.log('❌ 失败: 无法获取组合样本');
            }
        }

    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error.message);
    }

    // 测试总结
    console.log('\n' + '='.repeat(80));
    console.log('测试总结');
    console.log('='.repeat(80));
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过测试: ${passedTests}`);
    console.log(`失败测试: ${totalTests - passedTests}`);
    console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
        console.log('\n✅ 所有测试通过！AC值功能完整性验证成功！');
    } else {
        console.log('\n⚠️  部分测试失败，请检查AC值功能实现');
    }

    console.log('='.repeat(80));
}

// 运行测试
runTests()
    .then(() => {
        console.log('\n✅ 测试脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
