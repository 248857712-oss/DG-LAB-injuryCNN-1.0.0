import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import mss
import pygetwindow as gw
import time

# ===================== Selenium 浏览器控制（成功方式）=====================
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

# ===================== 配置 =====================
GAME_WINDOW_TITLE = "这里改成自己的窗口名” #这里改成自己的窗口名，具体说明看README.md
CAPTURE_OFFSET_X = 50
CAPTURE_OFFSET_Y = 900
CAPTURE_WIDTH = 300
CAPTURE_HEIGHT = 100
LOG_INTERVAL = 10  # 每10秒检测一次
MODEL_PATH = "../CNN/fps_injury_cnn.pth"

# Selenium 配置
WEB_URL = "自己的网站地址/index.html" #注意修改此处！！！
DELAY_SECONDS = 20  # 打开网页后等待20秒

CLASS_EN = ["No Injury", "Light Injury", "Severe Injury"]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

transform = transforms.Compose([
    transforms.Resize((64, 64)),
    transforms.ToTensor(),
    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])


# ===================== CNN 模型 =====================
class InjuryCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(), nn.Linear(64 * 8 * 8, 128), nn.ReLU(), nn.Dropout(0.5), nn.Linear(128, 3)
        )

    def forward(self, x): return self.classifier(self.features(x))


# ===================== 加载模型 =====================
model = InjuryCNN().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()

# ===================== 全局浏览器驱动 =====================
driver = None


def init_browser():
    global driver
    options = webdriver.ChromeOptions()
    options.add_experimental_option("detach", True)
    driver = webdriver.Chrome(service=Service("../CNN/chromedriver.exe"), options=options)
    driver.get(WEB_URL)
    print("✅ 网页已打开，请等待连接设备...")
    time.sleep(DELAY_SECONDS)


# =====================  强度发送 =====================
def send_strength(a, b):
    # 发送 A 通道
    driver.execute_script(f'''
        sendWsMsg({{
            type: 4,
            message: "strength-1+2+{a}"
        }});
    ''')
    time.sleep(1)         #可调间隔时间，时间太小无法唤醒其中一个通道

    # 发送 B 通道
    driver.execute_script(f'''
        sendWsMsg({{
            type: 4,
            message: "strength-2+2+{b}"
        }});
    ''')

    print(f"⚡ 已发送强度 → A:{a}  B:{b}")


# ===================== 识别 =====================
def predict(frame):
    img = transform(Image.fromarray(frame)).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        return model(img).argmax(1).item()


# ===================== 主程序 =====================
def main():
    init_browser()

    print("🔍 正在寻找游戏窗口...")
    while True:
        windows = gw.getWindowsWithTitle(GAME_WINDOW_TITLE)
        if len(windows) > 0:
            win = windows[0]
            break
        time.sleep(1)
        print("⏳ 等待窗口打开...")

    sct = mss.mss()
    last_log = 0
    last_cls = -1  # 记录上一次的状态

    while True:
        frame = np.array(sct.grab({
            "top": win.top + CAPTURE_OFFSET_Y,
            "left": win.left + CAPTURE_OFFSET_X,
            "width": CAPTURE_WIDTH,
            "height": CAPTURE_HEIGHT
        }))
        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
        cls = predict(frame)

        # 每10秒执行一次
        if time.time() - last_log >= LOG_INTERVAL:
            last_log = time.time()
            print(f"[{CLASS_EN[cls]}] → 10秒自动检测")

            # ==============================================
            # ✅ 核心强度设置
            # ==============================================
            if cls != last_cls:
                last_cls = cls  # 更新状态

                if cls == 0:
                    send_strength(0, 0)  # 恒定 0，在这里可以改无伤强度
                elif cls == 1:
                    send_strength(30, 30)  # 恒定 30，在这里可以改轻伤强度
                elif cls == 2:
                    send_strength(60, 60)  # 恒定 60，在这里可以改重伤强度

        cv2.imshow("Control", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break


if __name__ == "__main__":
    main()
