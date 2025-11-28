const mongoose = require('mongoose');

// 定义热温冷正选预测任务模型
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    period_range: {
        type: { type: String },
        start: String,
        end: String,
        total: Number,
        predicted_count: { type: Number, default: 0 }
    }
});

// 定义热温冷正选预测任务结果模型
const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    result_id: { type: String, required: true, unique: true },
    task_id: { type: String, required: true },
    period: { type: Number, required: true },
    is_predicted: { type: Boolean, default: false },
    red_combinations: [Number],
    hit_analysis: {
        max_red_hit: { type: Number, default: 0 },
        max_blue_hit: { type: Number, default: 0 }
    }
});

async function diagnoseIssue25117() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功');

        // 注册模型
        const HwcPositivePredictionTask = mongoose.model('HIT_DLT_HwcPositivePredictionTask', hwcPositivePredictionTaskSchema);
        const HwcPositivePredictionTaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult', hwcPositivePredictionTaskResultSchema);
        const DLT = mongoose.model('HIT_DLT', new mongoose.Schema({
            Issue: Number,
            DrawDate: Date
        }), 'hit_dlts');

        // 1. 检查 25117 是否存在于历史开奖数据
        const historicalIssue = await DLT.findOne({ Issue: 25117 });
        console.log('🔍 历史开奖数据中的 25117:', historicalIssue ? '✅ 存在' : '❌ 不存在');

        // 2. 查找最近的预测任务
        const recentTask = await HwcPositivePredictionTask.findOne({
            'period_range.start': { $lte: 25117 },
            'period_range.end': { $gte: 25117 }
        }).sort({ created_at: -1 });

        console.log('🔍 匹配的任务:', recentTask ? recentTask.task_id : '❌ 未找到匹配任务');

        if (recentTask) {
            // 3. 检查该任务的结果
            const taskResults = await HwcPositivePredictionTaskResult.find({
                task_id: recentTask.task_id,
                period: 25117
            });

            console.log('🔍 任务结果数量:', taskResults.length);
            taskResults.forEach((result, index) => {
                console.log(`结果 ${index + 1}:`, {
                    result_id: result.result_id,
                    is_predicted: result.is_predicted,
                    red_combinations: result.red_combinations.length,
                    hit_analysis: result.hit_analysis
                });
            });
        }

        // 4. 检查数据库中的预测任务结果
        const allResults = await HwcPositivePredictionTaskResult.find({ period: 25117 });
        console.log('🔍 所有数据库中的 25117 预测结果:', allResults.length);
        allResults.forEach((result, index) => {
            console.log(`全局结果 ${index + 1}:`, {
                task_id: result.task_id,
                is_predicted: result.is_predicted,
                red_combinations: result.red_combinations.length
            });
        });

    } catch (error) {
        console.error('❌ 诊断过程中出错:', error);
    } finally {
        await mongoose.connection.close();
    }
}

diagnoseIssue25117();