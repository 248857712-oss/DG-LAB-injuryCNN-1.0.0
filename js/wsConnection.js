var connectionId = ""; // 从接口获取的连接标识符
var targetWSId = ""; // 发送目标
var fangdou = 300; // 300毫秒防抖（优化响应速度）
var fangdouSetTimeOut; // 防抖定时器
let followAStrength = false; // 跟随A通道软上限
let followBStrength = false; // 跟随B通道软上限
var wsConn = null; // 全局ws链接
let softAStrength = 0; // A通道软上限缓存
let softBStrength = 0; // B通道软上限缓存

// 替换为你的电脑局域网IP（执行ipconfig/ifconfig查看）
const LOCAL_IP = "172.20.10.4";

// 反馈消息映射
const feedBackMsg = {
    "feedback-0": "A通道：○",
    "feedback-1": "A通道：△",
    "feedback-2": "A通道：□",
    "feedback-3": "A通道：☆",
    "feedback-4": "A通道：⬡",
    "feedback-5": "B通道：○",
    "feedback-6": "B通道：△",
    "feedback-7": "B通道：□",
    "feedback-8": "B通道：☆",
    "feedback-9": "B通道：⬡",
};

// 波形数据定义
const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`,
};

/**
 * 核心发送WS消息函数（防抖处理）
 * @param {Object} data - 发送的数据对象 { type: 数字, message: 字符串 }
 */
function sendWsMsg(data) {
    if (!wsConn || wsConn.readyState !== WebSocket.OPEN) {
        showToast("WebSocket未连接，无法发送消息");
        return;
    }
    if (!targetWSId) {
        showToast("未绑定目标设备，无法发送消息");
        return;
    }
    clearTimeout(fangdouSetTimeOut);
    fangdouSetTimeOut = setTimeout(() => {
        const sendData = {
            type: data.type || 4,
            targetId: targetWSId,
            clientId: connectionId,
            message: data.message || "",
        };
        try {
            wsConn.send(JSON.stringify(sendData));
            console.log("[发送WS消息]", sendData);
        } catch (e) {
            console.error("[发送WS失败]", e);
            showToast("消息发送失败：" + e.message);
        }
    }, fangdou);
}

// 隐藏二维码
function hideqrcode() {
    const qrcodeElement = document.getElementById("qrcode");
    if (qrcodeElement) qrcodeElement.style.display = "none";
}

// 基础Toast（错误提示）
function showToast(msg) {
    // 先移除已存在的toast
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "8px 16px";
    toast.style.backgroundColor = "#ff4444";
    toast.style.color = "#fff";
    toast.style.borderRadius = "4px";
    toast.style.zIndex = "9999";
    toast.style.fontSize = "14px";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// 成功Toast
function showSuccessToast(msg) {
    // 先移除已存在的toast
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "8px 16px";
    toast.style.backgroundColor = "#00C851";
    toast.style.color = "#fff";
    toast.style.borderRadius = "4px";
    toast.style.zIndex = "9999";
    toast.style.fontSize = "14px";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// 断开WebSocket连接
function disconnectWs() {
    if (!wsConn) return;
    wsConn.close(1000, "主动断开连接");
    wsConn = null;
    connectionId = "";
    targetWSId = "";
    
    // 更新UI状态
    document.getElementById("status").innerText = "已断开";
    document.getElementById("status").className = "red";
    document.getElementById("status-light").className = "red";
    document.getElementById("status-btn").innerText = "连接";
    document.getElementById("status-btn").classList.remove("red-background");
    
    // 重置跟随开关样式
    document.getElementById("follow-a").className = "follow-btn";
    document.getElementById("follow-b").className = "follow-btn";
    followAStrength = false;
    followBStrength = false;

    showToast("已断开WebSocket连接");
}

// 连接WebSocket
function connectWs() {
    // 已连接则提示
    if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        showToast("WebSocket已处于连接状态");
        return;
    }

    // 连接服务端（无末尾斜杠！）
    wsConn = new WebSocket(`ws://${LOCAL_IP}:9999`);

    // 连接成功回调
    wsConn.onopen = function (event) {
        console.log("WebSocket连接已建立");
        showSuccessToast("WebSocket连接成功");
        
        // 更新状态UI
        document.getElementById("status").innerText = "已连接（未绑定）";
        document.getElementById("status").className = "green";
        document.getElementById("status-light").className = "green";
    };

    // 接收消息回调
    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            console.log("非JSON格式消息：", event.data);
            return;
        }

        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    // 获取clientId并生成二维码
                    connectionId = message.clientId;
                    console.log("clientId：" + message.clientId);
                    
                    // 生成绑定二维码链接（官方正确格式）
                    const qrUrl = `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://${LOCAL_IP}:9999/${connectionId}`;
                    document.getElementById("qrcode").innerHTML = `
                        <div>绑定二维码（请使用APP扫码）</div>
                        <div style="margin:10px 0;">${qrUrl}</div>
                        <div>或复制链接到APP：${qrUrl}</div>
                    `;
                    console.log("✅ 绑定链接：", qrUrl);

                } else {
                    // 绑定目标设备成功
                    if (message.clientId !== connectionId) {
                        alert('收到不正确的target消息：' + message.message);
                        return;
                    }
                    targetWSId = message.targetId;
                    
                    // 更新绑定成功UI
                    document.getElementById("status").innerText = "已绑定设备";
                    document.getElementById("status-btn").innerText = "断开";
                    document.getElementById("status-btn").classList.add("red-background");
                    
                    console.log("绑定APP成功：" + message.targetId);
                    hideqrcode();
                    showSuccessToast("已连接到目标设备");
                }
                break;

            case 'break':
                // 对方断开连接
                if (message.targetId !== targetWSId) return;
                showToast("对方已断开：" + message.message);
                setTimeout(() => location.reload(), 1000);
                break;

            case 'error':
                // 错误消息
                if (message.targetId !== targetWSId) return;
                showToast("错误：" + message.message);
                break;

            case 'msg':
                // 业务消息（强度、反馈等）
                if (message.message.includes("strength")) {
                    // 解析强度数据
                    const numbers = message.message.match(/\d+/g)?.map(Number) || [];
                    if (numbers.length >= 4) {
                        document.getElementById("channel-a").innerText = numbers[0];
                        document.getElementById("channel-b").innerText = numbers[1];
                        document.getElementById("soft-a").innerText = numbers[2];
                        document.getElementById("soft-b").innerText = numbers[3];

                        // 跟随软上限逻辑
                        if (followAStrength && numbers[2] !== numbers[0]) {
                            softAStrength = numbers[2];
                            sendWsMsg({ type: 4, message: `strength-1+2+${numbers[2]}` });
                        }
                        if (followBStrength && numbers[3] !== numbers[1]) {
                            softBStrength = numbers[3];
                            sendWsMsg({ type: 4, message: `strength-2+2+${numbers[3]}` });
                        }
                    }
                } else if (message.message.includes("feedback")) {
                    // 反馈消息提示
                    showSuccessToast(feedBackMsg[message.message] || "未知反馈");
                }
                break;

            case 'heartbeat':
                // 心跳消息（更新状态灯）
                console.log("收到心跳");
                if (targetWSId) {
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';
                    setTimeout(() => light.style.color = '#ffe99d', 1000);
                }
                break;
        }
    };

    // 连接错误回调
    wsConn.onerror = function (event) {
        console.error("WebSocket连接错误：", event);
        showToast("WebSocket连接出错");
    };

    // 连接关闭回调
    wsConn.onclose = function (event) {
        console.log("WebSocket断开：" + event.code);
        // 非主动断开则尝试重连
        if (event.code !== 1000) {
            showToast("连接断开，尝试重连...");
            setTimeout(connectWs, 3000);
        }
        
        // 重置UI状态
        document.getElementById("status").innerText = "已断开";
        document.getElementById("status").className = "red";
        document.getElementById("status-light").className = "red";
        document.getElementById("status-btn").innerText = "连接";
        document.getElementById("status-btn").classList.remove("red-background");
    };
}

// 手动设置强度发送函数
function sendManualStrength() {
    const aVal = document.getElementById("manual-a").value;
    const bVal = document.getElementById("manual-b").value;
    
    // 验证输入
    if (aVal < 0 || aVal > 100 || bVal < 0 || bVal > 100) {
        showToast("强度值必须在0-100之间");
        return;
    }

    // 发送A通道强度
    sendWsMsg({ type: 4, message: `strength-1+1+${aVal}` });
    // 发送B通道强度
    sendWsMsg({ type: 4, message: `strength-2+1+${bVal}` });
    
    showSuccessToast(`已发送手动强度：A=${aVal}，B=${bVal}`);
}

// 初始化页面事件
window.onload = function () {
    // 连接/断开按钮事件
    const statusBtn = document.getElementById("status-btn");
    if (statusBtn) {
        statusBtn.addEventListener("click", function () {
            if (this.innerText === "断开") disconnectWs();
            else connectWs();
        });
    }

    // A通道跟随开关事件
    const followA = document.getElementById("follow-a");
    if (followA) {
        followA.addEventListener("click", function () {
            followAStrength = !followAStrength;
            this.className = followAStrength ? "follow-btn active" : "follow-btn";
            showToast(`A通道${followAStrength ? '开启' : '关闭'}跟随软上限`);
        });
    }

    // B通道跟随开关事件
    const followB = document.getElementById("follow-b");
    if (followB) {
        followB.addEventListener("click", function () {
            followBStrength = !followBStrength;
            this.className = followBStrength ? "follow-btn active" : "follow-btn";
            showToast(`B通道${followBStrength ? '开启' : '关闭'}跟随软上限`);
        });
    }

    // 手动发送强度按钮事件
    const sendManualBtn = document.getElementById("send-manual");
    if (sendManualBtn) {
        sendManualBtn.addEventListener("click", sendManualStrength);
    }

    // 自动尝试连接
    connectWs();
};

// 暴露全局函数（供调试/外部调用）
window.sendWsMsg = sendWsMsg;
window.connectWs = connectWs;
window.disconnectWs = disconnectWs;
window.setFollowStrength = function (channel, isFollow) {
    if (channel === 'A') {
        followAStrength = isFollow;
        document.getElementById("follow-a").className = isFollow ? "follow-btn active" : "follow-btn";
    } else if (channel === 'B') {
        followBStrength = isFollow;
        document.getElementById("follow-b").className = isFollow ? "follow-btn active" : "follow-btn";
    }
    showToast(`通道${channel}${isFollow ? '开启' : '关闭'}跟随`);
};