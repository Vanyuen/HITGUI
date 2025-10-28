/**
 * 检查热温冷比优化表的当前状态
 */

const mongoose = require('mongoose');

async function checkStatus() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接数据库成功\n');

        const collName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

        // 1. 统计总记录数
        const totalCount = await mongoose.connection.db.collection(collName).countDocuments();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1. 热温冷比优化表基本信息');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 总记录数: ${totalCount}`);

        if (totalCount === 0) {
            console.log('\n✅ 表为空，首次生成，无需清理\n');
            await mongoose.disconnect();
            return;
        }

        // 2. 统计创建时间分布
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('2. 数据创建时间分布');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const oldestRecord = await mongoose.connection.db.collection(collName)
            .find({}).sort({ created_at: 1 }).limit(1).toArray();
        const newestRecord = await mongoose.connection.db.collection(collName)
            .find({}).sort({ created_at: -1 }).limit(1).toArray();

        if (oldestRecord.length > 0) {
            console.log(`📅 最早记录: ${oldestRecord[0].created_at}`);
            console.log(`   期号对: ${oldestRecord[0].base_issue} → ${oldestRecord[0].target_issue}`);
        }

        if (newestRecord.length > 0) {
            console.log(`📅 最新记录: ${newestRecord[0].created_at}`);
            console.log(`   期号对: ${newestRecord[0].base_issue} → ${newestRecord[0].target_issue}`);
        }

        // 3. 检查数据完整性
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('3. 数据完整性检查');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 获取所有DLT期号
        const allDltIssues = await mongoose.connection.db.collection('hit_dlts')
            .find({}).sort({ Issue: 1 }).toArray();

        console.log(`📊 DLT总期数: ${allDltIssues.length}`);

        if (allDltIssues.length >= 2) {
            const expectedPairs = allDltIssues.length - 1; // 期号对数量 = 总期数 - 1
            console.log(`📊 预期期号对数量: ${expectedPairs} (期数-1)`);
            console.log(`📊 实际记录数: ${totalCount}`);

            if (totalCount < expectedPairs) {
                console.log(`⚠️  数据不完整! 缺少 ${expectedPairs - totalCount} 个期号对`);
            } else if (totalCount === expectedPairs) {
                console.log('✅ 数据完整');
            } else {
                console.log(`⚠️  记录数超出预期! 多 ${totalCount - expectedPairs} 条`);
            }

            // 检查第一个和最后一个期号对
            const firstPair = `${allDltIssues[0].Issue}-${allDltIssues[1].Issue}`;
            const lastPair = `${allDltIssues[allDltIssues.length-2].Issue}-${allDltIssues[allDltIssues.length-1].Issue}`;

            const firstExists = await mongoose.connection.db.collection(collName).findOne({
                base_issue: allDltIssues[0].Issue.toString(),
                target_issue: allDltIssues[1].Issue.toString()
            });

            const lastExists = await mongoose.connection.db.collection(collName).findOne({
                base_issue: allDltIssues[allDltIssues.length-2].Issue.toString(),
                target_issue: allDltIssues[allDltIssues.length-1].Issue.toString()
            });

            console.log(`\n期号对覆盖范围:`);
            console.log(`   首对 (${firstPair}): ${firstExists ? '✅ 存在' : '❌ 缺失'}`);
            console.log(`   末对 (${lastPair}): ${lastExists ? '✅ 存在' : '❌ 缺失'}`);
        }

        // 4. 检查数据字段完整性
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('4. 字段完整性检查');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const sampleRecord = await mongoose.connection.db.collection(collName).findOne({});

        console.log('示例记录字段:');
        console.log(`   base_issue: ${sampleRecord.base_issue}`);
        console.log(`   target_issue: ${sampleRecord.target_issue}`);
        console.log(`   total_combinations: ${sampleRecord.total_combinations}`);

        if (sampleRecord.hot_warm_cold_data) {
            const ratios = Object.keys(sampleRecord.hot_warm_cold_data);
            console.log(`   热温冷比种类: ${ratios.length}个`);
            console.log(`   示例比例: ${ratios[0]} (${sampleRecord.hot_warm_cold_data[ratios[0]].length}个组合)`);
        } else {
            console.log('   ❌ 缺少 hot_warm_cold_data 字段!');
        }

        // 5. 检查total_combinations是否正确
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('5. 组合数量验证');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const wrongTotalCount = await mongoose.connection.db.collection(collName).countDocuments({
            total_combinations: { $ne: 324632 }
        });

        if (wrongTotalCount > 0) {
            console.log(`⚠️  发现 ${wrongTotalCount} 条记录的total_combinations不等于324632`);

            const wrongSample = await mongoose.connection.db.collection(collName).findOne({
                total_combinations: { $ne: 324632 }
            });
            console.log(`   示例: ${wrongSample.base_issue} → ${wrongSample.target_issue}`);
            console.log(`   total_combinations: ${wrongSample.total_combinations} (应为324632)`);
        } else {
            console.log('✅ 所有记录的total_combinations都正确 (324632)');
        }

        // 6. 推荐操作
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('6. 推荐操作');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const expectedPairs = allDltIssues.length - 1;
        const hasIssues = (totalCount < expectedPairs) || (wrongTotalCount > 0);

        if (hasIssues) {
            console.log('⚠️  建议清空并重新生成:');
            console.log('   原因:');
            if (totalCount < expectedPairs) {
                console.log(`   - 数据不完整 (缺少${expectedPairs - totalCount}个期号对)`);
            }
            if (wrongTotalCount > 0) {
                console.log(`   - 组合数量错误 (${wrongTotalCount}条记录)`);
            }
            console.log('\n   执行命令:');
            console.log('   node clear-hwc-table.js');
        } else {
            console.log('ℹ️  数据看起来正常，但如果遗漏值表已更新:');
            console.log('   建议: 清空并重新生成以确保数据一致性');
            console.log('\n   执行命令:');
            console.log('   node clear-hwc-table.js');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkStatus();
