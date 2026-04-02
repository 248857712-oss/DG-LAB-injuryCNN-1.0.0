### 此为神经网络识别文件夹  
```
├── fps_injury_data(照片存储)  
│   ├── 0(此处放无伤文件)    
│   ├── (此处放轻伤文件)  
│   ├──  2(此处放重伤文件)  
│   ├── 注:所有文件都应为.png格式
├── chromedriveer.exe(这个应用是谷歌的自动程序，默认146，如需下载特定版本，请前往chromedriver官网)
├── cnn-game.py*(该模型会读取fps_injury_data中的照片，并生成fps_injury_cnn.pth模型)
├── test_injury(可以用来测试准确率--CNN-game.py运行后可以通过这张照片回测)
├── window-name-get.py(获得所有窗口名字，窗口不知道名字可以点这)