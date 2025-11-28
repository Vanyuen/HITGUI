/**
 * 诊断热温冷正选条件的ratio格式问题
 */

const mongoose = require('mongoose');

// Task Schema
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    positive_selection: Object,
    created_at: Date
});

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    combination_count: Number,
    positive_selection_details: Object,
    created_at: Date
});

// Optimized HWC Schema
const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    base_issue: { type: String, required: true },
    target_issue: { type: String, required: true },
    hot_warm_cold_data: {
        type: Map,
        of: [Number],
        required: true
    },
    total_combinations: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
});

const HwcPositivePredictionTask = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTask',
    hwcPositivePredictionTaskSchema,
    'hit_dlt_hwcpositivepredictiontasks'
);

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    dltRedCombinationsHotWarmColdOptimizedSchema
);

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Database connected\n');
        console.log('=== HWC Ratio Format Diagnosis ===\n');

        // 1. Find latest task
        const latestTask = await HwcPositivePredictionTask
            .findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('No HWC positive selection tasks found');
            mongoose.connection.close();
            return;
        }

        console.log('Latest Task:');
        console.log('  Task ID:', latestTask.task_id);
        console.log('  Task Name:', latestTask.task_name);
        console.log('');

        // 2. Analyze positive_selection ratio format
        console.log('Positive Selection:');
        console.log(JSON.stringify(latestTask.positive_selection, null, 2));
        console.log('');

        const selectedRatios = latestTask.positive_selection.red_hot_warm_cold_ratios || [];
        console.log('Red HWC Ratios Array:');
        console.log('  Array length:', selectedRatios.length);
        selectedRatios.forEach((ratio, index) => {
            const ratioType = typeof ratio;
            console.log(`  [${index}] Type: ${ratioType}, Value: ${JSON.stringify(ratio)}`);
        });
        console.log('');

        // 3. Check optimized table data format
        const hwcData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            base_issue: '25119',
            target_issue: '25120'
        }).lean();

        if (hwcData) {
            console.log('Optimized Table Sample (25119->25120):');
            const dataType = typeof hwcData.hot_warm_cold_data;
            const isMap = hwcData.hot_warm_cold_data instanceof Map;
            console.log('  hot_warm_cold_data type:', dataType);
            console.log('  Is Map:', isMap);

            if (isMap) {
                console.log('  Map size:', hwcData.hot_warm_cold_data.size);
                console.log('  First 5 keys:');
                let count = 0;
                for (const [key, value] of hwcData.hot_warm_cold_data.entries()) {
                    const keyType = typeof key;
                    console.log(`    - "${key}" (type: ${keyType}): ${value.length} combos`);
                    count++;
                    if (count >= 5) break;
                }
            } else {
                const keys = Object.keys(hwcData.hot_warm_cold_data);
                console.log('  Object keys count:', keys.length);
                console.log('  First 5 keys:');
                keys.slice(0, 5).forEach(key => {
                    const value = hwcData.hot_warm_cold_data[key];
                    const keyType = typeof key;
                    console.log(`    - "${key}" (type: ${keyType}): ${value ? value.length : 0} combos`);
                });
            }
        }
        console.log('');

        // 4. Simulate lookup logic
        console.log('Simulated Lookup:');
        if (selectedRatios.length > 0 && hwcData) {
            const firstRatio = selectedRatios[0];
            const ratioType = typeof firstRatio;
            console.log(`  Looking for ratio: ${JSON.stringify(firstRatio)} (type: ${ratioType})`);

            // Try different formats
            let ratioKey;
            if (ratioType === 'string') {
                ratioKey = firstRatio;
            } else if (ratioType === 'object') {
                ratioKey = `${firstRatio.hot}:${firstRatio.warm}:${firstRatio.cold}`;
            }

            console.log(`  Converted to key: "${ratioKey}"`);

            if (hwcData.hot_warm_cold_data instanceof Map) {
                const found = hwcData.hot_warm_cold_data.has(ratioKey);
                console.log(`  Map.has("${ratioKey}"): ${found}`);
                if (found) {
                    console.log(`  Combo count: ${hwcData.hot_warm_cold_data.get(ratioKey).length}`);
                }
            } else {
                const found = ratioKey in hwcData.hot_warm_cold_data;
                console.log(`  Object has "${ratioKey}": ${found}`);
                if (found) {
                    console.log(`  Combo count: ${hwcData.hot_warm_cold_data[ratioKey].length}`);
                }
            }
        }

        console.log('\n=== Diagnosis Complete ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnose();
