/**
 * 检查DLT遗漏值表的数据状态
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功');
}

async function checkTables() {
    try {
        await connectDB();

        // 检查HIT_DLT表
        const dltCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
        const dltLatest = await mongoose.connection.db.collection('hit_dlts')
            .findOne({}, { sort: { Issue: -1 } });

        console.log('\n📊 HIT_DLT 表状态:');
        console.log(`   记录数: ${dltCount}`);
        console.log(`   最新期号: ${dltLatest?.Issue}`);
        console.log(`   最新日期: ${dltLatest?.DrawDate}`);

        // 检查DLTRedMissing表
        const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const redMissingLatest = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories')
            .findOne({}, { sort: { ID: -1 } });

        console.log('\n📊 DLTRedMissing 表状态:');
        console.log(`   记录数: ${redMissingCount}`);
        console.log(`   最新期号: ${redMissingLatest?.Issue}`);
        console.log(`   DrawingDay: ${redMissingLatest?.DrawingDay}`);

        // 检查DLTBlueMissing表
        const blueMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
        const blueMissingLatest = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories')
            .findOne({}, { sort: { ID: -1 } });

        console.log('\n📊 DLTBlueMissing 表状态:');
        console.log(`   记录数: ${blueMissingCount}`);
        console.log(`   最新期号: ${blueMissingLatest?.Issue}`);
        console.log(`   DrawingDay: ${blueMissingLatest?.DrawingDay}`);

        // 对比分析
        console.log('\n📊 数据对比:');
        if (dltLatest && redMissingLatest) {
            const dltIssue = parseInt(dltLatest.Issue);
            const redIssue = parseInt(redMissingLatest.Issue);

            if (dltIssue > redIssue) {
                console.log(`⚠️  遗漏值表数据过期，落后 ${dltIssue - redIssue} 期`);
                console.log(`   需要重新生成遗漏值数据`);
            } else if (dltIssue === redIssue) {
                console.log(`✅ 遗漏值表数据最新`);
            } else {
                console.log(`⚠️  HIT_DLT表数据落后`);
            }
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

checkTables();
