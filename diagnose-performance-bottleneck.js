/**
 * 诊断热温冷优化表性能问题
 */

const mongoose = require('mongoose');

// 使用与server.js相同的Schema定义
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
        console.log('=== Diagnosis Start ===\n');

        const db = mongoose.connection.db;

        // Test 1: Check collection names
        console.log('Test 1: Collection names');
        const collections = await db.listCollections().toArray();
        const hwcColls = collections.filter(c => c.name.toLowerCase().includes('hotwarmcold'));
        
        for (const coll of hwcColls) {
            const count = await db.collection(coll.name).countDocuments({});
            console.log('  -', coll.name, ':', count, 'records');
        }
        console.log();

        // Test 2: Mongoose query
        console.log('Test 2: Mongoose Model query');
        const result1 = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            base_issue: '25119',
            target_issue: '25120'
        }).lean();

        console.log('  Result:', result1 ? 'Found' : 'Not Found');
        if (result1) {
            console.log('  Type:', typeof result1.hot_warm_cold_data);
            console.log('  Is Map:', result1.hot_warm_cold_data instanceof Map);
            
            if (result1.hot_warm_cold_data instanceof Map) {
                console.log('  Map size:', result1.hot_warm_cold_data.size);
            } else {
                console.log('  Object keys:', Object.keys(result1.hot_warm_cold_data).length);
            }
        }
        console.log();

        // Test 3: Native query
        console.log('Test 3: Native collection query');
        const result2 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
            base_issue: '25119',
            target_issue: '25120'
        });

        console.log('  Result:', result2 ? 'Found' : 'Not Found');
        if (result2) {
            console.log('  Type:', typeof result2.hot_warm_cold_data);
            console.log('  Keys:', Object.keys(result2.hot_warm_cold_data).length);
        }
        console.log();

        // Test 4: Conversion logic
        console.log('Test 4: Object to Map conversion');
        if (result1 && result1.hot_warm_cold_data) {
            const hwcMap = new Map();
            
            if (result1.hot_warm_cold_data instanceof Map) {
                console.log('  Already Map, direct use');
                for (const entry of result1.hot_warm_cold_data.entries()) {
                    hwcMap.set(entry[0], entry[1]);
                }
            } else {
                console.log('  Object, converting to Map');
                for (const key in result1.hot_warm_cold_data) {
                    hwcMap.set(key, result1.hot_warm_cold_data[key]);
                }
            }
            
            console.log('  Converted Map size:', hwcMap.size);
            const testIds = hwcMap.get('3:2:0');
            console.log('  Test get "3:2:0":', testIds ? testIds.length + ' combos' : 'Not found');
        }
        console.log();

        console.log('=== Diagnosis Complete ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

diagnose();
