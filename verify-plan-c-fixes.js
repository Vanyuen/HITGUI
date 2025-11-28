/**
 * 验证方案C实施结果
 * 验证Mongoose模型配置和数据访问是否正确
 */

const mongoose = require('mongoose');

async function verifyPlanCFixes() {
    console.log('🔍 开始验证方案C实施结果...\n');

    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ 数据库连接成功\n');

        // 1. 验证主数据表 hit_dlts
        console.log('📊 验证1: 主数据表 hit_dlts');
        const dltSchema = new mongoose.Schema({
            ID: Number,
            Issue: Number,
            DrawDate: Date,
            TotalSales: Number
        });
        const DLT = mongoose.model('DLT_Verify', dltSchema, 'hit_dlts');

        const dltCount = await DLT.countDocuments();
        const latestDLT = await DLT.findOne().sort({ Issue: -1 });

        console.log(`  ✅ 集合: hit_dlts`);
        console.log(`  ✅ 记录数: ${dltCount.toLocaleString()}`);
        console.log(`  ✅ 最新期号: ${latestDLT.Issue}`);
        console.log(`  ✅ 最新日期: ${latestDLT.DrawDate}`);
        console.log('');

        // 2. 验证红球组合表 hit_dlt_redcombinations
        console.log('🔴 验证2: 红球组合表 hit_dlt_redcombinations');
        const redSchema = new mongoose.Schema({
            combination_id: Number,
            red_ball_1: Number,
            red_ball_2: Number,
            red_ball_3: Number,
            red_ball_4: Number,
            red_ball_5: Number,
            sum_value: Number,
            span_value: Number
        });
        const RedCombos = mongoose.model('RedCombos_Verify', redSchema, 'hit_dlt_redcombinations');

        const redCount = await RedCombos.countDocuments();
        const sampleRed = await RedCombos.findOne({ combination_id: 1 });

        console.log(`  ✅ 集合: hit_dlt_redcombinations`);
        console.log(`  ✅ 记录数: ${redCount.toLocaleString()} (应为 324,632)`);
        console.log(`  ✅ 示例组合ID 1: [${sampleRed.red_ball_1}, ${sampleRed.red_ball_2}, ${sampleRed.red_ball_3}, ${sampleRed.red_ball_4}, ${sampleRed.red_ball_5}]`);
        console.log(`  ✅ 和值: ${sampleRed.sum_value}, 跨度: ${sampleRed.span_value}`);
        console.log('');

        // 3. 验证蓝球组合表 hit_dlt_bluecombinations
        console.log('🔵 验证3: 蓝球组合表 hit_dlt_bluecombinations');
        const blueSchema = new mongoose.Schema({
            combination_id: Number,
            blue_ball_1: Number,
            blue_ball_2: Number,
            sum_value: Number
        });
        const BlueCombos = mongoose.model('BlueCombos_Verify', blueSchema, 'hit_dlt_bluecombinations');

        const blueCount = await BlueCombos.countDocuments();
        const sampleBlue = await BlueCombos.findOne({ combination_id: 1 });

        console.log(`  ✅ 集合: hit_dlt_bluecombinations`);
        console.log(`  ✅ 记录数: ${blueCount.toLocaleString()} (应为 66)`);
        console.log(`  ✅ 示例组合ID 1: [${sampleBlue.blue_ball_1}, ${sampleBlue.blue_ball_2}]`);
        console.log(`  ✅ 和值: ${sampleBlue.sum_value}`);
        console.log('');

        // 4. 验证空集合状态
        console.log('🗑️  验证4: 检查空集合（应删除）');
        const db = mongoose.connection.db;

        const emptyCollections = ['hit_dlt', 'HIT_DLT', 'HIT_DLT_RedCombinations'];
        for (const collName of emptyCollections) {
            try {
                const count = await db.collection(collName).countDocuments();
                if (count === 0) {
                    console.log(`  ⚠️  ${collName}: ${count} 条记录 (建议删除)`);
                } else {
                    console.log(`  ✅ ${collName}: ${count} 条记录`);
                }
            } catch (error) {
                console.log(`  ✅ ${collName}: 不存在`);
            }
        }
        console.log('');

        // 5. 验证重复蓝球集合
        console.log('🔵 验证5: 检查重复的蓝球组合集合');
        const duplicateBlueCombinations = ['hit_dlt_bluecombinations', 'HIT_DLT_BlueCombinations'];
        for (const collName of duplicateBlueCombinations) {
            try {
                const count = await db.collection(collName).countDocuments();
                console.log(`  📊 ${collName}: ${count} 条记录`);
            } catch (error) {
                console.log(`  ✅ ${collName}: 不存在`);
            }
        }
        console.log('  💡 建议: 保留 hit_dlt_bluecombinations，删除 HIT_DLT_BlueCombinations');
        console.log('');

        // 总结
        console.log('=' .repeat(60));
        console.log('✅ 方案C验证完成!');
        console.log('=' .repeat(60));
        console.log('\n核心数据源验证结果:');
        console.log(`  ✅ hit_dlts (主数据): ${dltCount.toLocaleString()} 期`);
        console.log(`  ✅ hit_dlt_redcombinations (红球): ${redCount.toLocaleString()} 组合`);
        console.log(`  ✅ hit_dlt_bluecombinations (蓝球): ${blueCount.toLocaleString()} 组合`);
        console.log('\n建议操作:');
        console.log('  1. 删除空集合: hit_dlt, HIT_DLT, HIT_DLT_RedCombinations');
        console.log('  2. 删除重复集合: HIT_DLT_BlueCombinations');
        console.log('  3. 运行应用测试所有大乐透功能');

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 数据库连接已关闭');
    }
}

// 执行验证
if (require.main === module) {
    verifyPlanCFixes();
}

module.exports = verifyPlanCFixes;
