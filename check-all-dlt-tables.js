/**
 * 检查所有大乐透相关数据表的状态
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');
}

async function checkAllTables() {
    try {
        await connectDB();

        // 定义所有需要检查的表
        const tables = [
            {
                name: 'HIT_DLT (开奖记录)',
                collection: 'hit_dlts',
                key: 'Issue',
                description: '基础开奖数据'
            },
            {
                name: 'DLTRedMissing (红球遗漏)',
                collection: 'hit_dlt_basictrendchart_redballmissing_histories',
                key: 'Issue',
                description: '走势图数据源'
            },
            {
                name: 'DLTBlueMissing (蓝球遗漏)',
                collection: 'hit_dlt_basictrendchart_blueballmissing_histories',
                key: 'Issue',
                description: '走势图数据源'
            },
            {
                name: 'DLTRedCombinations (红球组合)',
                collection: 'hit_dlt_redcombinations',
                key: 'combination_id',
                description: '组合预测基础数据'
            },
            {
                name: 'DLTBlueCombinations (蓝球组合)',
                collection: 'hit_dlt_bluecombinations',
                key: 'combination_id',
                description: '组合预测基础数据'
            },
            {
                name: 'DLTRedCombinationsHotWarmCold (热温冷分析)',
                collection: 'hit_dlt_redcombinationshotwarmcolds',
                key: 'target_issue',
                description: '组合批量预测缓存'
            }
        ];

        const db = mongoose.connection.db;
        const mainIssue = await db.collection('hit_dlts').findOne({}, { sort: { Issue: -1 } });
        const mainCount = await db.collection('hit_dlts').countDocuments();

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`📊 基准表: HIT_DLT`);
        console.log(`   记录数: ${mainCount} 期`);
        console.log(`   最新期号: ${mainIssue?.Issue}`);
        console.log(`   最新日期: ${mainIssue?.DrawDate ? new Date(mainIssue.DrawDate).toLocaleDateString('zh-CN') : '无'}`);
        console.log('═══════════════════════════════════════════════════════════════\n');

        let hasIssues = false;

        for (const table of tables) {
            try {
                const count = await db.collection(table.collection).countDocuments();
                const latest = await db.collection(table.collection).findOne({}, {
                    sort: table.key === 'Issue' ? { ID: -1 } : { _id: -1 }
                });

                let status = '✅';
                let message = '';

                // 检查数据状态
                if (count === 0) {
                    status = '❌';
                    message = '表为空';
                    hasIssues = true;
                } else if (table.key === 'Issue') {
                    const latestIssue = parseInt(latest?.Issue);
                    const mainLatestIssue = parseInt(mainIssue?.Issue);

                    if (latestIssue < mainLatestIssue) {
                        status = '⚠️ ';
                        message = `落后 ${mainLatestIssue - latestIssue} 期`;
                        hasIssues = true;
                    } else if (latestIssue === mainLatestIssue) {
                        message = '数据同步';
                    }
                }

                console.log(`${status} ${table.name}`);
                console.log(`   用途: ${table.description}`);
                console.log(`   记录数: ${count}`);
                if (latest && table.key === 'Issue') {
                    console.log(`   最新期号: ${latest[table.key]}`);
                }
                if (message) {
                    console.log(`   状态: ${message}`);
                }
                console.log('');

            } catch (error) {
                console.log(`❌ ${table.name}`);
                console.log(`   错误: ${error.message}\n`);
                hasIssues = true;
            }
        }

        console.log('═══════════════════════════════════════════════════════════════');
        if (hasIssues) {
            console.log('\n⚠️  发现数据不同步问题，建议执行统一更新操作！');
            console.log('   运行命令: node update-all-dlt-tables.js');
        } else {
            console.log('\n✅ 所有数据表状态正常！');
        }
        console.log('═══════════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

checkAllTables();
