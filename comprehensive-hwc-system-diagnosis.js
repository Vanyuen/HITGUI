const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function comprehensiveDiagnosis() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🕵️ 全面诊断热温冷批量预测系统 ...\n');

    // 1. 检查所有可能的集合名变体
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('🔍 数据库中的集合:');
    const potentialHWCCollections = collections.filter(col =>
        col.name.toLowerCase().includes('hwc') ||
        col.name.toLowerCase().includes('hotwarmcold') ||
        col.name.toLowerCase().includes('redcombinations')
    );

    console.log('潜在热温冷相关集合:');
    potentialHWCCollections.forEach(col => {
        console.log(`  - ${col.name}`);
    });

    // 2. 检查热温冷任务和结果集合
    const taskCollections = [
        'HIT_DLT_HwcPositivePredictionTasks',
        'hit_dlt_hwcpositivepredictiontasks',
        'HIT_DLT_HwcPositivePredictionTaskResults',
        'hit_dlt_hwcpositivepredictiontaskresults'
    ];

    console.log('\n🔬 检查热温冷任务和结果集合:');
    for (const collectionName of taskCollections) {
        const Model = mongoose.model(collectionName,
            new mongoose.Schema({}, { strict: false }),
            collectionName
        );

        const count = await Model.countDocuments();
        const recentTasks = await Model.find().sort({ created_at: -1 }).limit(5);

        console.log(`\n集合: ${collectionName}`);
        console.log(`  总记录数: ${count}`);

        if (recentTasks.length > 0) {
            console.log('  最近任务示例:');
            recentTasks.forEach((task, index) => {
                console.log(`    任务 ${index + 1}:`);
                console.log(`      ID: ${task.task_id || 'N/A'}`);
                console.log(`      期号范围: ${JSON.stringify(task.period_range)}`);
                console.log(`      状态: ${task.status}`);
            });
        }
    }

    // 3. 检查服务器代码中的模型定义
    console.log('\n🔎 检查服务器代码中的模型定义');
    const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    const modelDefinitions = serverContent.match(/mongoose\.model\([^)]+\)/g) || [];
    const hwcModelDefinitions = modelDefinitions.filter(def =>
        def.toLowerCase().includes('hwc') ||
        def.toLowerCase().includes('hotwarmcold')
    );

    console.log('热温冷相关模型定义:');
    hwcModelDefinitions.forEach((def, index) => {
        console.log(`  模型 ${index + 1}: ${def}`);
    });

    // 4. 检查特定期号的HWC数据
    console.log('\n📊 检查特定期号HWC数据');
    const testPeriods = ['25121', '25122', '25123', '25124', '25125'];

    const HWCOptimizedCollections = [
        'hit_dlt_redcombinationshotwarmcoldoptimizeds',
        'HIT_DLT_RedCombinationsHotWarmColdOptimized',
        'hit_dlt_redcombinationshotwarmcoldoptimized'
    ];

    for (const collectionName of HWCOptimizedCollections) {
        console.log(`\n检查集合: ${collectionName}`);
        const Model = mongoose.model(collectionName,
            new mongoose.Schema({}, { strict: false }),
            collectionName
        );

        for (const period of testPeriods) {
            const data = await Model.findOne({
                $or: [
                    { base_issue: period },
                    { target_issue: period }
                ]
            });

            if (data) {
                console.log(`  ✅ 找到 ${period} 的数据`);
                const ratios = Object.keys(data.hot_warm_cold_data || {});
                console.log(`    可用比例: ${ratios.join(', ')}`);

                if (ratios.length > 0) {
                    const firstRatio = ratios[0];
                    const combinationCount = data.hot_warm_cold_data[firstRatio]?.length || 0;
                    console.log(`    ${firstRatio} 比例组合数: ${combinationCount}`);
                }
            } else {
                console.log(`  ❌ 未找到 ${period} 的数据`);
            }
        }
    }

    await mongoose.connection.close();
}

comprehensiveDiagnosis().catch(console.error);