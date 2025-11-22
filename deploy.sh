#!/bin/bash

# 游戏网站项目部署脚本
# 这个脚本简化了将项目部署到Cloudflare Pages的过程

echo "===== 游戏网站项目部署脚本 ====="
echo "此脚本将帮助您快速部署项目到Cloudflare Pages"

# 检查Wrangler是否安装
if ! command -v wrangler &> /dev/null; then
    echo "错误: 未找到wrangler命令。请先安装: npm install -g wrangler"
    exit 1
fi

# 检查npm环境
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到npm命令。请先安装Node.js"
    exit 1
fi

# 显示菜单
show_menu() {
    echo "\n请选择要执行的操作:"
    echo "1) 登录Cloudflare"
    echo "2) 安装依赖并构建项目"
    echo "3) 部署到Cloudflare Pages（开发环境）"
    echo "4) 部署到Cloudflare Pages（生产环境）"
    echo "5) 部署Workers"
    echo "6) 运行数据库初始化"
    echo "7) 退出"
}

# 登录Cloudflare
login_cloudflare() {
    echo "\n正在启动Cloudflare登录流程..."
    wrangler login
    if [ $? -eq 0 ]; then
        echo "✓ Cloudflare登录成功!"
    else
        echo "✗ Cloudflare登录失败!"
    fi
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
    # 检查是否已构建
    if [ ! -d "dist" ]; then
        echo "错误: 未找到构建目录。请先运行构建。"
        return 1
    fi
    
    echo "\n正在部署到Cloudflare Pages生产环境..."
    echo "警告: 这将部署到生产环境！"
    read -p "确定要继续吗？(y/n): " confirm
    
    if [ "$confirm" != "y" ]; then
        echo "部署已取消。"
        return 0
    fi
    
    wrangler pages deploy dist --project-name=game-website --branch=main
    if [ $? -eq 0 ]; then
        echo "✓ Cloudflare Pages生产环境部署成功!"
    else
        echo "✗ Cloudflare Pages生产环境部署失败!"
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
            login_cloudflare
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
            echo "\n谢谢使用！再见。"
            exit 0
            ;;
        *)
            echo "无效的选择，请重新输入。"
            ;;
    esac
    
    read -p "\n按Enter键继续..."
 done