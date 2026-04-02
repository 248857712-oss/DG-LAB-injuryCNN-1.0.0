
### URL配置
```
WEB_URL = ""  <---引号里改成自己的网站打开地址
```
### 通道设置
默认双通道，如果要改单通道  


```
def send_strength(a, b):  
     发送 A 通道  
    driver.execute_script(f'''  
        sendWsMsg({{  
            type: 4,  
            message: "strength-1+2+{a}"  <--将{a}改成0即可
        }});
    ''')
    time.sleep(1)        
      发送 B 通道  
  
    driver.execute_script(f'''
        sendWsMsg({{
            type: 4,
            message: "strength-2+2+{b}" <--或将{b}改成0即可
        }});
    ''')  
```
### 强度设置
``` 

            if cls != last_cls:
                last_cls = cls  # 更新状态

                if cls == 0:
                    send_strength(0, 0)  <--此处分别改a,b强度(无伤)
                elif cls == 1:
                    send_strength(30, 30)  <--此处分别改a,b强度(轻伤)
                elif cls == 2:
                    send_strength(60, 60)  <--此处分别改a,b强度(重伤)
```
### 屏幕大小,位置和识别窗口设置
```
GAME_WINDOW_TITLE = "1" <-----此处调节窗口名字
CAPTURE_OFFSET_X = 50 <---此处调节x轴
CAPTURE_OFFSET_Y = 900 <---此处调节y轴
CAPTURE_WIDTH = 300    <---此处调节长度
CAPTURE_HEIGHT = 100   <---此处调节宽度
```