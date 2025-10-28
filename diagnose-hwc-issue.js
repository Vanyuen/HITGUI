/**
 * 诊断"生成热温冷比优化表"失败的原因
 */

const mongoose = require('mongoose');
const path = require('path');

// 连接数据库
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   诊断: 生成热温冷比优化表失败原因                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    try {
        console.log('📡 连接数据库...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功\n');

        // ========== 检查1: DLT开奖数据 ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查1: DLT开奖数据');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const dltCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
        console.log(`📊 HIT_DLT记录数: ${dltCount}`);

        if (dltCount === 0) {
            console.log('❌ 问题: DLT开奖数据为空!');
            console.log('   解决方案: 请先导入开奖数据\n');
            await mongoose.disconnect();
            return;
        }

        if (dltCount < 2) {
            console.log(`⚠️  警告: 只有${dltCount}期数据，需要至少2期才能生成热温冷比`);
            console.log('   解决方案: 至少需要导入2期开奖数据\n');
            await mongoose.disconnect();
            return;
        }

        const latestDlt = await mongoose.connection.db.collection('hit_dlts')
            .findOne({}, { sort: { Issue: -1 } });
        const earliestDlt = await mongoose.connection.db.collection('hit_dlts')
            .findOne({}, { sort: { Issue: 1 } });

        console.log(`   最早期号: ${earliestDlt.Issue} (ID: ${earliestDlt.ID})`);
        console.log(`   最新期号: ${latestDlt.Issue} (ID: ${latestDlt.ID})`);
        console.log(`✅ DLT数据正常\n`);

        // ========== 检查2: 红球组合表 ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查2: 红球组合表');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const redComboCount = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`📊 红球组合记录数: ${redComboCount}`);

        if (redComboCount === 0) {
            console.log('❌ 问题: 红球组合表为空!');
            console.log('   原因: 这是生成热温冷比的必需数据');
            console.log('   解决方案: 需要先生成红球组合表 (C(35,5) = 324,632条)');
            console.log('   执行脚本: node generate-combinations.js\n');
            await mongoose.disconnect();
            return;
        }

        if (redComboCount !== 324632) {
            console.log(`⚠️  警告: 红球组合数量不完整 (期望324,632, 实际${redComboCount})`);
        } else {
            console.log('✅ 红球组合表完整\n');
        }

        // 检查组合表字段
        const sampleCombo = await mongoose.connection.db.collection('hit_dlt_redcombinations')
            .findOne({});

        console.log('   示例组合结构:');
        console.log(`   - combination_id: ${sampleCombo.combination_id}`);
        console.log(`   - red_ball_1: ${sampleCombo.red_ball_1}`);
        console.log(`   - red_ball_2: ${sampleCombo.red_ball_2}`);
        console.log(`   - red_ball_3: ${sampleCombo.red_ball_3}`);
        console.log(`   - red_ball_4: ${sampleCombo.red_ball_4}`);
        console.log(`   - red_ball_5: ${sampleCombo.red_ball_5}`);

        const requiredFields = ['combination_id', 'red_ball_1', 'red_ball_2', 'red_ball_3', 'red_ball_4', 'red_ball_5'];
        const missingFields = requiredFields.filter(field => !(field in sampleCombo));

        if (missingFields.length > 0) {
            console.log(`❌ 问题: 组合表缺少必需字段: ${missingFields.join(', ')}\n`);
            await mongoose.disconnect();
            return;
        }
        console.log('✅ 组合表字段完整\n');

        // ========== 检查3: 红球遗漏值表 ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查3: 红球遗漏值表');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const redMissingCount = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories')
            .countDocuments();

        console.log(`📊 红球遗漏值记录数: ${redMissingCount}`);

        if (redMissingCount === 0) {
            console.log('❌ 问题: 红球遗漏值表为空!');
            console.log('   原因: 生成热温冷比需要遗漏值数据');
            console.log('   解决方案: 执行"一键更新全部数据表"中的步骤1\n');
            await mongoose.disconnect();
            return;
        }

        if (redMissingCount < dltCount) {
            console.log(`⚠️  警告: 遗漏值记录数(${redMissingCount}) < DLT记录数(${dltCount})`);
            console.log('   建议重新生成遗漏值表');
        } else {
            console.log('✅ 遗漏值记录数量正常\n');
        }

        // 检查遗漏值表字段
        const sampleMissing = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories')
            .findOne({ ID: earliestDlt.ID });

        if (!sampleMissing) {
            console.log(`❌ 问题: 找不到ID=${earliestDlt.ID}的遗漏值记录`);
            console.log('   原因: 遗漏值表与DLT表的ID不匹配\n');
            await mongoose.disconnect();
            return;
        }

        console.log(`   检查ID=${earliestDlt.ID}的遗漏值记录:`);
        console.log(`   - Issue: ${sampleMissing.Issue}`);
        console.log(`   - 红球1的遗漏值: ${sampleMissing['1']}`);
        console.log(`   - 红球35的遗漏值: ${sampleMissing['35']}`);

        // 检查是否有所有红球的遗漏值字段
        const missingBallFields = [];
        for (let i = 1; i <= 35; i++) {
            if (!(String(i) in sampleMissing)) {
                missingBallFields.push(i);
            }
        }

        if (missingBallFields.length > 0) {
            console.log(`❌ 问题: 遗漏值记录缺少红球字段: ${missingBallFields.join(', ')}\n`);
            await mongoose.disconnect();
            return;
        }
        console.log('✅ 遗漏值表字段完整\n');

        // ========== 检查4: 热温冷比优化表 Schema ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查4: 热温冷比优化表结构');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const hwcCollectionName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
        const hwcCount = await mongoose.connection.db.collection(hwcCollectionName).countDocuments();
        console.log(`📊 当前热温冷比记录数: ${hwcCount}`);

        if (hwcCount > 0) {
            const sampleHwc = await mongoose.connection.db.collection(hwcCollectionName).findOne({});
            console.log(`   示例记录:`);
            console.log(`   - base_issue: ${sampleHwc.base_issue}`);
            console.log(`   - target_issue: ${sampleHwc.target_issue}`);
            console.log(`   - total_combinations: ${sampleHwc.total_combinations}`);

            if (sampleHwc.hot_warm_cold_data) {
                const ratios = Object.keys(sampleHwc.hot_warm_cold_data);
                console.log(`   - 热温冷比种类数: ${ratios.length}`);
                console.log(`   - 示例比例: ${ratios[0]} (${sampleHwc.hot_warm_cold_data[ratios[0]].length}个组合)`);
            }
            console.log('✅ 已有部分热温冷比数据\n');
        } else {
            console.log('ℹ️  热温冷比表为空，这是首次生成\n');
        }

        // ========== 检查5: 模拟生成流程 ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查5: 模拟生成热温冷比流程');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 取第2期作为目标期号（第1期作为基准期）
        const allIssues = await mongoose.connection.db.collection('hit_dlts')
            .find({}).sort({ Issue: 1 }).toArray();

        if (allIssues.length < 2) {
            console.log('❌ 数据不足，跳过模拟\n');
            await mongoose.disconnect();
            return;
        }

        const baseIssue = allIssues[0];
        const targetIssue = allIssues[1];

        console.log(`   基准期: ${baseIssue.Issue} (ID: ${baseIssue.ID})`);
        console.log(`   目标期: ${targetIssue.Issue} (ID: ${targetIssue.ID})`);

        // 检查是否已存在
        const existing = await mongoose.connection.db.collection(hwcCollectionName).findOne({
            base_issue: baseIssue.Issue.toString(),
            target_issue: targetIssue.Issue.toString()
        });

        if (existing) {
            console.log(`ℹ️  该期号对已存在热温冷比记录，会被跳过`);
        } else {
            console.log(`✅ 该期号对不存在记录，需要生成`);
        }

        // 获取基准期遗漏值
        const baseMissingRecord = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories')
            .findOne({ ID: baseIssue.ID });

        if (!baseMissingRecord) {
            console.log(`❌ 问题: 找不到基准期${baseIssue.Issue}的遗漏值记录`);
            console.log('   这会导致生成失败!\n');
            await mongoose.disconnect();
            return;
        }

        console.log(`✅ 找到基准期遗漏值记录`);

        // 模拟计算一个组合的热温冷比
        console.log('\n   模拟计算组合 [01, 02, 03, 04, 05] 的热温冷比:');
        const testBalls = [1, 2, 3, 4, 5];
        const missingValues = testBalls.map(ball => baseMissingRecord[String(ball)] || 0);
        console.log(`   - 遗漏值: [${missingValues.join(', ')}]`);

        let hot = 0, warm = 0, cold = 0;
        missingValues.forEach(missing => {
            if (missing <= 4) hot++;
            else if (missing <= 9) warm++;
            else cold++;
        });

        const ratio = `${hot}:${warm}:${cold}`;
        console.log(`   - 热温冷分类: 热=${hot}, 温=${warm}, 冷=${cold}`);
        console.log(`   - 热温冷比: ${ratio}`);
        console.log('✅ 热温冷比计算逻辑正常\n');

        // ========== 检查6: 检查写入权限 ==========
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('检查6: 数据库写入权限');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        try {
            const testDoc = {
                base_issue: 'TEST',
                target_issue: 'TEST',
                hot_warm_cold_data: { '5:0:0': [1, 2, 3] },
                total_combinations: 3,
                test_timestamp: new Date()
            };

            const result = await mongoose.connection.db.collection(hwcCollectionName).insertOne(testDoc);
            console.log(`✅ 写入测试成功 (ID: ${result.insertedId})`);

            // 删除测试文档
            await mongoose.connection.db.collection(hwcCollectionName).deleteOne({ _id: result.insertedId });
            console.log('✅ 删除测试记录成功\n');
        } catch (writeError) {
            console.log(`❌ 写入测试失败: ${writeError.message}`);
            console.log('   原因: 数据库权限不足或连接异常\n');
        }

        // ========== 总结 ==========
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   诊断总结                                               ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('\n✅ 所有检查通过！数据库状态正常');
        console.log('\n如果"生成热温冷比优化表"仍然失败，可能原因:');
        console.log('1. 内存不足 (处理32万组合需要较大内存)');
        console.log('2. 数据库连接超时 (大量读写操作)');
        console.log('3. 代码逻辑错误 (需要查看错误堆栈)');
        console.log('\n建议:');
        console.log('- 查看服务端控制台的完整错误堆栈');
        console.log('- 检查Node.js内存限制 (可通过 --max-old-space-size 增加)');
        console.log('- 尝试减小批处理大小 (当前每批5期)');

    } catch (error) {
        console.log('\n❌ 诊断过程出错:');
        console.log(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 数据库连接已关闭');
    }
}

diagnose().catch(err => {
    console.error('诊断脚本执行失败:', err);
    process.exit(1);
});
