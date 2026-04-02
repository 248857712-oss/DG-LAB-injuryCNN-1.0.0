# 使用前请先配置好nodejs环境！！！

```
├── data
│   ├── CNN(卷积神经网络识别主文件)
│   └── identify-data(程序启动文件)
├── js
│   ├── wsConnection.js(配置文件)
│   ├── wwbsocketNode.js(配置文件)
│   ├── index.html(网页源文件)
│   ├── node_modules(环境文件)
│   ├── package.json(配置文件)
│   └── package-lock.json(配置文件)
```
# 使用方法
1.在**data**/**CNN**目录下创建**fps_injury_data**文件,在文件中分别创建**0**,**1**,**2**文件，**0**中存储游戏无伤图片(格式为.png,后同),**1**中存储游戏轻伤图片,**2**中存储游戏重伤图片  
2.使用CNN-game.py对照片进行分析会生成模型fps_injury_cnn.pth,同时可以提前增加一张在同目录下的照片名为test_injury.jpg进行回测  



3.在同一局域网下，使用任意能打开网站的软件(如vscode)打开js文件中的**index.html**,获取自己的url，
 例如http://xxx.x.x.x:xxxx/index.html,然后关闭此网站  

4.将**identify-data**中**identify-link.py**中修改**WEB_URL = "此处改为第一步获取的网站"**
**GAME_WINDOW_TITLE** = "**此处改为游戏弹窗窗口名**(若不知道，使用**CNN**目录下的**window-game-get.py**获取所有窗口名"

5.启动**identify-link.py**(如需修改该文件某些东西，请访问该目录下**README.md**)

6.启动后会出现以下内容

绑定二维码（请使用APP扫码）
https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://xxx.xx.xx.xx:9999/xxxxxxxxxxxxx  
或复制链接到APP：https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://xx.xx.xx.xx:9999/xxxxxxxxxxx  
请**复制**该链接其中一条，并 直接用网页生成QR码与郊狼远程扫码  
7.等待一段时间后，该程序会通过识别屏幕调节强度，如果要调节屏幕大小，位置，请访问**identify-data**目录下**README.md**获取帮助


