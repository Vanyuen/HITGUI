const mongoose = require('mongoose');
(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const hwcColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const dltColl = db.collection('hit_dlts');
    
    const hwcCount = await hwcColl.countDocuments();
    const drawnCount = await hwcColl.countDocuments({ 'hit_analysis.is_drawn': true });
    const predictedCount = await hwcColl.countDocuments({ 'hit_analysis.is_drawn': false });
    const dltCount = await dltColl.countDocuments();
    
    console.log('热温冷优化表: ' + hwcCount + ' 条');
    console.log('  已开奖期: ' + drawnCount + ' (期望 ' + (dltCount-1) + ')');
    console.log('  推算期: ' + predictedCount + ' (期望 1)');
    
    const latestDrawn = await hwcColl.findOne({ 'hit_analysis.is_drawn': true }, { sort: { target_issue: -1 } });
    const latestDlt = await dltColl.findOne({}, { sort: { Issue: -1 } });
    
    console.log('最新已开奖期: ' + (latestDrawn ? latestDrawn.target_issue : 'N/A'));
    console.log('hit_dlts最新: ' + latestDlt.Issue);
    
    await mongoose.disconnect();
    process.exit(0);
})();
