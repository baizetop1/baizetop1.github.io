---
layout:     post
title:     MSF使用
subtitle:   教程
date:       2024-09-15
author:     白泽
header-img: img/post-bg-ios9-web.jpg
catalog: true
tags:
    - kali
    - 终端
    - 命令
---


# Metasploit使用

简称msf



## 主要功能

1. Auxiliaries(辅助模块)：扫描、嗅探、指纹识别

2. Exploit(漏洞利用模块)：利用漏洞进行攻击行为
3. Payload（攻击载荷模块）:攻击载荷是用于执行任意命令或特定代码，在MSF中可以自由的选择、传送或者植入
4. Post（后渗透模块）：在获取到目标系统的控制权限后，进行后渗透攻击动作，如获取敏感信息等攻击
5. 5.Encoders(编码工具模块) ：渗透中负责编码、免杀，防止被杀软、防火墙、IDS等安全软件检测出来

<hr>

## 步骤

1. 扫描寻找漏洞
2. 选择利用漏洞模块
3. 使用攻击载荷
4. 使用编码绕过杀软查杀
5. 攻击

<hr>

## 术语

渗透攻击（Exploit） 攻击载荷（Payload） 模块（Module） Shellcode   监听器（Listener）

<hr>

## 常用命令

```
searach  查找关键
use      使用模块
show options  查看参数选项
set 选项 参数     设置参数
show payloads 显示所有payload
session -i 列出会话列表
back  返回上一层
session -i会话id  选择会话
session -k会话id  杀掉会话
show targets   显示目标os版本
set target 目标序号   选择目标系统
show auxiliary  显示辅助模块
ctrl+z  把会话放在后台
ctrl+c  终止会话

```

  <hr>

## Metasploit使用

### 敏感目录扫描(字典)

```
auxiliary/scanner/http/brute_dirs
auxiliary/scanner/http/dir_listing 
auxiliary/scanner/http/dir_scanner
```

### 主机发现

```
auxiliary/scanner/discovery/arp_sweep 
auxiliary/scanner/discovery/empty_udp 
auxiliary/scanner/discovery/ipv6_neighbor  
auxiliary/scanner/discovery/udp_sweep
auxiliary/scanner/discovery/udp_probe
## 192.168.1.1/24的方式探测网段主机。
```

### 端口扫描

```
auxiliary/scanner/portscan/ack                                    
auxiliary/scanner/portscan/ftpbounce                               
auxiliary/scanner/portscan/syn                                     
auxiliary/scanner/portscan/tcp                                   
auxiliary/scanner/portscan/xmas  
##用来扫描端口
```

### 服务探测 

```
auxiliary/scanner/telnet/telnet_version  telnet探测
auxiliary/scanner/ssh/ssh_version      ssh探测
auxiliary/scanner/mssql/mssql_ping    mssql扫描
auxiliary/scanner/mysql/mysql_version  mysql扫描
```

### 暴力破解

```
auxiliary/scanner/mysql/mysql_login  
auxiliary/scanner/ssh/ssh_login 
auxiliary/scanner/mssql/mssql_login  
auxiliary/scanner/telnet/telnet_login 
auxiliary/scanner/ftp/ftp_login
```

<hr>

# nmap

```
• 直接调用Nmap去进行扫描
• Nmap -sS -Pn 192.168.1.1 -sV 
•-sS  SYN半连接扫描
•-Pn  扫描前不探测
•-sV  服务详细版本
```



本文章声明：分享内容仅用于网安爱好者之间的技术讨论，禁止用于违法途径，所有渗透都需获取授权！否则需自行承担，作者不承担相应的后果
