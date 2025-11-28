const http = require('http');

console.log('========================================');
console.log('🔍 强制测试：调用API并等待响应');
console.log('========================================\n');

const postData = JSON.stringify({ mode: 'full' });

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/dlt/unified-update',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📤 发送请求到: http://localhost:3003/api/dlt/unified-update');
console.log('📦 请求体:', postData);
console.log('');

const req = http.request(options, (res) => {
  console.log('✅ 收到响应！');
  console.log(`   状态码: ${res.statusCode}`);
  console.log(`   响应头:`, JSON.stringify(res.headers, null, 2));
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📋 响应内容:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }

    console.log('\n========================================');
    console.log('🚨 关键检查点！');
    console.log('========================================\n');
    console.log('请立即查看服务器控制台（npm start窗口）！');
    console.log('');
    console.log('应该看到以下输出之一：');
    console.log('');
    console.log('✅ 如果API正常工作：');
    console.log('   2025-11-21T01:XX:XX.XXX - 🚀 [统一更新] 开始执行，模式: full');
    console.log('   ═══════════════════════════════════════════════════════════════');
    console.log('   🚀 开始统一更新大乐透数据表');
    console.log('');
    console.log('❌ 如果服务器控制台完全没有新输出：');
    console.log('   说明API路由没有被调用，需要进一步诊断！');
    console.log('');
    console.log('请告诉我服务器控制台显示了什么！\n');
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
