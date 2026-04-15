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
1.修改wcConnection.js
```
const LOCAL_IP = "本机ip地址";
```
2.在同一局域网下，使用任意能打开网站的软件(如vscode)打开js文件中的**index.html**,获取自己的url，
 例如http://xxx.x.x.x:xxxx/index.html,然后关闭此网站  

3.将**identify-data**中**identify-link.py**中修改**WEB_URL = "此处改为第一步获取的网站"**
**GAME_WINDOW_TITLE** = "**此处改为游戏弹窗窗口名**(若不知道，使用**CNN**目录下的**window-game-get.py**获取所有窗口名"
```python
# Selenium 配置
WEB_URL = "你的index地址"
DELAY_SECONDS = 20  # 打开网页后等待20秒
```
4.启动**identify-link.py**并修改此处url(需修改该文件其他某些东西，请访问该目录下**README.md**)
5.启动后会出现以下内容

绑定二维码（请使用APP扫码）
https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://xxx.xx.xx.xx:9999/xxxxxxxxxxxxx  
或复制链接到APP：https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://xx.xx.xx.xx:9999/xxxxxxxxxxx  
请**复制**该链接其中一条，并 直接用网页生成QR码与郊狼远程扫码
5.等待一段时间后，该程序会通过识别屏幕调节强度，如果要调节屏幕大小，位置，请访问**identify-data**目录下**README.md**


