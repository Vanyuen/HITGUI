/**
 * 全面检测热温冷优化表字段完整性
 * 对比正表、备份表和预期字段列表
 */

const mongoose = require('mongoose');

async function fullFieldCheck() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;

        // 预期字段列表
        const expectedFields = [
            'base_issue',          // 期号
            'target_issue',        // 期号
            'base_id',            // 新增，ID字段
            'target_id',          // 新增，ID字段
            'is_predicted',       // 新增，推算期标识
            'hot_warm_cold_data', // Map<String, Number[]>
            'total_combinations', // 新增，总组合数
            'hit_analysis',       // 新增，命中分析
            'created_at',         // 时间戳
            'updated_at'          // 时间戳
        ];

        console.log('\n========================================');
        console.log('📋 预期字段列表');
        console.log('========================================');
        expectedFields.forEach((field, i) => {
            console.log(`  ${i + 1}. ${field}`);
        });

        // 1. 检查正表
        console.log('\n========================================');
        console.log('📊 正表字段检查: hit_dlt_redcombinationshotwarmcoldoptimizeds');
        console.log('========================================');

        const mainColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const mainCount = await mainColl.countDocuments();
        console.log(`总记录数: ${mainCount}`);

        // 随机抽取30条记录进行全面检查
        const mainSamples = await mainColl.aggregate([
            { $sample: { size: 30 } }
        ]).toArray();

        console.log('\n正表字段覆盖率统计（基于30条随机样本）:');
        const mainFieldStats = {};
        expectedFields.forEach(field => {
            const count = mainSamples.filter(doc => doc[field] !== undefined && doc[field] !== null).length;
            const percentage = (count / mainSamples.length * 100).toFixed(1);
            mainFieldStats[field] = {
                count: count,
                percentage: percentage,
                hasField: count > 0
            };
            const status = count > 0 ? '✅' : '❌';
            console.log(`  ${status} ${field}: ${count}/30 (${percentage}%)`);
        });

        // 检查正表的实际字段列表
        console.log('\n正表实际存在的所有字段:');
        const mainDoc = await mainColl.findOne({});
        if (mainDoc) {
            const actualFields = Object.keys(mainDoc);
            actualFields.forEach((field, i) => {
                const isExpected = expectedFields.includes(field);
                const marker = isExpected ? '✅' : '🆕';
                console.log(`  ${marker} ${i + 1}. ${field} (${typeof mainDoc[field]})`);
            });

            console.log('\n正表字段详细值示例:');
            expectedFields.forEach(field => {
                const value = mainDoc[field];
                if (value !== undefined) {
                    let displayValue;
                    if (typeof value === 'object' && value !== null) {
                        if (value instanceof Date) {
                            displayValue = value.toISOString();
                        } else if (Array.isArray(value)) {
                            displayValue = `Array(${value.length})`;
                        } else {
                            displayValue = `Object(${Object.keys(value).length} keys)`;
                        }
                    } else {
                        displayValue = value;
                    }
                    console.log(`  ${field}: ${displayValue}`);
                } else {
                    console.log(`  ${field}: undefined`);
                }
            });
        }

        // 2. 检查备份表
        console.log('\n========================================');
        console.log('📦 备份表字段检查: hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_*');
        console.log('========================================');

        const backupColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_1763989056187');
        const backupCount = await backupColl.countDocuments();
        console.log(`总记录数: ${backupCount}`);

        const backupSamples = await backupColl.aggregate([
            { $sample: { size: 30 } }
        ]).toArray();

        console.log('\n备份表字段覆盖率统计（基于30条随机样本）:');
        const backupFieldStats = {};
        expectedFields.forEach(field => {
            const count = backupSamples.filter(doc => doc[field] !== undefined && doc[field] !== null).length;
            const percentage = (count / backupSamples.length * 100).toFixed(1);
            backupFieldStats[field] = {
                count: count,
                percentage: percentage,
                hasField: count > 0
            };
            const status = count > 0 ? '✅' : '❌';
            console.log(`  ${status} ${field}: ${count}/30 (${percentage}%)`);
        });

        // 检查备份表的实际字段列表
        console.log('\n备份表实际存在的所有字段:');
        const backupDoc = await backupColl.findOne({});
        if (backupDoc) {
            const actualFields = Object.keys(backupDoc);
            actualFields.forEach((field, i) => {
                const isExpected = expectedFields.includes(field);
                const marker = isExpected ? '✅' : '🆕';
                console.log(`  ${marker} ${i + 1}. ${field} (${typeof backupDoc[field]})`);
            });
        }

        // 3. 对比分析
        console.log('\n========================================');
        console.log('🔄 正表 vs 备份表字段对比');
        console.log('========================================');

        console.log('\n字段对比表:');
        console.log('字段名                        正表      备份表    差异');
        console.log('─'.repeat(70));

        expectedFields.forEach(field => {
            const mainHas = mainFieldStats[field]?.hasField ? '✅' : '❌';
            const backupHas = backupFieldStats[field]?.hasField ? '✅' : '❌';
            const diff = mainFieldStats[field]?.hasField === backupFieldStats[field]?.hasField ? '  ' : '⚠️';

            const fieldPadded = field.padEnd(28);
            console.log(`${fieldPadded} ${mainHas}       ${backupHas}      ${diff}`);
        });

        // 4. 检查推算期数据
        console.log('\n========================================');
        console.log('🔮 推算期数据检查');
        console.log('========================================');

        // 正表
        const mainPredictedQuery = mainFieldStats['is_predicted']?.hasField
            ? { is_predicted: true }
            : {};
        const mainPredictedCount = mainFieldStats['is_predicted']?.hasField
            ? await mainColl.countDocuments({ is_predicted: true })
            : 0;

        console.log(`正表 is_predicted=true 记录数: ${mainPredictedCount}`);

        if (mainPredictedCount > 0) {
            const mainPredictedSample = await mainColl.findOne({ is_predicted: true });
            console.log(`  示例: ${mainPredictedSample.base_issue} → ${mainPredictedSample.target_issue}`);
        }

        // 备份表
        const backupPredictedCount = backupFieldStats['is_predicted']?.hasField
            ? await backupColl.countDocuments({ is_predicted: true })
            : 0;

        console.log(`备份表 is_predicted=true 记录数: ${backupPredictedCount}`);

        if (backupPredictedCount > 0) {
            const backupPredictedSample = await backupColl.findOne({ is_predicted: true });
            console.log(`  示例: ${backupPredictedSample.base_issue} → ${backupPredictedSample.target_issue}`);
        }

        // 5. 检查最新期号范围
        console.log('\n========================================');
        console.log('📅 期号范围检查');
        console.log('========================================');

        // 正表期号范围
        const mainMinMax = await mainColl.aggregate([
            {
                $group: {
                    _id: null,
                    minBase: { $min: '$base_issue' },
                    maxBase: { $max: '$base_issue' },
                    minTarget: { $min: '$target_issue' },
                    maxTarget: { $max: '$target_issue' }
                }
            }
        ]).toArray();

        if (mainMinMax.length > 0) {
            console.log('正表期号范围:');
            console.log(`  base_issue: ${mainMinMax[0].minBase} - ${mainMinMax[0].maxBase}`);
            console.log(`  target_issue: ${mainMinMax[0].minTarget} - ${mainMinMax[0].maxTarget}`);
        }

        // 备份表期号范围
        const backupMinMax = await backupColl.aggregate([
            {
                $group: {
                    _id: null,
                    minBase: { $min: '$base_issue' },
                    maxBase: { $max: '$base_issue' },
                    minTarget: { $min: '$target_issue' },
                    maxTarget: { $max: '$target_issue' }
                }
            }
        ]).toArray();

        if (backupMinMax.length > 0) {
            console.log('\n备份表期号范围:');
            console.log(`  base_issue: ${backupMinMax[0].minBase} - ${backupMinMax[0].maxBase}`);
            console.log(`  target_issue: ${backupMinMax[0].minTarget} - ${backupMinMax[0].maxTarget}`);
        }

        // 6. 最终结论
        console.log('\n========================================');
        console.log('📝 检测结论');
        console.log('========================================');

        const missingInMain = expectedFields.filter(field => !mainFieldStats[field]?.hasField);
        const missingInBackup = expectedFields.filter(field => !backupFieldStats[field]?.hasField);

        console.log('\n正表缺失字段:');
        if (missingInMain.length > 0) {
            missingInMain.forEach(field => {
                console.log(`  ❌ ${field}`);
            });
        } else {
            console.log('  ✅ 无缺失字段');
        }

        console.log('\n备份表缺失字段:');
        if (missingInBackup.length > 0) {
            missingInBackup.forEach(field => {
                console.log(`  ❌ ${field}`);
            });
        } else {
            console.log('  ✅ 无缺失字段');
        }

        console.log('\n建议操作:');
        if (missingInMain.length > 0) {
            if (backupFieldStats['base_id']?.hasField &&
                backupFieldStats['target_id']?.hasField &&
                backupFieldStats['is_predicted']?.hasField) {
                console.log('  🔄 建议：从备份表恢复到正表（备份表有完整字段）');
            } else {
                console.log('  🔧 建议：运行迁移脚本，为正表添加缺失字段');
            }
        } else {
            console.log('  ✅ 正表字段完整，无需操作');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

fullFieldCheck();
