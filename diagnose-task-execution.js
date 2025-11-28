const mongoose = require('mongoose');

console.log('🔍 诊断任务执行情况...\n');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 获取最新任务配置
        const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { _id: -1 } });

        console.log('📋 最新任务配置:\n');
        console.log(`任务ID: ${task.task_id}`);
        console.log(`任务名称: ${task.task_name}`);
        console.log(`创建时间: ${task.created_at}`);
        console.log(`\n期号范围配置:`);
        console.log(JSON.stringify(task.period_range, null, 2));

        console.log(`\n同现比配置:`);
        console.log(JSON.stringify(task.exclusion_conditions.coOccurrence, null, 2));

        // 2. 检查期号25118是否存在于数据库
        const issue25118 = await mongoose.connection.db.collection('hit_dlts')
            .findOne({ Issue: 25118 }, { projection: { Issue: 1, ID: 1, Red1: 1, Red2: 1, Red3: 1, Red4: 1, Red5: 1, Blue1: 1, Blue2: 1 } });

        console.log(`\n\n📊 期号25118数据库记录:`);
        if (issue25118) {
            console.log(`✅ 存在: ID=${issue25118.ID}, 红球=${issue25118.Red1},${issue25118.Red2},${issue25118.Red3},${issue25118.Red4},${issue25118.Red5}, 蓝球=${issue25118.Blue1},${issue25118.Blue2}`);
            console.log(`⚠️ 这是一个已开奖的历史期号，不应该标记为"推算"`);
        } else {
            console.log('❌ 不存在（这期尚未开奖）');
        }

        // 3. 分析为什么标记为推算
        console.log(`\n\n🔍 分析is_predicted标记逻辑:`);
        console.log(`- 如果期号在数据库中存在 → should be is_predicted=false (历史期)`);
        console.log(`- 如果期号在数据库中不存在 → should be is_predicted=true (推算期)`);

        // 4. 检查最新几期的存在性
        const targetIssues = [25118, 25119, 25120, 25121, 25122, 25123, 25124, 25125];
        console.log(`\n📋 各期号数据库存在性检查:\n`);

        for (const issue of targetIssues) {
            const record = await mongoose.connection.db.collection('hit_dlts')
                .findOne({ Issue: issue }, { projection: { Issue: 1, ID: 1 } });

            const exists = record ? '✅' : '❌';
            const id = record ? `ID=${record.ID}` : '不存在';
            const shouldBePredicted = record ? 'false (历史)' : 'true (推算)';

            console.log(`${exists} 期号${issue}: ${id}, 应标记为is_predicted=${shouldBePredicted}`);
        }

        // 5. 检查任务结果的实际标记
        console.log(`\n\n📊 任务结果实际标记:\n`);
        const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .sort({ period: 1 })
            .toArray();

        results.forEach(r => {
            const mark = r.is_predicted ? '(推算)' : '(历史)';
            const combo = r.combination_count;
            console.log(`期号${r.period} ${mark}: ${combo}个组合, 实际is_predicted=${r.is_predicted}`);
        });

        // 6. 对比分析
        console.log(`\n\n⚠️ 错误标记分析:\n`);
        for (const r of results) {
            const dbRecord = await mongoose.connection.db.collection('hit_dlts')
                .findOne({ Issue: r.period });

            const shouldBe = dbRecord ? false : true;
            const actualIs = r.is_predicted;

            if (shouldBe !== actualIs) {
                console.log(`❌ 期号${r.period}: 应该是${shouldBe ? '推算' : '历史'}，但标记为${actualIs ? '推算' : '历史'}`);
            }
        }

        console.log('\n\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
