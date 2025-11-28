const http = require('http');

console.log('🔍 测试服务器连接和API路由...\n');

// 测试1: 检查服务器是否响应
console.log('测试1: 检查服务器根路径...');
http.get('http://localhost:3003/', (res) => {
  console.log(`✅ 服务器响应: 状态码 ${res.statusCode}\n`);

  // 测试2: 调用统一更新API
  console.log('测试2: 调用统一更新API...');

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

  const req = http.request(options, (res) => {
    console.log(`📋 API响应状态码: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('📋 API响应内容:');
      console.log(data);
      console.log('\n🔍 请立即查看服务器控制台，应该看到:');
      console.log('   🚀 [统一更新] 开始执行，模式: full');
      console.log('\n如果服务器控制台没有这行输出，说明API路由有问题！');
    });
  });

  req.on('error', (error) => {
    console.error('❌ API调用失败:', error.message);
  });

  req.write(postData);
  req.end();

}).on('error', (error) => {
  console.error('❌ 服务器连接失败:', error.message);
  console.error('\n可能原因:');
  console.error('1. 服务器未启动');
  console.error('2. 端口3003被其他进程占用');
  console.error('3. 防火墙阻止连接');
});
