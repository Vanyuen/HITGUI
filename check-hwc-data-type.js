const mongoose = require('mongoose');

console.log('🔍 检查HWC表字段数据类型...\n');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        const Schema = mongoose.Schema;
        const schema = new Schema({
            base_issue: Schema.Types.Mixed,
            target_issue: Schema.Types.Mixed,
            hot_warm_cold_data: Schema.Types.Mixed
        }, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });

        const Model = mongoose.model('HWCCheck', schema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取几条样本数据
        console.log('📊 样本数据 (前5条):');
        const samples = await Model.find().limit(5).lean();

        samples.forEach((doc, i) => {
            console.log(`\n记录${i + 1}:`);
            console.log(`  base_issue: ${doc.base_issue} (类型: ${typeof doc.base_issue})`);
            console.log(`  target_issue: ${doc.target_issue} (类型: ${typeof doc.target_issue})`);
            console.log(`  是否有hot_warm_cold_data: ${!!doc.hot_warm_cold_data}`);
        });

        // 测试不同查询方式
        console.log('\n\n📋 测试不同查询方式:');

        // 方式1: 字符串查询
        const count1 = await Model.countDocuments({
            base_issue: '25119',
            target_issue: '25120'
        });
        console.log(`字符串查询 ('25119', '25120'): ${count1}条`);

        // 方式2: 数字查询
        const count2 = await Model.countDocuments({
            base_issue: 25119,
            target_issue: 25120
        });
        console.log(`数字查询 (25119, 25120): ${count2}条`);

        // 方式3: 查询最新几期
        console.log('\n📊 最新10条记录的期号:');
        const latest = await Model.find()
            .sort({ target_issue: -1 })
            .limit(10)
            .select('base_issue target_issue')
            .lean();

        latest.forEach(doc => {
            console.log(`  ${doc.base_issue}→${doc.target_issue} (类型: ${typeof doc.base_issue}, ${typeof doc.target_issue})`);
        });

        console.log('\n✅ 检查完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

check();
