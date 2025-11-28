const http = require('http');

console.log('🔍 再次触发全量重建，并等待10秒观察...\n');

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
  console.log(`✅ API响应状态码: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📋 API响应内容:');
    console.log(data);
    console.log('\n⏳ 等待10秒，让服务器开始处理...');
    console.log('请立即切换到服务器控制台查看是否有新输出！\n');

    setTimeout(() => {
      console.log('⏱️  10秒已过');
      console.log('请检查服务器控制台是否显示:');
      console.log('  ═══════════════════════════════════════════════════════════════');
      console.log('  🚀 开始统一更新大乐透数据表');
      console.log('  ✅ 步骤1/6: 生成遗漏值表');
      console.log('\n如果没有这些输出，说明executeUnifiedUpdate函数没有被调用！');
      process.exit(0);
    }, 10000);
  });
});

req.on('error', (error) => {
  console.error('❌ API调用失败:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
