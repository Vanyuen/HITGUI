/**
 * 测试hit_dlts API是否正确使用新的DrawDate字段
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功');
}

// 定义Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: Number, required: true, unique: true },
    Red1: { type: Number, required: true },
    Red2: { type: Number, required: true },
    Red3: { type: Number, required: true },
    Red4: { type: Number, required: true },
    Red5: { type: Number, required: true },
    Blue1: { type: Number, required: true },
    Blue2: { type: Number, required: true },
    DrawDate: { type: Date, required: true }
});

const hit_dlts = mongoose.model('hit_dlts', dltSchema);

// 测试查询
async function testQueries() {
    try {
        await connectDB();

        console.log('\n🧪 测试1: 查询最新5期数据');
        const latestIssues = await hit_dlts.find({})
            .sort({ Issue: -1 })
            .limit(5)
            .select('Issue DrawDate');

        console.log('结果:', latestIssues.map(item => ({
            期号: item.Issue,
            开奖日期: item.DrawDate ? new Date(item.DrawDate).toLocaleDateString('zh-CN') : '无'
        })));

        console.log('\n🧪 测试2: 查询历史数据（含完整字段）');
        const recentData = await hit_dlts.find({})
            .sort({ Issue: -1 })
            .limit(3)
            .select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2 DrawDate');

        console.log('结果:');
        recentData.forEach(item => {
            console.log({
                期号: item.Issue,
                红球: [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5],
                蓝球: [item.Blue1, item.Blue2],
                开奖日期: item.DrawDate ? new Date(item.DrawDate).toLocaleDateString('zh-CN') : '无'
            });
        });

        console.log('\n🧪 测试3: 检查是否还有旧字段残留');
        const sampleWithAll = await hit_dlts.findOne({}).lean();
        const hasOldFields = {
            hasDrawingDay: 'DrawingDay' in sampleWithAll,
            hasDrawingWeek: 'DrawingWeek' in sampleWithAll,
            hasdrawDate: 'drawDate' in sampleWithAll,
            hasDrawDate: 'DrawDate' in sampleWithAll
        };
        console.log('字段检查:', hasOldFields);

        if (hasOldFields.hasDrawingDay || hasOldFields.hasDrawingWeek || hasOldFields.hasdrawDate) {
            console.log('⚠️  警告: 发现旧字段残留');
        } else if (hasOldFields.hasDrawDate) {
            console.log('✅ 字段结构正确');
        }

        console.log('\n✅ 所有测试完成');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

// 执行测试
testQueries();
