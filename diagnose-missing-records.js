const mongoose = require('mongoose');

const DLTSchema = new mongoose.Schema({
    Issue: String,
    ID: Number,
    Missing1: Number,
    Missing2: Number,
    Missing3: Number,
    Missing4: Number,
    Missing5: Number,
    Missing6: Number,
    Missing7: Number,
    Missing8: Number,
    Missing9: Number,
    Missing10: Number,
    Missing11: Number,
    Missing12: Number,
    Missing13: Number,
    Missing14: Number,
    Missing15: Number,
    Missing16: Number,
    Missing17: Number,
    Missing18: Number,
    Missing19: Number,
    Missing20: Number,
    Missing21: Number,
    Missing22: Number,
    Missing23: Number,
    Missing24: Number,
    Missing25: Number,
    Missing26: Number,
    Missing27: Number,
    Missing28: Number,
    Missing29: Number,
    Missing30: Number,
    Missing31: Number,
    Missing32: Number,
    Missing33: Number,
    Missing34: Number,
    Missing35: Number
}, { collection: 'hit_dlts' });

const hit_dlts = mongoose.model('DLT_Diagnosis', DLTSchema);

async function diagnoseMissingRecords() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('📡 连接数据库成功');

        // 定义要检查的遗漏字段
        const missingFields = [
            'Missing1', 'Missing2', 'Missing3', 'Missing4', 'Missing5',
            'Missing6', 'Missing7', 'Missing8', 'Missing9', 'Missing10',
            'Missing11', 'Missing12', 'Missing13', 'Missing14', 'Missing15',
            'Missing16', 'Missing17', 'Missing18', 'Missing19', 'Missing20',
            'Missing21', 'Missing22', 'Missing23', 'Missing24', 'Missing25',
            'Missing26', 'Missing27', 'Missing28', 'Missing29', 'Missing30',
            'Missing31', 'Missing32', 'Missing33', 'Missing34', 'Missing35'
        ];

        // 获取总记录数
        const totalRecords = await hit_dlts.countDocuments();
        console.log(`📊 总记录数: ${totalRecords}`);

        // 检查每个遗漏字段的完整性
        const fieldCompleteness = {};
        for (const field of missingFields) {
            const recordsWithField = await hit_dlts.countDocuments({
                [field]: { $exists: true, $ne: null, $type: 'number' }
            });
            const recordsWithoutField = await hit_dlts.countDocuments({
                $or: [
                    { [field]: null },
                    { [field]: { $exists: false } }
                ]
            });
            const completenessRate = (recordsWithField / totalRecords * 100).toFixed(2);
            fieldCompleteness[field] = {
                total: recordsWithField,
                missing: recordsWithoutField,
                rate: completenessRate
            };
        }

        console.log('\n🔍 遗漏字段完整性分析:');
        Object.entries(fieldCompleteness).forEach(([field, stats]) => {
            console.log(`   ${field}: ${stats.total} 条记录 (${stats.rate}%), 缺失 ${stats.missing} 条`);
        });

        // 检查每个期号的遗漏字段情况
        const aggregationPipeline = [
            {
                $project: {
                    Issue: 1,
                    missingFields: {
                        $filter: {
                            input: missingFields,
                            as: "field",
                            cond: {
                                $or: [
                                    { $eq: [{ $type: { $ifNull: [`$${field}`, 'missing'] } }, "missing"] },
                                    { $not: { $type: { $ifNull: [`$${field}`, 'missing'] } } }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    $expr: { $gt: [{ $size: "$missingFields" }, 0] }
                }
            },
            { $limit: 50 }  // 限制输出数量，避免太多输出
        ];

        const incompleteRecords = await hit_dlts.aggregate(aggregationPipeline);

        console.log('\n⚠️ 检测到不完整的记录示例:');
        incompleteRecords.forEach(record => {
            console.log(`   期号 ${record.Issue}: 缺失字段 ${record.missingFields.join(', ')}`);
        });

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ 诊断过程出错:', error);
    }
}

diagnoseMissingRecords();