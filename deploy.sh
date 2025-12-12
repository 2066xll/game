#!/bin/bash

# 游戏网站项目部署脚本
# 这个脚本简化了将项目部署到Cloudflare Pages的过程

echo "===== 游戏网站项目部署脚本 ====="
echo "此脚本将帮助您快速部署项目到Cloudflare Pages"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查npm和wrangler是否安装
check_dependencies() {
    echo -e "${BLUE}检查依赖...${NC}"
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}错误: npm 未安装，请先安装Node.js和npm${NC}"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}警告: wrangler 未安装，正在安装...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}依赖检查完成${NC}"
}

# 执行依赖检查
check_dependencies

# Cloudflare OAuth登录函数
oauth_login() {
    echo -e "${BLUE}正在执行Cloudflare OAuth登录...${NC}"
    # 使用不包含API Token的环境变量文件
    if [ -f ".env.login" ]; then
        cp .env.login .env
        echo -e "${GREEN}已切换到登录环境配置${NC}"
    else
        echo -e "${YELLOW}警告: .env.login文件不存在，创建默认版本...${NC}"
        cat > .env.login << EOL
# Cloudflare配置环境变量（用于登录）
# 不包含API Token，允许OAuth登录

# Cloudflare账户信息
CLOUDFLARE_ACCOUNT_ID="你的Cloudflare账户ID"

# 项目配置
PROJECT_NAME="game-website"

# 环境配置
NODE_ENV="production"

# API端点配置
API_ENDPOINT="你的域名.workers.dev"
WEBSOCKET_ENDPOINT="wss://你的域名.workers.dev"
EOL
        cp .env.login .env
    fi
    
    # 执行登录
    wrangler login
    
    # 恢复原始环境配置
    if [ -f ".env.backup" ]; then
        cp .env.backup .env
        echo -e "${GREEN}已恢复原始环境配置${NC}"
    fi
    
    echo -e "${GREEN}登录完成${NC}"
}

# 显示菜单
show_menu() {
    echo -e "\n${YELLOW}请选择要执行的操作:${NC}"
    echo -e "${YELLOW}1) Cloudflare OAuth登录${NC}"
    echo -e "${YELLOW}2) 安装依赖并构建项目${NC}"
    echo -e "${YELLOW}3) 部署到Cloudflare Pages（开发环境）${NC}"
    echo -e "${YELLOW}4) 部署到Cloudflare Pages（生产环境）${NC}"
    echo -e "${YELLOW}5) 部署Workers${NC}"
    echo -e "${YELLOW}6) 运行数据库初始化${NC}"
    echo -e "${YELLOW}7) 退出${NC}"
}

# 登录Cloudflare（保留向后兼容性）
login_cloudflare() {
    oauth_login # 使用新的OAuth登录函数
}

# 安装依赖并构建项目
build_project() {
    echo "\n正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "✗ 依赖安装失败!"
        return 1
    fi
    
    echo "\n正在构建项目..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "✗ 项目构建失败!"
        return 1
    fi
    
    echo "✓ 项目构建成功!"
    return 0
}

# 部署到Cloudflare Pages（开发环境）
deploy_preview() {
    # 检查是否已构建
    if [ ! -d "dist" ]; then
        echo "错误: 未找到构建目录。请先运行构建。"
        return 1
    fi
    
    echo "\n正在部署到Cloudflare Pages预览环境..."
    wrangler pages deploy dist --project-name=game-website --branch=preview
    if [ $? -eq 0 ]; then
        echo "✓ Cloudflare Pages预览环境部署成功!"
    else
        echo "✗ Cloudflare Pages预览环境部署失败!"
    fi
}

# 部署到Cloudflare Pages（生产环境）
deploy_production() {
    # 创建备份
    if [ -f ".env" ]; then
        cp .env .env.backup
        echo -e "${GREEN}已创建环境变量备份${NC}"
    fi
    
    # 检查是否已构建
    if [ ! -d "dist" ]; then
        echo -e "${RED}错误: 未找到构建目录。请先运行构建。${NC}"
        return 1
    fi
    
    echo -e "\n${BLUE}正在部署到Cloudflare Pages生产环境...${NC}"
    echo -e "${YELLOW}警告: 这将部署到生产环境！${NC}"
    read -p "确定要继续吗？(y/n): " confirm
    
    if [ "$confirm" != "y" ]; then
        echo -e "${YELLOW}部署已取消。${NC}"
        return 0
    fi
    
    wrangler pages deploy dist --project-name=game-website --branch=main
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Cloudflare Pages生产环境部署成功!${NC}"
    else
        echo -e "${RED}✗ Cloudflare Pages生产环境部署失败!${NC}"
    fi
}

# 部署Workers
deploy_workers() {
    echo "\n正在部署Workers..."
    
    # 部署WebSocket Worker
    echo "\n部署WebSocket Worker..."
    wrangler deploy ./src/workers/websocket-worker.js --name=game-websocket-worker
    
    # 部署认证Worker
    echo "\n部署认证Worker..."
    wrangler deploy ./src/workers/auth-worker.js --name=game-auth-worker
    
    # 部署消息清理Worker
    echo "\n部署消息清理Worker..."
    wrangler deploy --env message-cleanup-worker
    
    echo "✓ Workers部署完成!"
}

# 运行数据库初始化
init_database() {
    echo "\n正在初始化数据库..."
    wrangler deploy --name db-init-worker ./src/workers/db-init-worker.js
    
    if [ $? -eq 0 ]; then
        echo "✓ 数据库初始化Worker部署成功!"
        echo "请访问Worker URL来初始化数据库。"
    else
        echo "✗ 数据库初始化Worker部署失败!"
    fi
}

# 主循环
while true; do
    show_menu
    read -p "请输入选择 (1-7): " choice
    
    case $choice in
        1)
            oauth_login
            ;;
        2)
            build_project
            ;;
        3)
            deploy_preview
            ;;
        4)
            deploy_production
            ;;
        5)
            deploy_workers
            ;;
        6)
            init_database
            ;;
        7)
            echo -e "\n${GREEN}谢谢使用！再见。${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效的选择，请重新输入。${NC}"
            ;;
    esac
    
    read -p "\n按Enter键继续..."
 done