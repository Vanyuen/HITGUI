/**
 * 诊断25124和25125期号为0的问题
 */

const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const hit_dlts = mongoose.connection.collection('hit_dlts');
        const tasks = mongoose.connection.collection('hwc_positive_tasks');
        const results = mongoose.connection.collection('hwc_positive_task_results');

        // 1. 检查最新已开奖期号
        console.log('='.repeat(80));
        console.log('📊 第一步：检查数据库最新期号');
        console.log('='.repeat(80));
        const latestRecord = await hit_dlts.findOne({}, { sort: { Issue: -1 } });
        console.log(`最新已开奖期号: ${latestRecord.Issue}`);
        console.log(`最新记录ID: ${latestRecord.ID}\n`);

        // 2. 检查关键期号是否存在
        console.log('='.repeat(80));
        console.log('🔍 第二步：检查关键期号是否存在于数据库');
        console.log('='.repeat(80));
        const issue25124 = await hit_dlts.findOne({ Issue: 25124 });
        const issue25123 = await hit_dlts.findOne({ Issue: 25123 });
        const issue25122 = await hit_dlts.findOne({ Issue: 25122 });

        console.log(`25124存在: ${!!issue25124}, ID: ${issue25124?.ID || 'N/A'}`);
        console.log(`25123存在: ${!!issue25123}, ID: ${issue25123?.ID || 'N/A'}`);
        console.log(`25122存在: ${!!issue25122}, ID: ${issue25122?.ID || 'N/A'}\n`);

        // 3. 检查最新任务的期号对配置
        console.log('='.repeat(80));
        console.log('📋 第三步：检查最新任务的期号对配置');
        console.log('='.repeat(80));
        const latestTask = await tasks.findOne({}, { sort: { created_at: -1 } });

        if (!latestTask) {
            console.log('❌ 未找到任何任务！');
        } else {
            console.log(`任务ID: ${latestTask._id}`);
            console.log(`任务名称: ${latestTask.task_name}`);
            console.log(`创建时间: ${latestTask.created_at}`);
            console.log(`期号对数量: ${latestTask.issue_pairs?.length || 0}`);

            if (latestTask.issue_pairs && latestTask.issue_pairs.length > 0) {
                console.log('\n期号对列表（全部）:');
                latestTask.issue_pairs.forEach((pair, i) => {
                    console.log(`  ${i+1}. ${pair.base_issue} → ${pair.target_issue} ${pair.is_predicted ? '(推算)' : '(已开奖)'}`);
                });
            }
        }

        // 4. 检查任务结果
        console.log('\n' + '='.repeat(80));
        console.log('📊 第四步：检查各期任务结果');
        console.log('='.repeat(80));

        const taskResults = await results.find({
            task_id: latestTask?._id
        }).sort({ period: -1 }).toArray();

        console.log(`找到 ${taskResults.length} 个结果记录\n`);

        taskResults.forEach(result => {
            console.log(`期号 ${result.period}:`);
            console.log(`  组合数: ${result.combination_count || 0}`);
            console.log(`  基准期: ${result.base_period || 'N/A'}`);
            console.log(`  是否推算: ${result.is_predicted || false}`);
            console.log(`  红球最高命中: ${result.hit_analysis?.max_red_hits || 0}`);
            console.log(`  蓝球最高命中: ${result.hit_analysis?.max_blue_hits || 0}`);
            if (result.error) {
                console.log(`  ❌ 错误: ${result.error}`);
            }
            console.log('');
        });

        // 5. 检查热温冷优化表
        console.log('='.repeat(80));
        console.log('🔥 第五步：检查热温冷优化表数据');
        console.log('='.repeat(80));

        const hwcOptimized = mongoose.connection.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

        // 检查25124的数据（基准期25123）
        if (issue25123 && issue25124) {
            const hwc25124 = await hwcOptimized.countDocuments({
                base_issue: 25123,
                target_issue: 25124
            });
            console.log(`期号对 25123→25124 的热温冷数据: ${hwc25124} 条`);
        }

        // 检查25123的数据（基准期25122）
        if (issue25122 && issue25123) {
            const hwc25123 = await hwcOptimized.countDocuments({
                base_issue: 25122,
                target_issue: 25123
            });
            console.log(`期号对 25122→25123 的热温冷数据: ${hwc25123} 条`);
        }

        // 检查25120的数据（基准期25119）
        const hwc25120 = await hwcOptimized.countDocuments({
            base_issue: 25119,
            target_issue: 25120
        });
        console.log(`期号对 25119→25120 的热温冷数据: ${hwc25120} 条（对比参考）`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ 诊断完成！');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnose();
