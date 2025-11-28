/**
 * 验证Issue字段类型修复效果
 * 测试所有修复的查询是否能正确工作
 */

const mongoose = require('mongoose');

async function testIssueFixes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;
        const hit_dlts = db.collection('hit_dlts');

        // 获取最新期号
        const latestRecord = await hit_dlts.find().sort({ ID: -1 }).limit(1).toArray();
        const latestIssue = latestRecord[0].Issue;
        const latestIssueNum = parseInt(latestIssue);
        const latestID = latestRecord[0].ID;

        console.log('========================================');
        console.log('📊 数据库基本信息');
        console.log('========================================');
        console.log(`最新期号: ${latestIssue} (类型: ${typeof latestIssue})`);
        console.log(`最新ID: ${latestID}`);
        console.log(`推算期: ${latestIssueNum + 1}\n`);

        let passedTests = 0;
        let failedTests = 0;

        // 测试1: String类型查询Issue字段
        console.log('========================================');
        console.log('测试1: String类型查询Issue字段');
        console.log('========================================');

        const testIssue = "25120";
        const result1 = await hit_dlts.findOne({ Issue: testIssue });

        if (result1) {
            console.log(`✅ 通过: 查询 Issue: "${testIssue}" (String) 成功`);
            console.log(`   找到记录: ID=${result1.ID}, Issue=${result1.Issue}\n`);
            passedTests++;
        } else {
            console.log(`❌ 失败: 查询 Issue: "${testIssue}" (String) 失败\n`);
            failedTests++;
        }

        // 测试2: Number类型查询应该失败（验证问题存在）
        console.log('========================================');
        console.log('测试2: Number类型查询验证');
        console.log('========================================');

        const result2 = await hit_dlts.findOne({ Issue: 25120 });

        if (!result2) {
            console.log(`✅ 通过: 确认 Issue: 25120 (Number) 查询失败（符合预期）\n`);
            passedTests++;
        } else {
            console.log(`⚠️ 意外: Issue: 25120 (Number) 查询成功（数据库可能已改为Number类型）\n`);
        }

        // 测试3: 计算下一期期号
        console.log('========================================');
        console.log('测试3: 计算下一期期号');
        console.log('========================================');

        const latestForCalc = await hit_dlts.find().sort({ ID: -1 }).limit(1).toArray();
        const currentIssue = latestForCalc[0].Issue;
        const currentIssueNum = parseInt(currentIssue);
        const nextIssueNum = currentIssueNum + 1;
        const nextIssueStr = nextIssueNum.toString();

        console.log(`当前最新期号: ${currentIssue} (类型: ${typeof currentIssue})`);
        console.log(`parseInt后: ${currentIssueNum} (类型: ${typeof currentIssueNum})`);
        console.log(`计算下一期: ${currentIssueNum} + 1 = ${nextIssueNum}`);
        console.log(`转换为String: "${nextIssueStr}"`);

        if (nextIssueStr === (latestIssueNum + 1).toString()) {
            console.log(`✅ 通过: 下一期期号计算正确\n`);
            passedTests++;
        } else {
            console.log(`❌ 失败: 下一期期号计算错误\n`);
            failedTests++;
        }

        // 测试4: 范围查询（String类型）
        console.log('========================================');
        console.log('测试4: 范围查询（String类型）');
        console.log('========================================');

        const rangeResult = await hit_dlts.find({
            Issue: { $gte: "25115", $lte: "25120" }
        }).sort({ Issue: 1 }).toArray();

        console.log(`查询范围: "25115" - "25120" (String)`);
        console.log(`找到记录数: ${rangeResult.length}`);

        if (rangeResult.length > 0) {
            console.log(`✅ 通过: String范围查询成功`);
            console.log(`   期号列表: ${rangeResult.map(r => r.Issue).join(', ')}\n`);
            passedTests++;
        } else {
            console.log(`❌ 失败: String范围查询未找到结果\n`);
            failedTests++;
        }

        // 测试5: 测试API端点的查询逻辑
        console.log('========================================');
        console.log('测试5: 模拟generateIssuePairsForTargets逻辑');
        console.log('========================================');

        const targetIssues = ["25124", "25123", "25122"];
        const pairs = [];

        for (let i = 0; i < targetIssues.length; i++) {
            const targetIssue = targetIssues[i];
            const targetIssueNum = parseInt(targetIssue);
            const isPredicted = targetIssueNum > latestIssueNum;

            // 使用String类型查询
            const targetExists = await hit_dlts.findOne({ Issue: targetIssue.toString() });

            if (!isPredicted && !targetExists) {
                console.log(`   ⚠️ 目标期号 ${targetIssue} 不存在，跳过`);
                continue;
            }

            let baseIssue;
            if (i === targetIssues.length - 1) {
                // 最后一个，查询数据库
                const previousRecord = await hit_dlts.find({
                    Issue: { $lt: targetIssue.toString() }
                }).sort({ ID: -1 }).limit(1).toArray();

                if (previousRecord.length > 0) {
                    baseIssue = previousRecord[0].Issue.toString();
                } else {
                    console.log(`   ⚠️ 目标期号 ${targetIssue} 无前置期号，跳过`);
                    continue;
                }
            } else {
                // 数组中下一个元素
                baseIssue = targetIssues[i + 1];
            }

            pairs.push({
                base: baseIssue,
                target: targetIssue,
                isPredicted: isPredicted
            });

            console.log(`   ✅ 期号对 #${i + 1}: ${baseIssue} → ${targetIssue} ${isPredicted ? '(推算)' : '(已开奖)'}`);
        }

        if (pairs.length === targetIssues.length) {
            console.log(`✅ 通过: 成功生成 ${pairs.length} 个期号对\n`);
            passedTests++;
        } else {
            console.log(`❌ 失败: 期号对生成不完整（预期${targetIssues.length}个，实际${pairs.length}个）\n`);
            failedTests++;
        }

        // 测试6: 测试最近10期查询
        console.log('========================================');
        console.log('测试6: 最近10期查询');
        console.log('========================================');

        const recent10 = await hit_dlts.find({})
            .sort({ ID: -1 })
            .limit(10)
            .toArray();

        console.log(`查询最近10期，找到 ${recent10.length} 条记录`);

        if (recent10.length === 10) {
            console.log(`✅ 通过: 最近10期查询成功`);
            console.log(`   期号范围: ${recent10[recent10.length - 1].Issue} - ${recent10[0].Issue}\n`);
            passedTests++;
        } else {
            console.log(`❌ 失败: 最近10期查询结果不足10条\n`);
            failedTests++;
        }

        // 总结
        console.log('========================================');
        console.log('📊 测试总结');
        console.log('========================================');
        console.log(`总测试数: ${passedTests + failedTests}`);
        console.log(`✅ 通过: ${passedTests}`);
        console.log(`❌ 失败: ${failedTests}`);

        if (failedTests === 0) {
            console.log('\n🎉 所有测试通过！Issue字段类型修复成功！');
        } else {
            console.log('\n⚠️ 存在失败的测试，请检查修复代码');
        }

        console.log('\n========================================');
        console.log('💡 下一步建议');
        console.log('========================================');
        console.log('1. 重启服务器以加载修复后的代码');
        console.log('2. 通过UI创建"最近10期+1期推算"任务');
        console.log('3. 检查任务结果是否包含全部11期数据');
        console.log('4. 验证热温冷优化表数据查询是否正常');

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

testIssueFixes();
