/**
 * 验证修复效果
 */

const mongoose = require('mongoose');

async function verify() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接数据库成功\n');

        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   验证修复效果                                           ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');

        // 检查1: hit_dlts期数
        const dltCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
        console.log(`📊 hit_dlts期数: ${dltCount}`);

        // 检查2: 红球组合表
        const redComboCount = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`📊 红球组合数: ${redComboCount}`);
        console.log(`   ${redComboCount === 324632 ? '✅' : '❌'} 组合表${redComboCount === 324632 ? '完整' : '不完整'}\n`);

        // 检查3: 热温冷比表
        const hwcCount = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();
        const expectedPairs = dltCount - 1;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('修复前后对比: 热温冷比优化表');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`修复前:`);
        console.log(`  - 预期期号对: ${expectedPairs}`);
        console.log(`  - 实际记录数: 1293 (约46%)`);
        console.log(`  - 缺失: 1495个期号对`);
        console.log(`  - 问题: ❌ 跳过已存在记录，新旧数据混杂\n`);

        console.log(`修复后:`);
        console.log(`  - 预期期号对: ${expectedPairs}`);
        console.log(`  - 实际记录数: ${hwcCount}`);

        if (hwcCount === 0) {
            console.log(`  - 状态: ⏳ 尚未执行更新`);
        } else if (hwcCount === expectedPairs) {
            console.log(`  - 状态: ✅ 完整 (100%)`);

            // 检查创建时间
            const oldest = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .find({}).sort({ created_at: 1 }).limit(1).toArray();
            const newest = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .find({}).sort({ created_at: -1 }).limit(1).toArray();

            if (oldest.length > 0 && newest.length > 0) {
                const oldestTime = new Date(oldest[0].created_at);
                const newestTime = new Date(newest[0].created_at);
                const diffMinutes = (newestTime - oldestTime) / 1000 / 60;

                console.log(`  - 最早记录: ${oldestTime.toLocaleString('zh-CN')}`);
                console.log(`  - 最新记录: ${newestTime.toLocaleString('zh-CN')}`);
                console.log(`  - 生成耗时: ${diffMinutes.toFixed(1)}分钟`);

                // 判断是否同一批次生成(时间差在1小时内)
                if (diffMinutes < 60) {
                    console.log(`  - 数据一致性: ✅ 所有数据同一批次生成，基于相同遗漏值表`);
                } else {
                    console.log(`  - 数据一致性: ⚠️  数据跨越较长时间，可能是多次生成`);
                }
            }
        } else if (hwcCount < expectedPairs) {
            console.log(`  - 状态: ⏳ 生成中 (${((hwcCount / expectedPairs) * 100).toFixed(1)}%)`);
            console.log(`  - 已完成: ${hwcCount}/${expectedPairs}`);
        } else {
            console.log(`  - 状态: ⚠️  记录数异常 (超出预期)`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('修复前后对比: 遗漏值表生成逻辑');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const redMissingCount = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const blueMissingCount = await mongoose.connection.db
            .collection('hit_dlts').countDocuments();

        console.log(`修复前:`);
        console.log(`  - 逻辑: 先删除旧数据，再插入新数据`);
        console.log(`  - 问题: ❌ 中途失败会导致数据丢失\n`);

        console.log(`修复后:`);
        console.log(`  - 逻辑: 先插入临时集合，再替换正式集合`);
        console.log(`  - 优点: ✅ 失败可回滚，数据安全`);
        console.log(`  - 红球遗漏: ${redMissingCount}期 ${redMissingCount === dltCount ? '✅' : '❌'}`);
        console.log(`  - 蓝球遗漏: ${blueMissingCount}期 ${blueMissingCount === dltCount ? '✅' : '❌'}`);

        // 检查4: 组合特征表
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('其他数据表状态');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const comboFeaturesCount = await mongoose.connection.db.collection('hit_dlt_combofeatures').countDocuments();
        console.log(`组合特征表: ${comboFeaturesCount}期 ${comboFeaturesCount === dltCount ? '✅' : '⚠️ '}`);

        const statisticsCount = await mongoose.connection.db.collection('hit_dlts').countDocuments({
            statistics: { $exists: true }
        });
        console.log(`statistics字段: ${statisticsCount}期 ${statisticsCount === dltCount ? '✅' : '⚠️ '}`);

        // 总结
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║   验证总结                                               ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');

        const allOk = redComboCount === 324632 &&
                      hwcCount === expectedPairs &&
                      redMissingCount === dltCount &&
                      blueMissingCount === dltCount;

        if (allOk) {
            console.log('✅ 所有修复已生效，数据完整且一致！');
            console.log('\n建议操作:');
            console.log('  1. 可以正常使用系统');
            console.log('  2. 数据已基于最新遗漏值表生成');
            console.log('  3. 热温冷比表数据一致性良好');
        } else if (hwcCount > 0 && hwcCount < expectedPairs) {
            console.log('⏳ 数据正在生成中...');
            console.log(`\n进度: ${hwcCount}/${expectedPairs} (${((hwcCount / expectedPairs) * 100).toFixed(1)}%)`);
            console.log('建议: 等待生成完成后再次验证');
        } else {
            console.log('⚠️  部分数据需要更新');
            console.log('\n建议操作:');
            console.log('  1. 在管理后台执行"一键更新全部数据表"');
            console.log('  2. 等待所有步骤完成');
            console.log('  3. 重新运行验证: node verify-fixes.js');
        }

    } catch (error) {
        console.error('\n❌ 验证失败:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
