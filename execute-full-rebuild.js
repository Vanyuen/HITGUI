const http = require('http');

console.log('🚀 正在执行全量重建...\n');
console.log('请切换到服务器控制台窗口，观察进度输出！\n');

const postData = JSON.stringify({
  mode: 'full'
});

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
  console.log(`✅ 请求已发送，状态码: ${res.statusCode}\n`);

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📋 API响应:');
      console.log(JSON.stringify(response, null, 2));
      console.log('\n请查看服务器控制台的详细进度输出！');
      console.log('等待看到 "🎉 统一更新完成！" 后，运行验证脚本：');
      console.log('node verify-full-rebuild-result.js\n');
    } catch (err) {
      console.log('📋 原始响应:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.error('\n请确认：');
  console.error('1. 应用程序正在运行（npm start）');
  console.error('2. 服务器端口3003可访问');
});

req.write(postData);
req.end();
