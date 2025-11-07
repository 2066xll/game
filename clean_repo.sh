#!/bin/bash

# 保留website文件夹，删除其他所有子文件夹

# 删除GunTower下除website外的文件夹
find GunTower -type d -not -path "*/website*" -not -path "*/\.*" -exec rm -rf {} \; 2>/dev/null

# 删除SuperMario下除website外的文件夹
find SuperMario -type d -not -path "*/website*" -not -path "*/\.*" -exec rm -rf {} \; 2>/dev/null

# 清理空文件夹
find . -type d -empty -delete 2>/dev/null

echo "清理完成"