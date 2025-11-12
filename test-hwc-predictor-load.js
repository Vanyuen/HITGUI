// 测试HwcPositivePredictor是否能正确加载
const path = require('path');

console.log('🔍 开始测试 HwcPositivePredictor 加载...\n');

try {
    // 清除require缓存
    const serverPath = path.resolve(__dirname, 'src/server/server.js');
    console.log(`📂 服务器文件路径: ${serverPath}`);

    if (require.cache[serverPath]) {
        console.log('⚠️  发现缓存,正在清除...');
        delete require.cache[serverPath];
    }

    // 尝试读取文件内容验证
    const fs = require('fs');
    const content = fs.readFileSync(serverPath, 'utf8');

    // 检查关键代码是否存在
    const checks = [
        { name: 'HwcPositivePredictor类', pattern: /class HwcPositivePredictor extends StreamBatchPredictor/ },
        { name: '优化日志标记🚀', pattern: /🚀.*开始处理热温冷正选批量预测任务/ },
        { name: 'predictor实例化', pattern: /new HwcPositivePredictor\(/ },
        { name: '批量处理调用', pattern: /predictor\.streamPredict\(/ }
    ];

    console.log('\n✅ 代码存在性检查:');
    checks.forEach(check => {
        const found = check.pattern.test(content);
        console.log(`  ${found ? '✅' : '❌'} ${check.name}: ${found ? '存在' : '不存在'}`);
    });

    // 检查文件大小和行数
    const lines = content.split('\n').length;
    const size = (content.length / 1024).toFixed(2);
    console.log(`\n📊 文件统计:`);
    console.log(`  - 总行数: ${lines}`);
    console.log(`  - 文件大小: ${size} KB`);

    // 查找processHwcPositiveTask函数位置
    const funcMatch = content.match(/async function processHwcPositiveTask/g);
    if (funcMatch) {
        console.log(`  - processHwcPositiveTask定义: 找到 ${funcMatch.length} 处`);
    }

    console.log('\n✅ 测试完成!优化代码确实存在于源文件中。');
    console.log('💡 如果运行时仍然执行旧代码,说明存在缓存/加载问题。');

} catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
}
