const mongoose = require('mongoose');

console.log('🔍 诊断同现比排除问题...\n');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 检查每个期号的ID和同现分析是否有足够的历史数据
        const targetIssues = [25118, 25119, 25120, 25121, 25122, 25123, 25124, 25125];
        const periods = 10;  // 同现分析期数

        console.log('📊 检查每个期号的同现分析数据可用性:\n');

        for (const issue of targetIssues) {
            // 查询该期号的ID
            const record = await mongoose.connection.db.collection('hit_dlts')
                .findOne({ Issue: issue }, { projection: { Issue: 1, ID: 1 } });

            if (!record) {
                console.log(`❌ 期号${issue}: 数据库中不存在`);
                continue;
            }

            const baseID = record.ID - 1;  // ID-1规则
            const minRequiredID = baseID - periods + 1;  // 需要的最小ID

            // 检查历史数据是否充足
            const historicalCount = await mongoose.connection.db.collection('hit_dlts')
                .countDocuments({
                    ID: {
                        $lte: baseID,
                        $gt: baseID - periods
                    }
                });

            const hasEnoughData = historicalCount >= periods;
            const status = hasEnoughData ? '✅' : '❌';

            console.log(`${status} 期号${issue} (ID=${record.ID}):`);
            console.log(`   - Base ID: ${baseID}`);
            console.log(`   - 同现分析范围: ID ${baseID - periods + 1} ~ ${baseID} (需要${periods}期)`);
            console.log(`   - 实际可用: ${historicalCount}期`);
            console.log(`   - 状态: ${hasEnoughData ? '数据充足' : '⚠️ 数据不足'}`);
            console.log('');
        }

        console.log('\n✅ 完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
