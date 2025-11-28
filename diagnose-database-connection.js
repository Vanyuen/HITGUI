#!/usr/bin/env node

const mongoose = require('mongoose');

async function diagnoseConnection() {
    console.log('\n🔍 诊断数据库连接问题\n');
    console.log('='.repeat(70));
    console.log('步骤1: 检查所有可能的数据库连接');
    console.log('='.repeat(70));

    const connections = [
        'mongodb://127.0.0.1:27017/lottery',
        'mongodb://localhost:27017/lottery'
    ];

    for (const uri of connections) {
        console.log(`\n测试连接: ${uri}`);
        try {
            await mongoose.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });

            const db = mongoose.connection.db;
            console.log('  ✅ 连接成功！');

            // 检查热温冷优化表
            const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
            const hwcCount = await hwcTable.countDocuments();
            console.log(`  📊 热温冷优化表记录数: ${hwcCount}`);

            if (hwcCount > 0) {
                // 检查期号25124
                const target25124 = await hwcTable.findOne({ target_issue: '25124' });
                if (target25124) {
                    console.log('  ✅ 找到期号25124');
                    const ratios = Object.keys(target25124.hot_warm_cold_data || {});
                    console.log(`     - 比例种类: ${ratios.length}`);

                    const withWarm = ratios.filter(r => {
                        const [h, w, c] = r.split(':').map(Number);
                        return w > 0;
                    });
                    console.log(`     - 含温号比例: ${withWarm.length}`);

                    if (target25124.hot_warm_cold_data['4:1:0']) {
                        console.log(`     - 4:1:0组合数: ${target25124.hot_warm_cold_data['4:1:0'].length}`);
                    }
                } else {
                    console.log('  ❌ 未找到期号25124');
                }

                // 检查最近10期的数据覆盖率
                const hit_dlts = db.collection('hit_dlts');
                const latestIssues = await hit_dlts.find({})
                    .sort({ Issue: -1 })
                    .limit(11)
                    .toArray();

                console.log(`\n  检查最近10期数据覆盖率:`);
                let coverageCount = 0;
                const issueList = latestIssues.map(doc => doc.Issue).sort((a, b) => {
                    return parseInt(a) - parseInt(b);
                });

                for (let i = 0; i < issueList.length - 1; i++) {
                    const base = issueList[i];
                    const target = issueList[i + 1];

                    const exists = await hwcTable.findOne({
                        base_issue: base,
                        target_issue: target
                    });

                    if (exists) {
                        coverageCount++;
                        console.log(`     ✅ ${base} → ${target}`);
                    } else {
                        console.log(`     ❌ ${base} → ${target} (缺失)`);
                    }
                }

                const coverageRate = (coverageCount / 10 * 100).toFixed(1);
                console.log(`\n  数据覆盖率: ${coverageRate}% (${coverageCount}/10)`);
            } else {
                console.log('  ⚠️  热温冷优化表为空！');
            }

            await mongoose.disconnect();
            console.log('\n  ✅ 断开连接');

        } catch (error) {
            console.log(`  ❌ 连接失败: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('步骤2: 检查服务端配置');
    console.log('='.repeat(70));

    console.log('\n查看 src/server/server.js 中的 MONGODB_URI 配置:');
    console.log('  需要手动检查文件开头的 MONGODB_URI 常量');

    console.log('\n' + '='.repeat(70));
    console.log('诊断完成');
    console.log('='.repeat(70));
}

diagnoseConnection().catch(error => {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
});
