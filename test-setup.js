// HITGUI 项目安装和测试脚本
const fs = require('fs');
const path = require('path');

console.log('🚀 HITGUI项目安装检查');
console.log('='.repeat(50));

// 检查项目结构
const requiredDirs = [
  'src/renderer',
  'src/server',
  'src/database',
  'build'
];

const requiredFiles = [
  'main.js',
  'preload.js',
  'package.json',
  'src/server/server.js',
  'src/database/config.js'
];

console.log('📁 检查项目结构...');
requiredDirs.forEach(dir => {
  const exists = fs.existsSync(dir);
  console.log(`   ${exists ? '✅' : '❌'} ${dir}`);
});

console.log('📄 检查关键文件...');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// 检查前端文件
console.log('🎨 检查前端文件...');
const frontendFiles = [
  'src/renderer/index.html',
  'src/renderer/app.js',
  'src/renderer/dlt-module.js',
  'src/renderer/style.css'
];

frontendFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// 检查package.json配置
console.log('⚙️  检查配置文件...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`   ✅ 项目名称: ${packageJson.name}`);
  console.log(`   ✅ 版本: ${packageJson.version}`);
  console.log(`   ✅ 主入口: ${packageJson.main}`);

  const scripts = Object.keys(packageJson.scripts);
  console.log(`   ✅ 脚本命令: ${scripts.join(', ')}`);

  const deps = Object.keys(packageJson.dependencies || {});
  console.log(`   ✅ 生产依赖: ${deps.length}个`);

  const devDeps = Object.keys(packageJson.devDependencies || {});
  console.log(`   ✅ 开发依赖: ${devDeps.length}个`);

} catch (error) {
  console.log(`   ❌ package.json读取失败: ${error.message}`);
}

console.log('='.repeat(50));
console.log('📋 下一步操作:');
console.log('1. 完成依赖安装: npm install');
console.log('2. 启动开发模式: npm run dev');
console.log('3. 启动生产模式: npm start');
console.log('4. 构建应用程序: npm run build');
console.log('='.repeat(50));