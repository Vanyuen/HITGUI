require('dotenv').config();
const mongoose = require('mongoose');

async function testConsecutiveBug() {
    console.log('=== 连号排除功能完整测试 ===\n');

    try {
        // 1. 连接数据库
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lottery';
        await mongoose.connect(MONGO_URI);
        console.log('✅ 数据库连接成功\n');

        // 2. 检查数据库中连号字段数据
        console.log('📊 步骤1: 检查数据库连号字段数据');
        const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations', new mongoose.Schema({}, { strict: false }), 'hit_dlt_redcombinations');

        const totalCount = await DLTRedCombinations.countDocuments({});
        console.log(`   总记录数: ${totalCount.toLocaleString()}`);

        const noConsecutiveCount = await DLTRedCombinations.countDocuments({ consecutive_groups: 0 });
        console.log(`   无连号(consecutive_groups=0): ${noConsecutiveCount.toLocaleString()}`);

        const nullCount = await DLTRedCombinations.countDocuments({
            $or: [
                { consecutive_groups: null },
                { consecutive_groups: { $exists: false } }
            ]
        });
        console.log(`   字段为null/不存在: ${nullCount.toLocaleString()}`);

        if (nullCount > 0) {
            console.log('   ❌ 问题: 存在未填充的连号字段！');
            console.log('   解决: 需要运行 migrate-consecutive-fields.js');
            return;
        }
        console.log('   ✅ 数据完整性检查通过\n');

        // 3. 测试查询逻辑
        console.log('📊 步骤2: 测试MongoDB查询逻辑');

        // 测试1: 不带排除条件
        const query1 = {};
        const count1 = await DLTRedCombinations.countDocuments(query1);
        console.log(`   查询1 - 无排除条件:`);
        console.log(`   query: ${JSON.stringify(query1)}`);
        console.log(`   结果: ${count1.toLocaleString()} 条\n`);

        // 测试2: 排除无连号 (consecutive_groups = 0)
        const query2 = { $nor: [{ consecutive_groups: 0 }] };
        const count2 = await DLTRedCombinations.countDocuments(query2);
        console.log(`   查询2 - 排除无连号 (consecutive_groups=0):`);
        console.log(`   query: ${JSON.stringify(query2)}`);
        console.log(`   结果: ${count2.toLocaleString()} 条`);
        console.log(`   排除: ${(count1 - count2).toLocaleString()} 条`);
        console.log(`   预期排除: ${noConsecutiveCount.toLocaleString()} 条`);

        if (count1 - count2 === noConsecutiveCount) {
            console.log('   ✅ 查询逻辑正确\n');
        } else {
            console.log('   ❌ 查询逻辑有问题！\n');
            return;
        }

        // 4. 检查Schema定义
        console.log('📊 步骤3: 检查PredictionTask Schema');

        // 定义Schema
        const predictionTaskSchema = new mongoose.Schema({
            task_id: { type: String, required: true, unique: true },
            task_name: { type: String, required: true },
            period_range: {
                start: { type: Number, required: true },
                end: { type: Number, required: true },
                total: { type: Number, required: true }
            },
            exclude_conditions: {
                sum: { type: Object },
                span: { type: Object },
                hwc: { type: Object },
                zone: { type: Object },
                oddEven: { type: Object },
                conflict: { type: Object },
                coOccurrence: { type: Object },
                coOccurrencePerBall: { type: Object },
                coOccurrenceByIssues: { type: Object },
                consecutiveGroups: { type: [Number] },
                maxConsecutiveLength: { type: [Number] }
            },
            output_config: {
                combination_mode: { type: String, required: true },
                enable_validation: { type: Boolean, default: true },
                display_mode: { type: String }
            },
            status: {
                type: String,
                required: true,
                enum: ['pending', 'running', 'completed', 'failed'],
                default: 'pending'
            },
            progress: {
                current: { type: Number, default: 0 },
                total: { type: Number, required: true },
                percentage: { type: Number, default: 0 }
            },
            created_at: { type: Date, default: Date.now },
            updated_at: { type: Date, default: Date.now }
        });

        const PredictionTask = mongoose.model('HIT_DLT_PredictionTask', predictionTaskSchema, 'hit_dlt_predictiontasks');
        const schemaObj = PredictionTask.schema.obj;

        console.log('   exclude_conditions字段:');
        if (schemaObj.exclude_conditions) {
            const excludeFields = Object.keys(schemaObj.exclude_conditions);
            console.log(`   定义的字段: ${excludeFields.join(', ')}`);

            if (excludeFields.includes('consecutiveGroups')) {
                console.log('   ✅ consecutiveGroups 字段已定义');
            } else {
                console.log('   ❌ consecutiveGroups 字段未定义！');
                console.log('   解决: 需要在Schema中添加 consecutiveGroups: { type: [Number] }');
                return;
            }

            if (excludeFields.includes('maxConsecutiveLength')) {
                console.log('   ✅ maxConsecutiveLength 字段已定义');
            } else {
                console.log('   ❌ maxConsecutiveLength 字段未定义！');
                console.log('   解决: 需要在Schema中添加 maxConsecutiveLength: { type: [Number] }');
                return;
            }
        } else {
            console.log('   ❌ exclude_conditions 未定义！');
            return;
        }
        console.log('   ✅ Schema定义检查通过\n');

        // 5. 模拟创建任务并保存到数据库
        console.log('📊 步骤4: 模拟任务创建和保存');
        const testTaskData = {
            task_id: `test_${Date.now()}`,
            task_name: '测试任务-连号排除',
            period_range: {
                start: 25001,
                end: 25010,
                total: 10
            },
            exclude_conditions: {
                consecutiveGroups: [0],
                maxConsecutiveLength: [4, 5]
            },
            output_config: {
                combination_mode: 'unlimited',
                enable_validation: true,
                display_mode: 'comprehensive'
            },
            status: 'pending',
            progress: {
                current: 0,
                total: 10,
                percentage: 0
            }
        };

        console.log('   创建测试任务...');
        console.log('   exclude_conditions:', JSON.stringify(testTaskData.exclude_conditions, null, 2));

        const testTask = new PredictionTask(testTaskData);
        await testTask.save();
        console.log(`   ✅ 任务已保存: ${testTask.task_id}\n`);

        // 6. 从数据库读取任务验证
        console.log('📊 步骤5: 从数据库读取任务验证');
        const savedTask = await PredictionTask.findOne({ task_id: testTask.task_id }).lean();

        console.log('   读取的exclude_conditions:');
        console.log(JSON.stringify(savedTask.exclude_conditions, null, 2));

        if (savedTask.exclude_conditions.consecutiveGroups) {
            console.log(`   ✅ consecutiveGroups 已保存: ${savedTask.exclude_conditions.consecutiveGroups}`);
        } else {
            console.log('   ❌ consecutiveGroups 未保存到数据库！');
            console.log('   原因: Schema定义可能需要重启应用才能生效');
            return;
        }

        if (savedTask.exclude_conditions.maxConsecutiveLength) {
            console.log(`   ✅ maxConsecutiveLength 已保存: ${savedTask.exclude_conditions.maxConsecutiveLength}`);
        } else {
            console.log('   ❌ maxConsecutiveLength 未保存到数据库！');
            return;
        }
        console.log('   ✅ 数据库保存验证通过\n');

        // 7. 测试查询构建
        console.log('📊 步骤6: 测试查询构建逻辑');
        const excludeConditions = savedTask.exclude_conditions;
        const builtQuery = {};

        if (excludeConditions.consecutiveGroups && excludeConditions.consecutiveGroups.length > 0) {
            builtQuery.$nor = builtQuery.$nor || [];
            excludeConditions.consecutiveGroups.forEach(groups => {
                builtQuery.$nor.push({ consecutive_groups: groups });
            });
            console.log(`   ✅ 添加连号组数排除: ${excludeConditions.consecutiveGroups.join(', ')}`);
        }

        if (excludeConditions.maxConsecutiveLength && excludeConditions.maxConsecutiveLength.length > 0) {
            builtQuery.$nor = builtQuery.$nor || [];
            excludeConditions.maxConsecutiveLength.forEach(length => {
                builtQuery.$nor.push({ max_consecutive_length: length });
            });
            console.log(`   ✅ 添加长连号排除: ${excludeConditions.maxConsecutiveLength.join(', ')}`);
        }

        console.log('   构建的查询:', JSON.stringify(builtQuery, null, 2));

        const filteredCount = await DLTRedCombinations.countDocuments(builtQuery);
        console.log(`   查询结果: ${filteredCount.toLocaleString()} 条`);
        console.log(`   排除: ${(totalCount - filteredCount).toLocaleString()} 条`);
        console.log('   ✅ 查询构建测试通过\n');

        // 清理测试数据
        await PredictionTask.deleteOne({ task_id: testTask.task_id });
        console.log('   ✅ 测试数据已清理\n');

        console.log('=== 所有测试通过 ===');
        console.log('✅ 连号排除功能应该可以正常工作了');
        console.log('⚠️ 如果应用中还是不工作，请重启应用（Schema修改需要重启）');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n📦 数据库连接已关闭');
    }
}

testConsecutiveBug().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
});
