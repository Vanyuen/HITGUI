/**
 * 检查热温冷优化表的基准期号配置
 */
const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const col = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        console.log('检查25120的数据:');
        const data25120 = await col.findOne({ target_issue: '25120' });
        console.log('  base_issue:', data25120?.base_issue);
        console.log('  target_issue:', data25120?.target_issue);

        console.log('\n检查25124的数据:');
        const data25124 = await col.findOne({ target_issue: '25124' });
        console.log('  base_issue:', data25124?.base_issue);
        console.log('  target_issue:', data25124?.target_issue);

        console.log('\n检查期号对 25123→25124:');
        const pair25124 = await col.findOne({ base_issue: '25123', target_issue: '25124' });
        console.log('  存在:', !!pair25124);

        console.log('\n检查期号对 25119→25120:');
        const pair25120 = await col.findOne({ base_issue: '25119', target_issue: '25120' });
        console.log('  存在:', !!pair25120);

        console.log('\n检查最近5期的基准期号配置:');
        const recent5 = await col.find({
            target_issue: { $in: ['25120', '25121', '25122', '25123', '25124'] }
        }).toArray();

        recent5.forEach(r => {
            console.log(`  ${r.base_issue} → ${r.target_issue}`);
        });

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

check();
