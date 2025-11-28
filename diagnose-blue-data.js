const mongoose = require('mongoose');

// 连接数据库
async function diagnose() {
    try {
        console.log('🔍 开始诊断蓝球数据...\n');

        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 检查 PredictionTaskResult 表中的蓝球数据
        console.log('📊 === 检查 PredictionTaskResult 表 ===\n');

        const PredictionTaskResult = mongoose.model('PredictionTaskResult', new mongoose.Schema({}, { strict: false }));

        const totalResults = await PredictionTaskResult.countDocuments();
        console.log(`总记录数: ${totalResults}\n`);

        if (totalResults > 0) {
            // 获取最近10条记录
            const results = await PredictionTaskResult.find({})
                .sort({ created_at: -1 })
                .limit(10)
                .lean();

            console.log(`📋 最近10条记录的蓝球数据分析:\n`);

            results.forEach((r, idx) => {
                console.log(`--- 记录 ${idx + 1} ---`);
                console.log(`  任务ID: ${r.task_id || 'N/A'}`);
                console.log(`  期号: ${r.target_issue}`);
                console.log(`  配对模式: ${r.pairing_mode || 'N/A'}`);

                if (r.blue_combinations) {
                    console.log(`  blue_combinations类型: Array`);
                    console.log(`  blue_combinations长度: ${r.blue_combinations.length}`);

                    if (r.blue_combinations.length > 0) {
                        const first = r.blue_combinations[0];
                        const second = r.blue_combinations.length > 1 ? r.blue_combinations[1] : null;
                        const last = r.blue_combinations[r.blue_combinations.length - 1];

                        console.log(`  第1个元素: ${JSON.stringify(first)}`);
                        console.log(`    → 类型: ${Array.isArray(first) ? 'Array' : typeof first}`);
                        if (Array.isArray(first)) {
                            console.log(`    → 数组内容: [${first[0]}, ${first[1]}]`);
                            console.log(`    → ⚠️ 是否重复: ${first[0] === first[1] ? '是' : '否'}`);
                        }

                        if (second) {
                            console.log(`  第2个元素: ${JSON.stringify(second)}`);
                            console.log(`    → 类型: ${Array.isArray(second) ? 'Array' : typeof second}`);
                            if (Array.isArray(second)) {
                                console.log(`    → 数组内容: [${second[0]}, ${second[1]}]`);
                                console.log(`    → ⚠️ 是否重复: ${second[0] === second[1] ? '是' : '否'}`);
                            }
                        }

                        console.log(`  最后1个元素: ${JSON.stringify(last)}`);
                        console.log(`    → 类型: ${Array.isArray(last) ? 'Array' : typeof last}`);
                        if (Array.isArray(last)) {
                            console.log(`    → 数组内容: [${last[0]}, ${last[1]}]`);
                            console.log(`    → ⚠️ 是否重复: ${last[0] === last[1] ? '是' : '否'}`);
                        }
                    } else {
                        console.log(`  ⚠️ blue_combinations为空数组`);
                    }
                } else {
                    console.log(`  ⚠️ blue_combinations字段不存在`);
                }

                console.log('');
            });

            // 2. 统计数据格式
            console.log('\n📊 === 数据格式统计 ===\n');

            const allResults = await PredictionTaskResult.find({}).lean();
            let arrayFormatCount = 0;
            let idFormatCount = 0;
            let emptyCount = 0;
            let nullCount = 0;
            let duplicateCount = 0;

            allResults.forEach(r => {
                if (!r.blue_combinations) {
                    nullCount++;
                } else if (r.blue_combinations.length === 0) {
                    emptyCount++;
                } else {
                    const first = r.blue_combinations[0];
                    if (Array.isArray(first)) {
                        arrayFormatCount++;
                        // 检查是否有重复
                        const hasDuplicate = r.blue_combinations.some(arr =>
                            Array.isArray(arr) && arr.length === 2 && arr[0] === arr[1]
                        );
                        if (hasDuplicate) {
                            duplicateCount++;
                            console.log(`  ⚠️ 发现重复: 任务ID=${r.task_id}, 期号=${r.target_issue}`);
                        }
                    } else if (typeof first === 'number') {
                        idFormatCount++;
                    }
                }
            });

            console.log(`总记录数: ${allResults.length}`);
            console.log(`数组格式 [[1,2], [1,3], ...]: ${arrayFormatCount} 条`);
            console.log(`ID格式 [1, 2, 3, ...]: ${idFormatCount} 条`);
            console.log(`空数组: ${emptyCount} 条`);
            console.log(`null/undefined: ${nullCount} 条`);
            console.log(`🚨 包含重复蓝球的记录: ${duplicateCount} 条`);
        }

        // 3. 检查 DLTBlueCombinations 表
        console.log('\n\n📊 === 检查 DLTBlueCombinations 表 ===\n');

        const DLTBlueCombinations = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

        const totalBlue = await DLTBlueCombinations.countDocuments();
        console.log(`总记录数: ${totalBlue}\n`);

        if (totalBlue > 0) {
            // 检查是否有重复的蓝球组合
            const blueCombos = await DLTBlueCombinations.find({}).lean();

            let duplicatesInDB = 0;
            const duplicateRecords = [];

            blueCombos.forEach(bc => {
                if (bc.blue_ball_1 === bc.blue_ball_2) {
                    duplicatesInDB++;
                    duplicateRecords.push(bc);
                }
            });

            console.log(`🚨 数据库中蓝球1=蓝球2的记录数: ${duplicatesInDB}\n`);

            if (duplicatesInDB > 0) {
                console.log('重复记录详情:');
                duplicateRecords.forEach(rec => {
                    console.log(`  ID=${rec.combination_id}, 蓝球1=${rec.blue_ball_1}, 蓝球2=${rec.blue_ball_2}`);
                });
            }

            // 显示前5个正常记录
            console.log('\n前5个蓝球组合记录:');
            blueCombos.slice(0, 5).forEach(bc => {
                console.log(`  ID=${bc.combination_id}, 蓝球=[${bc.blue_ball_1}, ${bc.blue_ball_2}], 和值=${bc.sum_value}`);
            });
        }

        // 4. 检查最近的任务
        console.log('\n\n📊 === 检查最近的预测任务 ===\n');

        const PredictionTask = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false }));

        const recentTasks = await PredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        console.log(`最近5个任务:\n`);
        recentTasks.forEach((task, idx) => {
            console.log(`--- 任务 ${idx + 1} ---`);
            console.log(`  任务ID: ${task._id}`);
            console.log(`  任务名称: ${task.task_name}`);
            console.log(`  状态: ${task.status}`);
            console.log(`  期号范围: ${task.target_issues ? task.target_issues.length + '期' : 'N/A'}`);
            console.log(`  配对模式: ${task.exclusion_conditions?.combinationMode || 'N/A'}`);
            console.log(`  创建时间: ${task.created_at}`);
            console.log('');
        });

        console.log('\n✅ 诊断完成！\n');

    } catch (error) {
        console.error('❌ 诊断过程出错:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 数据库连接已关闭');
    }
}

diagnose();
