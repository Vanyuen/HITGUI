/**
 * 最终全面检测：确认所有字段和推算期数据
 */

const mongoose = require('mongoose');

async function finalFullCheck() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;
        const hwcColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const hitDltsColl = db.collection('hit_dlts');

        // 1. 获取数据库最新期号（注意类型转换）
        const latestRecord = await hitDltsColl.findOne({}, { sort: { ID: -1 } });
        const latestIssue = parseInt(latestRecord.Issue);
        const latestID = latestRecord.ID;

        console.log('\n========================================');
        console.log('📊 数据库基本信息');
        console.log('========================================');
        console.log(`最新期号 (Issue): ${latestIssue} (类型: ${typeof latestIssue})`);
        console.log(`最新ID: ${latestID}`);
        console.log(`推算期号: ${latestIssue + 1}`);

        const totalCount = await hwcColl.countDocuments();
        console.log(`\n热温冷优化表总记录数: ${totalCount}`);

        // 2. 检查所有预期字段
        console.log('\n========================================');
        console.log('📋 字段完整性检查');
        console.log('========================================');

        const expectedFields = {
            'base_issue': '基准期号',
            'target_issue': '目标期号',
            'base_id': '基准期ID（新增）',
            'target_id': '目标期ID（新增）',
            'is_predicted': '推算期标识（新增）',
            'hot_warm_cold_data': '热温冷数据',
            'total_combinations': '总组合数（新增）',
            'hit_analysis': '命中分析（新增）',
            'created_at': '创建时间',
            'updated_at': '更新时间'
        };

        // 随机抽样50条检查
        const samples = await hwcColl.aggregate([
            { $sample: { size: 50 } }
        ]).toArray();

        console.log('\n基于50条随机样本的字段覆盖率:');
        const fieldStats = {};

        for (const [field, description] of Object.entries(expectedFields)) {
            const count = samples.filter(doc => {
                const value = doc[field];
                return value !== undefined && value !== null;
            }).length;
            const percentage = (count / samples.length * 100).toFixed(1);
            const status = count === samples.length ? '✅' : (count > 0 ? '⚠️' : '❌');

            fieldStats[field] = { count, percentage, complete: count === samples.length };

            console.log(`${status} ${field.padEnd(25)} ${description.padEnd(20)} ${count}/50 (${percentage}%)`);
        }

        // 3. 检查一条完整记录的详细字段
        console.log('\n========================================');
        console.log('📄 完整记录示例');
        console.log('========================================');

        const sampleDoc = samples[0];
        console.log('\n字段值示例:');
        for (const [field, description] of Object.entries(expectedFields)) {
            const value = sampleDoc[field];
            let displayValue;

            if (value === undefined || value === null) {
                displayValue = 'undefined/null';
            } else if (value instanceof Date) {
                displayValue = value.toISOString();
            } else if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    displayValue = `Array(${value.length})`;
                } else {
                    const keys = Object.keys(value);
                    displayValue = `Object(${keys.length} keys)`;
                    if (field === 'hot_warm_cold_data' && keys.length > 0) {
                        displayValue += ` [${keys.slice(0, 3).join(', ')}...]`;
                    }
                }
            } else {
                displayValue = value;
            }

            console.log(`  ${field}: ${displayValue}`);
        }

        // 4. 检查推算期数据
        console.log('\n========================================');
        console.log('🔮 推算期数据检查');
        console.log('========================================');

        const predictedCount = await hwcColl.countDocuments({ is_predicted: true });
        console.log(`is_predicted=true 的记录数: ${predictedCount}`);

        if (predictedCount > 0) {
            console.log('\n所有推算期记录:');
            const predictedDocs = await hwcColl.find({ is_predicted: true }).toArray();

            predictedDocs.forEach((doc, i) => {
                console.log(`\n推算期记录 #${i + 1}:`);
                console.log(`  ${doc.base_issue} → ${doc.target_issue}`);
                console.log(`  base_id: ${doc.base_id}`);
                console.log(`  target_id: ${doc.target_id}`);
                console.log(`  is_predicted: ${doc.is_predicted}`);
                console.log(`  has hot_warm_cold_data: ${!!doc.hot_warm_cold_data}`);
                console.log(`  has hit_analysis: ${!!doc.hit_analysis}`);
                console.log(`  total_combinations: ${doc.total_combinations}`);
                console.log(`  created_at: ${doc.created_at ? doc.created_at.toISOString() : 'N/A'}`);
                console.log(`  ObjectId时间: ${doc._id.getTimestamp().toLocaleString('zh-CN')}`);
            });
        } else {
            console.log('⚠️ 没有推算期数据');
        }

        // 5. 检查期号 25124 → 25125
        console.log('\n========================================');
        console.log('🎯 检查关键推算期: 25124 → 25125');
        console.log('========================================');

        const keyPredicted = await hwcColl.findOne({
            base_issue: latestIssue.toString(),
            target_issue: (latestIssue + 1).toString()
        });

        if (keyPredicted) {
            console.log(`✅ 推算期数据存在: ${latestIssue} → ${latestIssue + 1}`);
            console.log('\n详细信息:');
            console.log(`  base_issue: ${keyPredicted.base_issue}`);
            console.log(`  target_issue: ${keyPredicted.target_issue}`);
            console.log(`  base_id: ${keyPredicted.base_id}`);
            console.log(`  target_id: ${keyPredicted.target_id}`);
            console.log(`  is_predicted: ${keyPredicted.is_predicted}`);
            console.log(`  total_combinations: ${keyPredicted.total_combinations}`);

            if (keyPredicted.hot_warm_cold_data) {
                const ratios = Object.keys(keyPredicted.hot_warm_cold_data);
                console.log(`  hot_warm_cold_data: ${ratios.length}种比例`);
                console.log(`    示例比例: ${ratios.slice(0, 5).join(', ')}`);
            }

            if (keyPredicted.hit_analysis) {
                console.log(`  hit_analysis: ${JSON.stringify(keyPredicted.hit_analysis)}`);
            }

            console.log(`  created_at: ${keyPredicted.created_at ? keyPredicted.created_at.toISOString() : 'N/A'}`);
            console.log(`  updated_at: ${keyPredicted.updated_at ? keyPredicted.updated_at.toISOString() : 'N/A'}`);
        } else {
            console.log(`❌ 推算期数据不存在: ${latestIssue} → ${latestIssue + 1}`);
            console.log('\n可能原因:');
            console.log('  1. 生成脚本未包含推算期');
            console.log('  2. 推算期数据尚未生成');
        }

        // 6. 检查最新10期已开奖数据
        console.log('\n========================================');
        console.log('📅 最新10期已开奖数据检查');
        console.log('========================================');

        let allHaveNewFields = true;

        for (let i = 9; i >= 0; i--) {
            const targetIssue = latestIssue - i;
            const baseIssue = targetIssue - 1;

            const record = await hwcColl.findOne({
                base_issue: baseIssue.toString(),
                target_issue: targetIssue.toString()
            });

            if (record) {
                const hasAllFields =
                    record.base_id !== undefined &&
                    record.target_id !== undefined &&
                    record.is_predicted !== undefined &&
                    record.hot_warm_cold_data !== undefined &&
                    record.total_combinations !== undefined &&
                    record.hit_analysis !== undefined &&
                    record.created_at !== undefined &&
                    record.updated_at !== undefined;

                const status = hasAllFields ? '✅' : '❌';
                if (!hasAllFields) allHaveNewFields = false;

                console.log(`${status} ${baseIssue} → ${targetIssue}${hasAllFields ? '' : ' (缺少某些字段)'}`);
            } else {
                console.log(`❌ ${baseIssue} → ${targetIssue}: 记录不存在`);
                allHaveNewFields = false;
            }
        }

        // 7. 期号范围统计
        console.log('\n========================================');
        console.log('📊 期号范围统计');
        console.log('========================================');

        const minMaxResult = await hwcColl.aggregate([
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

        if (minMaxResult.length > 0) {
            const stats = minMaxResult[0];
            console.log(`base_issue 范围: ${stats.minBase} - ${stats.maxBase}`);
            console.log(`target_issue 范围: ${stats.minTarget} - ${stats.maxTarget}`);

            // 转换为数字比较
            const maxTargetNum = parseInt(stats.maxTarget);
            const isPredictedIncluded = maxTargetNum > latestIssue;

            console.log(`\n最大target_issue (${maxTargetNum}) > 最新期号 (${latestIssue}): ${isPredictedIncluded ? '✅ 包含推算期' : '❌ 不包含推算期'}`);
        }

        // 8. 生成时间分析
        console.log('\n========================================');
        console.log('⏰ 数据生成时间分析');
        console.log('========================================');

        const oldestDoc = await hwcColl.findOne({}, { sort: { _id: 1 } });
        const newestDoc = await hwcColl.findOne({}, { sort: { _id: -1 } });

        if (oldestDoc && newestDoc) {
            const oldestTime = oldestDoc._id.getTimestamp();
            const newestTime = newestDoc._id.getTimestamp();

            console.log(`最早记录生成: ${oldestTime.toLocaleString('zh-CN')}`);
            console.log(`  期号: ${oldestDoc.base_issue} → ${oldestDoc.target_issue}`);
            console.log(`最新记录生成: ${newestTime.toLocaleString('zh-CN')}`);
            console.log(`  期号: ${newestDoc.base_issue} → ${newestDoc.target_issue}`);

            const timeDiff = newestTime - oldestTime;
            const minutes = Math.floor(timeDiff / 1000 / 60);
            console.log(`生成时间跨度: ${minutes}分钟`);
        }

        // 9. 最终结论
        console.log('\n========================================');
        console.log('📝 最终检测结论');
        console.log('========================================');

        const allFieldsComplete = Object.values(fieldStats).every(stat => stat.complete);

        console.log('\n✅ 字段完整性:');
        console.log(`  所有预期字段: ${allFieldsComplete ? '✅ 100%完整' : '❌ 存在缺失'}`);

        console.log('\n✅ 推算期数据:');
        console.log(`  推算期记录数: ${predictedCount}`);
        console.log(`  ${latestIssue} → ${latestIssue + 1}: ${keyPredicted ? '✅ 存在' : '❌ 不存在'}`);

        console.log('\n✅ 最新10期数据:');
        console.log(`  所有字段完整: ${allHaveNewFields ? '✅ 是' : '❌ 否'}`);

        console.log('\n总体评估:');
        if (allFieldsComplete && keyPredicted && allHaveNewFields) {
            console.log('  🎉 热温冷优化表数据完整，所有新增字段已就位，包含推算期数据！');
        } else {
            console.log('  ⚠️ 存在以下问题:');
            if (!allFieldsComplete) console.log('     - 部分字段覆盖率不完整');
            if (!keyPredicted) console.log(`     - 缺少推算期数据 (${latestIssue} → ${latestIssue + 1})`);
            if (!allHaveNewFields) console.log('     - 最新10期数据存在字段缺失');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

finalFullCheck();
