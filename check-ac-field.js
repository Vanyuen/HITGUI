const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery');

const schema = new mongoose.Schema({}, { strict: false });
const Model = mongoose.model('HIT_DLT_RedCombinations', schema);

Model.findOne({}).lean().then(doc => {
    console.log('\n========== 数据库Schema检查 ==========\n');
    console.log('✅ 成功连接到数据库');
    console.log('\n📋 HIT_DLT_RedCombinations 集合的字段:');
    console.log(Object.keys(doc).sort().join(', '));

    console.log('\n\n🔍 AC值字段检查:');
    if (doc.ac_value !== undefined) {
        console.log('✅ ac_value 字段存在');
        console.log('   示例值:', doc.ac_value);
        console.log('   数据类型:', typeof doc.ac_value);
    } else {
        console.log('❌ ac_value 字段不存在');
    }

    console.log('\n📊 示例组合数据:');
    console.log('   combination_id:', doc.combination_id);
    console.log('   红球:', [doc.red_ball_1, doc.red_ball_2, doc.red_ball_3, doc.red_ball_4, doc.red_ball_5]);
    console.log('   和值:', doc.sum_value);
    console.log('   跨度:', doc.span_value);
    console.log('   区间比:', doc.zone_ratio);
    console.log('   奇偶比:', doc.odd_even_ratio);
    console.log('   连号组数:', doc.consecutive_groups);
    console.log('   最长连号:', doc.max_consecutive_length);

    console.log('\n========================================\n');

    mongoose.disconnect();
}).catch(e => {
    console.error('❌ 错误:', e.message);
    mongoose.disconnect();
    process.exit(1);
});
