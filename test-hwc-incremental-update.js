/**
 * 热温冷优化表增量更新测试脚本
 *
 * 测试目标：
 * 1. 验证三步增量更新流程
 * 2. 验证 target_id 正确性（推算期应使用 latest_ID + 1，而非 0）
 * 3. 验证旧推算期数据被删除
 * 4. 验证新开奖期和新推算期数据正确生成
 * 5. 验证 API 端点功能
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 数据库连接
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');
}

// Schema 定义（与 server.js 保持一致）
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: Number, required: true },
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
}, { collection: 'hit_dlts', strict: false });

const hwcOptimizedSchema = new mongoose.Schema({
    base_issue: String,
    target_issue: String,
    base_id: Number,
    target_id: Number,
    is_predicted: Boolean,
    hot_warm_cold_data: Object,
    hit_analysis: Object,
    statistics: Object,
    version: Number,
    last_updated: Date,
    created_at: Date
}, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds', strict: false });

const hit_dlts = mongoose.model('hit_dlts_test', dltSchema);
const HwcOptimized = mongoose.model('HwcOptimized_test', hwcOptimizedSchema);

/**
 * 测试1：验证 Schema 新增字段
 */
async function test1_VerifySchemaFields() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 测试1: 验证 Schema 新增字段');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        const sampleRecord = await HwcOptimized.findOne({}).lean();

        if (!sampleRecord) {
            console.log('⚠️  数据库为空，跳过字段验证\n');
            return { passed: false, reason: '数据库为空' };
        }

        const requiredFields = ['base_id', 'target_id', 'is_predicted', 'version', 'last_updated'];
        const missingFields = requiredFields.filter(field => !(field in sampleRecord));

        if (missingFields.length > 0) {
            console.log(`❌ 测试失败: 缺少字段 ${missingFields.join(', ')}\n`);
            return { passed: false, reason: `缺少字段: ${missingFields.join(', ')}` };
        }

        console.log('✅ 所有必需字段存在:');
        requiredFields.forEach(field => {
            console.log(`   - ${field}: ${sampleRecord[field]}`);
        });
        console.log();

        return { passed: true };

    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}\n`);
        return { passed: false, reason: error.message };
    }
}

/**
 * 测试2: 验证推算期 target_id 正确性
 */
async function test2_VerifyPredictedTargetId() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 测试2: 验证推算期 target_id 正确性');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. 获取数据库最新 ID
        const latestDbRecord = await hit_dlts.findOne({}).sort({ ID: -1 }).lean();
        if (!latestDbRecord) {
            console.log('⚠️  数据库无开奖记录\n');
            return { passed: false, reason: '数据库无开奖记录' };
        }

        const latestId = latestDbRecord.ID;
        const expectedPredictedId = latestId + 1;

        console.log(`   数据库最新 ID: ${latestId}`);
        console.log(`   预期推算期 target_id: ${expectedPredictedId}\n`);

        // 2. 查询推算期记录
        const predictedRecords = await HwcOptimized.find({ is_predicted: true }).lean();

        if (predictedRecords.length === 0) {
            console.log('⚠️  无推算期记录\n');
            return { passed: false, reason: '无推算期记录' };
        }

        console.log(`   找到 ${predictedRecords.length} 条推算期记录:\n`);

        let allCorrect = true;
        for (const record of predictedRecords) {
            const isCorrect = record.target_id === expectedPredictedId;
            const symbol = isCorrect ? '✅' : '❌';

            console.log(`   ${symbol} ${record.base_issue} → ${record.target_issue}`);
            console.log(`      target_id: ${record.target_id} (预期: ${expectedPredictedId})`);
            console.log(`      is_predicted: ${record.is_predicted}\n`);

            if (!isCorrect) {
                allCorrect = false;
            }
        }

        // 3. 检查是否有 target_id = 0 的记录（不应该有）
        const zeroIdCount = await HwcOptimized.countDocuments({ target_id: 0 });
        console.log(`   target_id=0 的记录数: ${zeroIdCount} ${zeroIdCount === 0 ? '✅' : '❌'}\n`);

        if (zeroIdCount > 0) {
            console.log(`❌ 测试失败: 存在 ${zeroIdCount} 条 target_id=0 的记录\n`);
            return { passed: false, reason: `存在 ${zeroIdCount} 条 target_id=0 的记录` };
        }

        if (!allCorrect) {
            console.log('❌ 测试失败: 推算期 target_id 不正确\n');
            return { passed: false, reason: '推算期 target_id 不正确' };
        }

        console.log('✅ 测试通过: 推算期 target_id 正确\n');
        return { passed: true };

    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}\n`);
        return { passed: false, reason: error.message };
    }
}

/**
 * 测试3: 验证 is_predicted 字段标识正确性
 */
async function test3_VerifyIsPredictedField() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 测试3: 验证 is_predicted 字段标识正确性');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. 统计各类记录数量
        const totalCount = await HwcOptimized.countDocuments({});
        const drawnCount = await HwcOptimized.countDocuments({ is_predicted: false });
        const predictedCount = await HwcOptimized.countDocuments({ is_predicted: true });

        console.log(`   总记录数: ${totalCount}`);
        console.log(`   已开奖期: ${drawnCount} (is_predicted: false)`);
        console.log(`   推算期: ${predictedCount} (is_predicted: true)\n`);

        // 2. 验证推算期数量（应该只有1条或0条）
        if (predictedCount > 1) {
            console.log(`❌ 测试失败: 推算期记录数异常 (${predictedCount} 条，应为 1 条)\n`);
            return { passed: false, reason: `推算期记录数异常: ${predictedCount}` };
        }

        // 3. 抽查已开奖期记录
        const drawnSamples = await HwcOptimized.find({ is_predicted: false }).limit(3).lean();
        console.log('   已开奖期记录抽查:');

        for (const record of drawnSamples) {
            const targetExists = await hit_dlts.findOne({ Issue: parseInt(record.target_issue) });
            const symbol = targetExists ? '✅' : '❌';

            console.log(`   ${symbol} ${record.base_issue} → ${record.target_issue}`);
            console.log(`      target_id: ${record.target_id}, 期号存在: ${!!targetExists}\n`);

            if (!targetExists) {
                console.log(`❌ 测试失败: 期号 ${record.target_issue} 不存在，但标记为已开奖\n`);
                return { passed: false, reason: `期号 ${record.target_issue} 标识错误` };
            }
        }

        // 4. 验证推算期记录
        const predictedSample = await HwcOptimized.findOne({ is_predicted: true }).lean();
        if (predictedSample) {
            const targetExists = await hit_dlts.findOne({ Issue: parseInt(predictedSample.target_issue) });

            console.log('   推算期记录验证:');
            console.log(`   ${!targetExists ? '✅' : '❌'} ${predictedSample.base_issue} → ${predictedSample.target_issue}`);
            console.log(`      target_id: ${predictedSample.target_id}, 期号存在: ${!!targetExists}\n`);

            if (targetExists) {
                console.log(`❌ 测试失败: 期号 ${predictedSample.target_issue} 已存在，但标记为推算期\n`);
                return { passed: false, reason: `期号 ${predictedSample.target_issue} 标识错误` };
            }
        }

        console.log('✅ 测试通过: is_predicted 字段标识正确\n');
        return { passed: true };

    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}\n`);
        return { passed: false, reason: error.message };
    }
}

/**
 * 测试4: 验证数据一致性
 */
async function test4_VerifyDataConsistency() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 测试4: 验证数据一致性');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. 验证期号对连续性（随机抽查10对）
        const drawnRecords = await HwcOptimized.find({ is_predicted: false })
            .sort({ target_id: -1 })
            .limit(10)
            .lean();

        console.log('   期号对连续性抽查:\n');

        let allConsistent = true;
        for (const record of drawnRecords) {
            const baseRecord = await hit_dlts.findOne({ Issue: parseInt(record.base_issue) }).lean();
            const targetRecord = await hit_dlts.findOne({ Issue: parseInt(record.target_issue) }).lean();

            if (!baseRecord || !targetRecord) {
                console.log(`   ❌ ${record.base_issue} → ${record.target_issue}: 期号记录不存在\n`);
                allConsistent = false;
                continue;
            }

            // 验证 base_id 和 target_id 是否正确
            const baseIdCorrect = record.base_id === baseRecord.ID;
            const targetIdCorrect = record.target_id === targetRecord.ID;

            // 验证是否为相邻期（ID 相差 1）
            const isAdjacent = targetRecord.ID === baseRecord.ID + 1;

            const symbol = (baseIdCorrect && targetIdCorrect && isAdjacent) ? '✅' : '❌';

            console.log(`   ${symbol} ${record.base_issue} → ${record.target_issue}`);
            console.log(`      base_id: ${record.base_id} (DB: ${baseRecord.ID}) ${baseIdCorrect ? '✅' : '❌'}`);
            console.log(`      target_id: ${record.target_id} (DB: ${targetRecord.ID}) ${targetIdCorrect ? '✅' : '❌'}`);
            console.log(`      ID连续性: ${isAdjacent ? '✅ 相邻' : '❌ 不相邻'}\n`);

            if (!baseIdCorrect || !targetIdCorrect || !isAdjacent) {
                allConsistent = false;
            }
        }

        if (!allConsistent) {
            console.log('❌ 测试失败: 数据一致性检查未通过\n');
            return { passed: false, reason: '数据一致性检查未通过' };
        }

        console.log('✅ 测试通过: 数据一致性正确\n');
        return { passed: true };

    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}\n`);
        return { passed: false, reason: error.message };
    }
}

/**
 * 测试5: API 端点测试（需要服务器运行）
 */
async function test5_VerifyAPIEndpoints() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 测试5: API 端点测试');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        const API_BASE_URL = 'http://localhost:3003';

        // 测试 5.1: 状态查询 API
        console.log('   测试 5.1: GET /api/dlt/hwc-optimized/status\n');

        const statusResponse = await fetch(`${API_BASE_URL}/api/dlt/hwc-optimized/status`);
        const statusData = await statusResponse.json();

        if (!statusData.success) {
            console.log('   ❌ 状态查询 API 失败\n');
            return { passed: false, reason: '状态查询 API 失败' };
        }

        console.log('   ✅ 状态查询成功:');
        console.log(`      总记录数: ${statusData.data.total_count}`);
        console.log(`      已开奖期: ${statusData.data.drawn_count}`);
        console.log(`      推算期: ${statusData.data.predicted_count}`);
        console.log(`      最新已开奖期号对: ${statusData.data.latest_drawn_pair}`);
        console.log(`      最新推算期号对: ${statusData.data.latest_predicted_pair}`);
        console.log(`      最新已开奖 target_id: ${statusData.data.latest_drawn_target_id}`);
        console.log(`      最新推算 target_id: ${statusData.data.latest_predicted_target_id}\n`);

        // 验证推算期 target_id
        const latestDbId = await hit_dlts.findOne({}).sort({ ID: -1 }).select('ID').lean();
        const expectedPredictedId = latestDbId.ID + 1;

        if (statusData.data.latest_predicted_target_id !== expectedPredictedId) {
            console.log(`   ❌ 推算期 target_id 不正确: ${statusData.data.latest_predicted_target_id} (预期: ${expectedPredictedId})\n`);
            return { passed: false, reason: '推算期 target_id 不正确' };
        }

        console.log('   ✅ 推算期 target_id 正确\n');

        // 测试 5.2: 增量更新 API（可选，谨慎执行）
        console.log('   测试 5.2: POST /api/dlt/hwc-optimized/incremental-update (跳过)');
        console.log('   ⚠️  该接口会修改数据库，仅在需要时手动测试\n');

        console.log('✅ 测试通过: API 端点功能正常\n');
        return { passed: true };

    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}`);
        console.log(`   提示: 请确保服务器运行在 http://localhost:3003\n`);
        return { passed: false, reason: error.message };
    }
}

/**
 * 主测试函数
 */
async function runAllTests() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   热温冷优化表增量更新测试套件                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\n');

    const results = [];

    try {
        await connectDB();

        // 执行所有测试
        results.push({ name: '测试1: Schema字段验证', ...(await test1_VerifySchemaFields()) });
        results.push({ name: '测试2: 推算期target_id正确性', ...(await test2_VerifyPredictedTargetId()) });
        results.push({ name: '测试3: is_predicted字段标识', ...(await test3_VerifyIsPredictedField()) });
        results.push({ name: '测试4: 数据一致性', ...(await test4_VerifyDataConsistency()) });
        results.push({ name: '测试5: API端点功能', ...(await test5_VerifyAPIEndpoints()) });

    } catch (error) {
        console.error('❌ 测试执行失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭\n');
    }

    // 输出测试结果汇总
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 测试结果汇总');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach((result, index) => {
        const symbol = result.passed ? '✅' : '❌';
        console.log(`${symbol} ${result.name}`);
        if (!result.passed && result.reason) {
            console.log(`   原因: ${result.reason}`);
        }
    });

    console.log('\n');
    console.log(`总计: ${passedCount}/${totalCount} 测试通过`);

    if (passedCount === totalCount) {
        console.log('\n🎉 所有测试通过！增量更新机制运行正常。\n');
    } else {
        console.log(`\n⚠️  有 ${totalCount - passedCount} 个测试失败，请检查相关问题。\n`);
    }
}

// 执行测试
runAllTests().catch(console.error);
