const mongoose = require('mongoose');

async function diagnoseHwcTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 检查hit_dlts集合
        const dltCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
        console.log(`hit_dlts 集合总记录数: ${dltCount}`);

        // 检查红球组合集合
        const redCombinationCount = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`hit_dlt_redcombinations 集合总记录数: ${redCombinationCount}`);

        // 抽样检查一条记录的统计信息
        const sampleRecord = await mongoose.connection.db.collection('hit_dlts').findOne(
            { "statistics.frontHotWarmColdRatio": { $exists: true } },
            { projection: { Issue: 1, "statistics.frontHotWarmColdRatio": 1 } }
        );

        if (sampleRecord) {
            console.log('示例记录:');
            console.log('期号:', sampleRecord.Issue);
            console.log('热温冷比:', sampleRecord.statistics?.frontHotWarmColdRatio);
        } else {
            console.warn('未找到包含热温冷比的记录！');
        }

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    }
}

diagnoseHwcTable();