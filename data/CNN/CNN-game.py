import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import cv2
import numpy as np
import os

# ===================== 1. 全局配置 =====================
# 图像尺寸（统一缩放到64x64，保证推理速度）
IMG_SIZE = 64
# 分类类别：0=无受伤 1=轻伤 2=重伤
CLASS_NAMES = ["无受伤", "轻伤", "重伤"]
NUM_CLASSES = len(CLASS_NAMES)
# 训练参数
BATCH_SIZE = 8
EPOCHS = 15
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"使用设备: {DEVICE}")

# ===================== 2. 自定义数据集 =====================
class FPSInjuryDataset(Dataset):
    def __init__(self, data_dir, transform=None):
        """
        数据集结构：
        data_dir/
            ├── 0/  (无受伤图片)
            ├── 1/  (轻伤图片)
            └── 2/  (重伤图片)
        """
        self.data_dir = data_dir
        self.transform = transform
        self.image_paths = []
        self.labels = []

        # 加载所有图片路径和标签
        for label in range(NUM_CLASSES):
            folder = os.path.join(data_dir, str(label))
            if not os.path.exists(folder):
                os.makedirs(folder)
            for img_name in os.listdir(folder):
                self.image_paths.append(os.path.join(folder, img_name))
                self.labels.append(label)

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        label = self.labels[idx]
        # 读取图片并转换RGB
        image = Image.open(img_path).convert("RGB")
        # 数据增强/预处理
        if self.transform:
            image = self.transform(image)
        return image, label

# ===================== 3. 轻量化CNN模型 =====================
class InjuryCNN(nn.Module):
    def __init__(self):
        super(InjuryCNN, self).__init__()
        # 卷积层组：提取图像特征（红伤特效、血量条颜色变化）
        self.features = nn.Sequential(
            # 第一层卷积
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            # 第二层卷积
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            # 第三层卷积
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
        )
        # 全连接层：分类输出
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 8 * 8, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, NUM_CLASSES)
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x

# ===================== 4. 数据预处理 =====================
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    # 归一化（提升模型收敛速度）
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
])

# ===================== 5. 训练函数 =====================
def train_model(model, train_loader, criterion, optimizer, epochs):
    model.train()
    for epoch in range(epochs):
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)

            # 前向传播
            outputs = model(images)
            loss = criterion(outputs, labels)

            # 反向传播+优化
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            # 统计
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

        # 打印训练日志
        avg_loss = running_loss / len(train_loader)
        acc = 100 * correct / total
        print(f"Epoch [{epoch+1}/{epochs}] | 损失: {avg_loss:.4f} | 准确率: {acc:.2f}%")

    print("训练完成！")
    # 保存模型
    torch.save(model.state_dict(), "fps_injury_cnn.pth")
    print("模型已保存为 fps_injury_cnn.pth")

# ===================== 6. 实时推理函数（游戏画面预测） =====================
def predict_injury(image_path, model):
    """
    输入：游戏截图路径
    输出：受伤等级、置信度
    """
    model.eval()
    image = Image.open(image_path).convert("RGB")
    image = transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(image)
        # 计算置信度
        probabilities = torch.softmax(outputs, dim=1)
        confidence, predicted = torch.max(probabilities, 1)

    class_id = predicted.item()
    injury_level = CLASS_NAMES[class_id]
    conf = confidence.item() * 100
    return class_id, injury_level, conf

# ===================== 7. 主函数 =====================
if __name__ == "__main__":
    # ========== 步骤1：初始化数据集和加载器 ==========
    # 请在此处放入你的数据集路径
    train_dataset = FPSInjuryDataset(data_dir="fps_injury_data", transform=transform)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)

    # ========== 步骤2：初始化模型、损失函数、优化器 ==========
    model = InjuryCNN().to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    # ========== 步骤3：训练模型 ==========
    print("开始训练模型...")
    train_model(model, train_loader, criterion, optimizer, EPOCHS)

    # ========== 步骤4：测试单张图片预测 ==========
    print("\n===== 模型预测测试 =====")
    # 替换为你的游戏截图路径
    test_img_path = "test_injury.jpg"
    if os.path.exists(test_img_path):
        class_id, injury_level, confidence = predict_injury(test_img_path, model)
        print(f"预测结果：{injury_level}")
        print(f"置信度：{confidence:.2f}%")
    else:
        print("未找到测试图片，请添加 test_injury.jpg 到当前目录")