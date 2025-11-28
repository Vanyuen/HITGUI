const mongoose = require('mongoose');

console.log('🔍 检查最新任务数据...\n');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 查询任务
        const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .find()
            .sort({ created_at: -1, createdAt: -1, _id: -1 })
            .limit(1)
            .toArray();

        console.log('📋 最新任务:');
        console.log(JSON.stringify(task[0], null, 2));

        const taskId = task[0].task_id;

        // 2. 查询任务结果
        console.log('\n📋 任务结果:');
        const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: taskId })
            .sort({ target_issue: 1 })
            .toArray();

        console.log(`找到${results.length}条结果:`);
        results.forEach(r => {
            console.log(`  期号${r.target_issue}: Step1=${r.step1_basic_combinations || 0}, 最终=${r.final_combinations || 0}, 推算=${r.is_predicted}`);
        });

        // 3. 检查server.js中实际使用的集合名
        const fs = require('fs');
        const path = require('path');
        const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
        const content = fs.readFileSync(serverPath, 'utf-8');

        console.log('\n📋 检查server.js中的模型定义:');

        // 查找HwcPositivePredictionTask模型定义
        const taskModelMatch = content.match(/const HwcPositivePredictionTask = mongoose\.model\([^)]+\)/);
        if (taskModelMatch) {
            console.log('任务模型定义:');
            console.log(`  ${taskModelMatch[0]}`);
        }

        // 查找HwcPositivePredictionTaskResult模型定义
        const resultModelMatch = content.match(/const HwcPositivePredictionTaskResult = mongoose\.model\([^)]+\)/);
        if (resultModelMatch) {
            console.log('结果模型定义:');
            console.log(`  ${resultModelMatch[0]}`);
        }

        console.log('\n✅ 完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

check();
