# 特殊符号

---

layout:     post
title:     符号
subtitle:   教程
date:       2025-06-16
author:     白泽
header-img: img/post-bg-books.jpg
catalog: true
tags:
    - Windows
        - Linux

    - 教程
---











## Windows 特殊符号



1. ``` |```符号
2. ```>```符号
3. ```>>```符号
4. ```&```符号
5. ```&&```符号

1.``` |```符号：管道符；用法：将左侧的命令输出作为右侧的命令的输入 实列说明：分页：``` dir | more```  查找特定进程  ``` tasklist | findstr "chrome"```  统计文件数量 ``` dir /b | find /c  ".txt"```

2.```>```  符号：输出重定向符；用法：将命令的输出结果**覆盖写入**到指定文件（若文件不存在则自动创建）； 实列说明：保存目录到文件: ``` dir > C:filelist.txt```  ;清空文件内容:``` ehco. > log.txt``` 

 3.```>>``` 符号：输出追加符(续写)；用法：将命令的输出追加到目标文件末尾（保留原内容，新增内容） ; 实列说明：

 	1.**持续记录日志**；

``` cmd
my_program.exe >> log.txt
echo 程序结束 >> log.txt```    
echo 程序开始运行 >> log.txt
```

​	2.**合并多个命令的输出**; 

``````cmd
dir *.txt >> all_files.txt
dir *.exe >> all_files.txt

``````

​	3.**避免意外覆盖重要文件**

``````cmd
# 追加新配置到 hosts 文件
echo 127.0.0.1 example.com >> C:\Windows\System32\drivers\etc\hosts

``````

4.`&` 符号：命令分隔符；用法：用于**按顺序执行多个命令**，无论前一个命令是否成功，后续命令都会**无条件执行**；实列说明：打印多个条件```echo Hello & dir invalid_folder & echo World```；

4.`&&` 符号：条件执行符；用法：仅当**前一个命令成功**（返回退出代码 `0`）时，才执行后续命令。若前一个命令失败（返回非 `0` 错误码），后续命令**不会执行**。；实例说明：编译成功后运行程序:``` dir C:\valid_folder && echo "目录存在" && type file.txt```