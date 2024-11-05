# MSF-msfconsole命令
---
layout:     post
title:      msfconsole命令
subtitle:   教程
date:       2024-11-05
author:     白泽
header-img: img/post-bg-waret.jpg
catalog: true
tags:
    - MSF
    - 命令
    - Linux
---

### 后端数据库命令Metasploit Database Backend Commands

<hr>

`analyze`-分析有关特定地址或地址范围的数据库信息

`db_connect`--连接到现有数据服务

`db_disconnect`--断开与当前数据服务的连接

`db_export`-导出包含数据库内容的文件

`db_import`-导入扫描结果文件（将自动检测文件类型）

`db_nmap`-执行nmap并自动记录输出

`db_remove`-删除已保存的数据服务条目

`db_status`-显示当前数据库服务状态

`creds`-列出数据库中的所有凭证

`hosts`-列出数据库中的所有主机

`loot`-列出所有数据库中的战利品

`notes`-列出数据库中的所有记录

`services`-列出数据库中的所有服务

`vuins`-列出数库中的所有漏洞

`workspace`-在数据库工作区之间切换

`db_save` -当前数据服务链接保存为启动时重新连接的默认值

## 核心命令（ Metasploit Core Commands )

`?`﹣帮助菜单

`banner`-﹣显示 Metasploit 旗标信息

`cd` ﹣更改当前工作目录

`color` ﹣切换颜色

`connect` ﹣与主机通信

`exit` ﹣退出控制台

`get` ﹣获取特定变量的值

`getg` ﹣获取全局变量的值

`grep` ﹣搜索另一个命令的输出

`help` ﹣帮助菜单

`history` ﹣显示命令历史记录

`load` ﹣加载框架插件

`quit` ﹣退出控制台

`repeat` ﹣重复一个命令列表

`route` ﹣通过会话路由流量 

`save` ﹣保存活动数据存储 

`sessions` ﹣显示会话列表和信息

`set` ﹣设置一个变量的值

`setg` ﹣设置一个全局变量的值

`sleep` ﹣在指定的秒数内不执行任何操作

`spool` ﹣将控制台输出写入文件以及屏幕

`threads` ﹣查看和操作后台线程 

`unload` ﹣卸载框架插件

 `unset` ﹣取消设置的一个或多个变量 

`unsetg` ﹣取消设置一个或多个全局变量 

`version` ﹣显示框架和控制台库版本号

## 模块命令（ Metasploit Module Commands )

`advanced `﹣显示一个或多个模块的高级选项

`back `﹣从当前环境返回

`info` ﹣显示一个或多个模块的详细信息 

`loadpath`﹣从路径中搜索并加载模块 

`options` ﹣显示全局选项或一个或多个模块 

`popm` ﹣使其主动从堆栈弹出新的模块

`previous` ﹣将先前加载的模块设置为当前模块 

`pushm` ﹣将活动模块或模块列表推送到模块堆栈

`reload _ all` ﹣重新加载所有模块

`search`﹣搜索模块名称和描述

`show` ﹣显示给定类型的的模块或所有模块

`use `﹣按名称选择模块

## 作业、脚本命令（ Metasploit Job 、 Script Commands )

<hr>

`makerc` ﹣保存从开始时输入的命令到一个文件 

`resource` ﹣运行存储在一个文件中的命令 

`handler` ﹣将有效载荷处理程序作为作业启动 

`jobs`﹣显示和管理作业

`kill` ﹣杀死一个作业

`renamejob` ﹣重命名作业

## 开发、利用命令（ Metasploit Developer 、 Exploit Commands )

<hr>

`edit `﹣使用首选编辑器编辑当前模块或文件

`irb` ﹣打开交互式 Ruby shell 

`log `﹣如果可能，显示 frame . log 分页到最后

`pry` ﹣在当前模块或框架上打开 Pry 调试器

`reload _ lib` ﹣从指定路径重新加载 Ruby 库文件

`check` ﹣检查目标是否容易受到攻击

`exploit` ﹣启动漏洞利用尝试

`rcheck` ﹣重新加载模块并检查目标是否易受攻击

`recheck` -重新检查 rcheck 的别名

`reload` ﹣重新加载指定模块

`rerun`  -重新运行 rexploit 的别名

`rexploit `﹣重新加载模块并启动漏洞利用尝试

`run `﹣运行别名以进行利用

## 数据库管理命令（ Metasploit Database Manage Command )

<hr>

`msfdb init` ﹣启动并初始化数据库

`msfdb reinit` ﹣删除并重新初始化数据库 

`msfdb delete` ﹣停止使用数据库并且删除

`msfdb run` ﹣启动数据库并运行 msfconsole 

`msfdb start` ﹣启动数据库

`msfdb stop` ﹣停止数据库

`msfdb status` ﹣检查服务状态

##  payload 命令

<hr>

`check `﹣检查查看目标是否易受攻击

`generate` ﹣生成生成有效负载

`reload` ﹣从磁盘重新加载当前模块

`to _ handler` ﹣创建具有指定负载的处理程序