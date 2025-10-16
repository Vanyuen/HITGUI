const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery');

mongoose.connection.once('open', async () => {
  const col = mongoose.connection.db.collection('hit_dlt_combofeatures');

  const sample = await col.findOne({ Issue: '25081' });

  if (sample) {
    console.log('期号25081的特征数据:');
    console.log('  combo_2:', sample.combo_2 ? `存在, ${sample.combo_2.length}个` : '不存在');
    console.log('  combo_3:', sample.combo_3 ? `存在, ${sample.combo_3.length}个` : '不存在');
    console.log('  combo_4:', sample.combo_4 ? `存在, ${sample.combo_4.length}个` : '不存在');

    if (sample.combo_2 && sample.combo_2.length > 0) {
      console.log(`  示例combo_2: [${sample.combo_2.slice(0, 3).join(', ')}...]`);
    }
  } else {
    console.log('未找到期号25081');
  }

  process.exit(0);
});
