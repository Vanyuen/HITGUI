const mongoose = require('mongoose');

console.log('🔍 诊断BUG回退问题...\n');

async function diagnose() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 检查集合名是否正确
        console.log('📋 检查1: 验证集合名称...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        const hwcCollections = collections.filter(c => c.name.includes('hotwarmcold'));

        console.log('热温冷相关集合:');
        hwcCollections.forEach(c => {
            console.log(`  - ${c.name}`);
        });

        // 2. 测试模型能否正确查询
        console.log('\n📋 检查2: 测试模型查询...');

        // 定义schema
        const Schema = mongoose.Schema;
        const dltRedCombinationsHotWarmColdOptimizedSchema = new Schema({
            base_issue: { type: Number, required: true },
            target_issue: { type: Number, required: true },
            hot_warm_cold_data: { type: Schema.Types.Mixed }
        }, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });

        // 方式1: 没有显式集合名（错误方式）
        const ModelWrong = mongoose.model(
            'TestModelWrong',
            dltRedCombinationsHotWarmColdOptimizedSchema
        );

        // 方式2: 显式指定集合名（正确方式）
        const ModelCorrect = mongoose.model(
            'TestModelCorrect',
            dltRedCombinationsHotWarmColdOptimizedSchema,
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );

        console.log('错误方式查询 (无显式集合名):');
        const wrongCount = await ModelWrong.countDocuments();
        console.log(`  结果: ${wrongCount}条记录`);

        console.log('正确方式查询 (显式集合名):');
        const correctCount = await ModelCorrect.countDocuments();
        console.log(`  结果: ${correctCount}条记录`);

        // 3. 测试期号对查询
        console.log('\n📋 检查3: 测试期号对查询...');
        const testPairs = [
            { base_issue: '25119', target_issue: '25120' },
            { base_issue: '25120', target_issue: '25121' }
        ];

        const hwcData = await ModelCorrect.find({
            $or: testPairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        }).lean();

        console.log(`查询期号对: ${testPairs.map(p => `${p.base_issue}→${p.target_issue}`).join(', ')}`);
        console.log(`查询结果: ${hwcData.length}条记录`);

        if (hwcData.length > 0) {
            console.log('样本数据:');
            hwcData.forEach(d => {
                const ratios = Object.keys(d.hot_warm_cold_data || {});
                console.log(`  - ${d.base_issue}→${d.target_issue}: ${ratios.length}种比例`);
            });
        }

        // 4. 检查require.cache是否有缓存问题
        console.log('\n📋 检查4: Node.js模块缓存...');
        const serverPath = require.resolve('./src/server/server.js');
        console.log(`server.js路径: ${serverPath}`);
        console.log(`是否在缓存中: ${!!require.cache[serverPath]}`);

        if (require.cache[serverPath]) {
            const stat = require('fs').statSync(serverPath);
            console.log(`文件修改时间: ${stat.mtime.toLocaleString()}`);
        }

        console.log('\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
