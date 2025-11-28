const mongoose = require('mongoose');
const { generateHwcOptimizedData } = require('./generate-hwc-optimized-table');

async function rebuildHwcOptimizedTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 删除现有的热温冷比优化表
        const HwcOptimized = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
        await HwcOptimized.drop();
        console.log('✅ 已删除原有热温冷比优化表');

        // 获取所有历史期号
        const collection = mongoose.connection.db.collection('hit_dlts');
        const issues = await collection.find({})
            .project({ Issue: 1, ID: 1 })
            .sort({ ID: 1 })
            .toArray();

        if (issues.length < 2) {
            console.error('❌ 数据不足，至少需要2期数据');
            process.exit(1);
        }

        console.log(`✅ 找到 ${issues.length} 期数据`);
        console.log(`   期号范围: ${issues[0].Issue} - ${issues[issues.length - 1].Issue}`);

        // 构建期号对列表
        const issuePairs = [];
        for (let i = 1; i < issues.length; i++) {
            issuePairs.push({
                base_issue: issues[i - 1].Issue,  // 前一期作为基准
                target_issue: issues[i].Issue      // 当前期作为目标
            });
        }

        console.log(`📊 生成 ${issuePairs.length} 个期号对`);

        // 生成优化数据（强制重新生成）
        await generateHwcOptimizedData(issuePairs, true);

        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('\n🎉 热温冷比优化表重建完成！');

    } catch (error) {
        console.error('❌ 重建过程中发生错误:', error);
        process.exit(1);
    }
}

rebuildHwcOptimizedTable();