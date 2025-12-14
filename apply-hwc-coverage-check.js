/**
 * 应用热温冷优化表覆盖范围检测修复
 * 修复问题: 期号范围超出优化表覆盖范围时，任务应该提示用户而不是执行失败
 *
 * 修复内容:
 * 在任务创建时检测热温冷优化表覆盖范围，如果覆盖率低于50%则拒绝创建并提示用户
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf-8');

// 需要查找的目标代码
const targetCode = `        log(\`✅ 期号解析成功: \${startPeriod}-\${endPeriod}, 共\${totalPeriods}期 (含\${predictedCount}期推算)\`);

        const periodRange = {`;

// 替换后的代码
const replacementCode = `        log(\`✅ 期号解析成功: \${startPeriod}-\${endPeriod}, 共\${totalPeriods}期 (含\${predictedCount}期推算)\`);

        // ⭐ 2025-12-03 新增: 检测热温冷优化表覆盖范围
        try {
            // 获取热温冷优化表的期号覆盖范围
            const hwcCoverage = await DLTRedCombinationsHotWarmColdOptimized.aggregate([
                {
                    $group: {
                        _id: null,
                        minTarget: { $min: { $toInt: '$target_issue' } },
                        maxTarget: { $max: { $toInt: '$target_issue' } },
                        count: { $sum: 1 }
                    }
                }
            ]);

            if (hwcCoverage.length > 0 && hwcCoverage[0].count > 0) {
                const { minTarget, maxTarget } = hwcCoverage[0];
                log(\`📊 热温冷优化表覆盖范围: \${minTarget} - \${maxTarget}\`);

                // 检测请求的期号范围是否在覆盖范围内
                const requestedMin = startPeriod;
                const requestedMax = endPeriod;

                // 计算超出范围的期号
                const belowMin = requestedMin < minTarget ? minTarget - requestedMin : 0;
                const aboveMax = requestedMax > maxTarget ? requestedMax - maxTarget : 0;

                if (belowMin > 0 || aboveMax > 0) {
                    const outOfRangeCount = belowMin + aboveMax;
                    const coveredCount = totalPeriods - outOfRangeCount;
                    const coverageRate = Math.round((coveredCount / totalPeriods) * 100);

                    log(\`⚠️ 热温冷优化表覆盖率: \${coverageRate}% (\${coveredCount}/\${totalPeriods}期在覆盖范围内)\`);

                    // 如果覆盖率低于50%，拒绝创建任务并提示用户
                    if (coverageRate < 50) {
                        return res.json({
                            success: false,
                            message: \`期号范围 \${requestedMin}-\${requestedMax} 超出热温冷优化表覆盖范围 (\${minTarget}-\${maxTarget})。\\n\\n\` +
                                     \`覆盖率仅 \${coverageRate}%，建议:\\n\` +
                                     \`1. 使用"最近N期"模式（如最近100期）\\n\` +
                                     \`2. 或将期号范围限制在 \${minTarget}-\${maxTarget} 之间\\n\` +
                                     \`3. 或先在"数据管理"中生成缺失的热温冷数据\`,
                            hwc_coverage: {
                                min: minTarget,
                                max: maxTarget,
                                requested_min: requestedMin,
                                requested_max: requestedMax,
                                coverage_rate: coverageRate
                            }
                        });
                    } else {
                        // 覆盖率>=50%但<100%，添加警告信息到任务
                        log(\`⚠️ 部分期号超出优化表范围，任务将继续创建但可能有 \${outOfRangeCount} 期没有数据\`);
                    }
                } else {
                    log(\`✅ 期号范围完全在热温冷优化表覆盖范围内\`);
                }
            } else {
                log(\`⚠️ 热温冷优化表为空，任务可能无法正常执行\`);
                return res.json({
                    success: false,
                    message: '热温冷优化表为空，请先在"数据管理"中生成热温冷数据',
                    hwc_coverage: { count: 0 }
                });
            }
        } catch (hwcCheckError) {
            log(\`⚠️ 检测热温冷优化表覆盖范围时出错: \${hwcCheckError.message}，任务将继续创建\`);
        }

        const periodRange = {`;

if (content.includes(targetCode)) {
    content = content.replace(targetCode, replacementCode);
    console.log('✅ 热温冷优化表覆盖范围检测代码已添加');
} else if (content.includes('⭐ 2025-12-03 新增: 检测热温冷优化表覆盖范围')) {
    console.log('⚠️ 修复已经应用过，无需重复操作');
} else {
    console.log('❌ 未找到目标代码块，请检查server.js文件');
    process.exit(1);
}

// 保存文件
fs.writeFileSync(serverPath, content, 'utf-8');
console.log('✅ 修改已写入文件: ' + serverPath);
console.log('\n请重启应用程序以应用更改。');
