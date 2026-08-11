# -*- coding: utf-8 -*-
"""后端服务入口。

业务代码位于 src/ 包内（模块化结构），本文件仅负责初始化数据库并启动服务。
启动：  python app.py
默认：  http://127.0.0.1:5000
"""
import os

from src.app import app
from src.db import init_db

if __name__ == '__main__':
    init_db()
    print('\n' + '=' * 60)
    print('  Tool 后端服务 已启动')
    print('  管理端:  http://127.0.0.1:5000')
    print('  数据库:  ' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'tool.db'))
    print('=' * 60 + '\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
