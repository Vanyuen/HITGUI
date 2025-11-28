/**
 * 验证hit_dlts Model是否正确指向hit_dlts集合
 */
const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        // 使用与server.js相同的Schema和Model定义
        const dltSchema = new mongoose.Schema({
            ID: { type: Number, required: true, unique: true, index: true },
            Issue: { type: Number, required: true, index: true },
            DrawDate: { type: Date },
            Red1: Number, Red2: Number, Red3: Number, Red4: Number, Red5: Number,
            Blue1: Number, Blue2: Number
        });

        // ⭐ 明确指定使用 hit_dlts 集合（第三个参数）
        const hit_dlts = mongoose.model('hit_dlts', dltSchema, 'hit_dlts');

        console.log('=== 验证hit_dlts Model修复 ===\n');

        const count = await hit_dlts.countDocuments();
        console.log('✅ hit_dlts.countDocuments():', count);

        if (count > 0) {
            const latest = await hit_dlts.find().sort({ Issue: -1 }).limit(5);
            console.log('\n最新5期:');
            latest.forEach(record => {
                console.log(`  期号: ${record.Issue}, Red: ${record.Red1}-${record.Red2}-${record.Red3}-${record.Red4}-${record.Red5}`);
            });

            const issue25114 = await hit_dlts.findOne({ Issue: 25114 });
            if (issue25114) {
                console.log('\n✅ 成功找到期号25114');
                console.log(`   红球: ${issue25114.Red1}-${issue25114.Red2}-${issue25114.Red3}-${issue25114.Red4}-${issue25114.Red5}`);
                console.log(`   蓝球: ${issue25114.Blue1}-${issue25114.Blue2}`);
            } else {
                console.log('\n❌ 没有找到期号25114');
            }
        }

        await mongoose.disconnect();
        console.log('\n🎉 Model修复验证完成！');
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
})();
