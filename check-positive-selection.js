const mongoose = require('mongoose');

async function investigate() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 1. 检查两个任务的正选条件配置
    console.log('=== 正选条件(positive_selection)配置对比 ===\n');

    const tkaTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251209-tka' });

    const vw8Task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251209-vw8' });

    console.log('tka positive_selection:');
    console.log(JSON.stringify(tkaTask.positive_selection, null, 2));

    console.log('\nvw8 positive_selection:');
    console.log(JSON.stringify(vw8Task.positive_selection, null, 2));

    // 2. 检查两个任务结果中的positive_selection_details
    console.log('\n\n=== 25140期结果中的positive_selection_details ===');

    const tkaResult25140 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-tka', target_issue: '25140' });

    const vw8Result25140 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-vw8', target_issue: '25140' });

    if (tkaResult25140) {
        console.log('\ntka 25140期 positive_selection_details:');
        console.log(JSON.stringify(tkaResult25140.positive_selection_details, null, 2));
    } else {
        console.log('\ntka 25140期: 找不到结果');
    }

    if (vw8Result25140) {
        console.log('\nvw8 25140期 positive_selection_details:');
        console.log(JSON.stringify(vw8Result25140.positive_selection_details, null, 2));
    } else {
        console.log('\nvw8 25140期: 找不到结果');
    }

    // 3. 检查排除条件配置
    console.log('\n\n=== 排除条件(exclusion_conditions)配置对比 ===');
    console.log('\ntka exclusion_conditions:');
    console.log(JSON.stringify(tkaTask.exclusion_conditions, null, 2));
    console.log('\nvw8 exclusion_conditions:');
    console.log(JSON.stringify(vw8Task.exclusion_conditions, null, 2));

    await mongoose.disconnect();
}

investigate().catch(console.error);
