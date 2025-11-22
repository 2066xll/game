#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 开始部署配置测试...');
console.log('====================================\n');

// 检查必要文件是否存在
const requiredFiles = [
  'package.json',
  '.gitignore',
  '.env.example',
  '.github/workflows/cloudflare-deploy.yml',
  'deploy.sh',
  'cloudflare-pages-config.json'
];

let allFilesExist = true;
console.log('📄 检查必要文件:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n🔧 检查package.json脚本:');
let scriptsValid = true;
const packageJson = require('./package.json');
const requiredScripts = [
  'deploy',
  'deploy:dev',
  'deploy:worker',
  'deploy:auth-worker',
  'deploy:all',
  'login',
  'setup'
];

requiredScripts.forEach(script => {
  const exists = packageJson.scripts && packageJson.scripts[script];
  console.log(`  ${exists ? '✅' : '❌'} npm run ${script}`);
  if (!exists) scriptsValid = false;
});

console.log('\n⚙️  检查GitHub Actions配置:');
const githubWorkflow = fs.readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');
const hasDeployJobs = githubWorkflow.includes('deploy-production') && 
                     githubWorkflow.includes('deploy-preview');
console.log(`  ${hasDeployJobs ? '✅' : '❌'} GitHub Actions部署配置`);

console.log('\n📋 检查部署脚本权限:');
const deployScriptPerms = fs.statSync('deploy.sh').mode;
const isExecutable = (deployScriptPerms & 0o111) !== 0;
console.log(`  ${isExecutable ? '✅' : '⚠️'} deploy.sh可执行权限 (可通过chmod +x deploy.sh设置)`);

console.log('\n====================================');
console.log('📊 部署配置测试结果:');
if (allFilesExist && scriptsValid && hasDeployJobs) {
  console.log('🎉 所有配置检查通过! 项目已准备好部署到GitHub和Cloudflare。');
  console.log('\n下一步操作:');
  console.log('1. 复制.env.example为.env并填写您的Cloudflare账户信息');
  console.log('2. 运行 npm run setup 进行初始设置');
  console.log('3. 使用 npm run deploy 或 ./deploy.sh 进行部署');
} else {
  console.log('⚠️  部分配置检查未通过，请修复上述问题后再进行部署。');
}
console.log('====================================');

// 输出部署指南摘要
console.log('\n📚 部署流程摘要:');
console.log('1. 本地开发: npm run dev');
console.log('2. 开发环境部署: npm run deploy:dev');
console.log('3. 生产环境部署: npm run deploy');
console.log('4. 一键部署所有组件: npm run deploy:all');
console.log('5. 交互式部署: ./deploy.sh');
console.log('\n所有代码已推送到GitHub仓库的deploy-setup分支。');
console.log('请在GitHub上创建Pull Request将deploy-setup合并到main分支。');
console.log('合并后，GitHub Actions将自动触发Cloudflare部署。');
