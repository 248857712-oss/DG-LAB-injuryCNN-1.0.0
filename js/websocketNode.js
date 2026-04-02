const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 储存已连接的用户及其标识
const clients = new Map();
// 存储消息关系（clientId -> targetId）
const relations = new Map();
// 默认发送时长/频率
const punishmentDuration = 5;
const punishmentTime = 1;
// 存储客户端和发送计时器关系（clientId-channel -> timerId）
const clientTimers = new Map();

// 心跳消息模板
const heartbeatMsg = {
    type: "heartbeat",
    clientId: "",
    targetId: "",
    message: "200"
};

// 心跳定时器
let heartbeatInterval;

// 创建WS服务端
const wss = new WebSocket.Server({ port: 9999 });
console.log("WebSocket服务已启动，端口：9999");

// 处理新连接
wss.on('connection', function connection(ws) {
    // 生成唯一clientId
    const clientId = uuidv4();
    console.log(`新连接建立，clientId：${clientId}`);

    // 存储客户端连接
    clients.set(clientId, ws);

    // 发送bind消息给客户端（返回clientId）
    ws.send(JSON.stringify({
        type: 'bind',
        clientId,
        message: 'targetId',
        targetId: ''
    }));

    // 监听客户端消息
    ws.on('message', function incoming(rawMessage) {
        console.log(`收到消息：${rawMessage}`);
        let data = null;

        // 解析JSON消息
        try {
            data = JSON.parse(rawMessage);
        } catch (e) {
            ws.send(JSON.stringify({
                type: 'msg',
                clientId: "",
                targetId: "",
                message: '403（非JSON格式）'
            }));
            return;
        }

        // 验证消息来源合法性
        const isLegalSource = clients.get(data.clientId) === ws || clients.get(data.targetId) === ws;
        if (!isLegalSource) {
            ws.send(JSON.stringify({
                type: 'msg',
                clientId: "",
                targetId: "",
                message: '404（非法来源）'
            }));
            return;
        }

        // 处理合法消息
        if (data.type && data.clientId && data.message && data.targetId) {
            const { clientId, targetId, message, type } = data;

            switch (type) {
                case "bind":
                    // 处理设备绑定
                    if (clients.has(clientId) && clients.has(targetId)) {
                        // 检查是否已存在绑定关系
                        const isRelExist = [...relations.entries()].some(([k, v]) =>
                            (k === clientId || k === targetId) || (v === clientId || v === targetId)
                        );

                        if (isRelExist) {
                            ws.send(JSON.stringify({
                                type: "bind",
                                clientId,
                                targetId,
                                message: "400（已绑定其他设备）"
                            }));
                            return;
                        }

                        // 建立双向绑定关系
                        relations.set(clientId, targetId);
                        relations.set(targetId, clientId);

                        // 通知双方绑定成功
                        const bindSuccessMsg = {
                            type: "bind",
                            clientId,
                            targetId,
                            message: "200"
                        };
                        clients.get(clientId)?.send(JSON.stringify(bindSuccessMsg));
                        clients.get(targetId)?.send(JSON.stringify(bindSuccessMsg));
                        console.log(`绑定成功：${clientId} ↔ ${targetId}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: "bind",
                            clientId,
                            targetId,
                            message: "401（目标设备不存在）"
                        }));
                    }
                    break;

                case 1:
                case 2:
                case 3:
                    // 处理强度调节指令（转发给目标设备）
                    if (relations.get(clientId) !== targetId) {
                        ws.send(JSON.stringify({
                            type: "bind",
                            clientId,
                            targetId,
                            message: "402（绑定关系失效）"
                        }));
                        return;
                    }

                    const targetClient = clients.get(targetId);
                    if (targetClient) {
                        const sendType = data.type - 1;
                        const sendChannel = data.channel || 1;
                        const sendStrength = data.type >= 3 ? data.strength : 1;
                        const forwardMsg = {
                            type: "msg",
                            clientId,
                            targetId,
                            message: `strength-${sendChannel}+${sendType}+${sendStrength}`
                        };
                        targetClient.send(JSON.stringify(forwardMsg));
                        console.log(`转发强度指令：${JSON.stringify(forwardMsg)}`);
                    }
                    break;

                case 4:
                    // 处理自定义消息（直接转发）
                    if (relations.get(clientId) !== targetId) {
                        ws.send(JSON.stringify({
                            type: "bind",
                            clientId,
                            targetId,
                            message: "402（绑定关系失效）"
                        }));
                        return;
                    }

                    const target = clients.get(targetId);
                    if (target) {
                        const forwardData = {
                            type: "msg",
                            clientId,
                            targetId,
                            message: data.message
                        };
                        target.send(JSON.stringify(forwardData));
                        console.log(`转发自定义消息：${JSON.stringify(forwardData)}`);
                    }
                    break;

                case "clientMsg":
                    // 处理波形消息（带覆盖逻辑）
                    if (relations.get(clientId) !== targetId) {
                        ws.send(JSON.stringify({
                            type: "bind",
                            clientId,
                            targetId,
                            message: "402（绑定关系失效）"
                        }));
                        return;
                    }

                    if (!data.channel) {
                        ws.send(JSON.stringify({
                            type: "error",
                            clientId,
                            targetId,
                            message: "406（必须指定通道）"
                        }));
                        return;
                    }

                    const pulseTarget = clients.get(targetId);
                    if (pulseTarget) {
                        const sendtime = data.time || punishmentDuration;
                        const totalSends = punishmentTime * sendtime;
                        const timeSpace = 1000 / punishmentTime;
                        const sendData = {
                            type: "msg",
                            clientId,
                            targetId,
                            message: "pulse-" + data.message
                        };
                        const timerKey = `${clientId}-${data.channel}`;

                        // 覆盖原有消息逻辑
                        if (clientTimers.has(timerKey)) {
                            console.log(`通道${data.channel}存在未完成消息，执行覆盖`);
                            // 清除旧定时器
                            clearInterval(clientTimers.get(timerKey));
                            clientTimers.delete(timerKey);

                            // 发送清除队列指令
                            const clearMsg = {
                                type: "msg",
                                clientId,
                                targetId,
                                message: `clear-${data.channel === 'A' ? 1 : 2}`
                            };
                            pulseTarget.send(JSON.stringify(clearMsg));

                            // 延迟发送新消息
                            setTimeout(() => {
                                delaySendMsg(clientId, ws, pulseTarget, sendData, totalSends, timeSpace, data.channel);
                            }, 150);
                        } else {
                            // 直接发送新消息
                            delaySendMsg(clientId, ws, pulseTarget, sendData, totalSends, timeSpace, data.channel);
                        }
                    } else {
                        ws.send(JSON.stringify({
                            type: "msg",
                            clientId,
                            targetId,
                            message: "404（目标设备离线）"
                        }));
                    }
                    break;

                default:
                    // 通用消息转发
                    if (relations.get(clientId) !== targetId) {
                        ws.send(JSON.stringify({
                            type: "bind",
                            clientId,
                            targetId,
                            message: "402（绑定关系失效）"
                        }));
                        return;
                    }

                    const normalTarget = clients.get(targetId);
                    if (normalTarget) {
                        normalTarget.send(JSON.stringify({ type, clientId, targetId, message }));
                    } else {
                        ws.send(JSON.stringify({
                            type: "msg",
                            clientId,
                            targetId,
                            message: "404（目标设备离线）"
                        }));
                    }
                    break;
            }
        }
    });

    // 处理连接关闭
    ws.on('close', function close() {
        console.log(`连接关闭：查找对应clientId`);
        // 查找关闭的clientId
        let closedClientId = '';
        for (const [id, client] of clients.entries()) {
            if (client === ws) {
                closedClientId = id;
                break;
            }
        }

        if (closedClientId) {
            console.log(`断开的clientId：${closedClientId}`);

            // 通知绑定的对方
            const boundTargetId = relations.get(closedClientId);
            if (boundTargetId && clients.has(boundTargetId)) {
                const boundClient = clients.get(boundTargetId);
                boundClient.send(JSON.stringify({
                    type: "break",
                    clientId: closedClientId,
                    targetId: boundTargetId,
                    message: "209（对方断开连接）"
                }));
                boundClient.close(); // 关闭对方连接
            }

            // 清理资源
            relations.delete(closedClientId);
            relations.forEach((v, k) => v === closedClientId && relations.delete(k));
            clients.delete(closedClientId);

            // 清理定时器
            clientTimers.forEach((timerId, key) => {
                if (key.startsWith(closedClientId)) {
                    clearInterval(timerId);
                    clientTimers.delete(key);
                }
            });

            console.log(`清理完成，当前在线数：${clients.size}`);
        }
    });

    // 处理连接错误
    ws.on('error', function (error) {
        console.error(`WebSocket错误：${error.message}`);
        // 查找错误的clientId
        let errorClientId = '';
        for (const [id, client] of clients.entries()) {
            if (client === ws) {
                errorClientId = id;
                break;
            }
        }

        // 通知绑定的对方
        if (errorClientId) {
            const boundTargetId = relations.get(errorClientId);
            if (boundTargetId && clients.has(boundTargetId)) {
                clients.get(boundTargetId).send(JSON.stringify({
                    type: "error",
                    clientId: errorClientId,
                    targetId: boundTargetId,
                    message: `500（对方连接异常：${error.message}）`
                }));
            }
        }
    });

    // 启动心跳（仅当无心跳定时器时）
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            if (clients.size > 0) {
                console.log(`[${new Date().toLocaleString()}] 发送心跳，在线数：${clients.size}`);
                clients.forEach((client, clientId) => {
                    heartbeatMsg.clientId = clientId;
                    heartbeatMsg.targetId = relations.get(clientId) || '';
                    client.send(JSON.stringify(heartbeatMsg));
                });
            }
        }, 60 * 1000); // 每分钟发送一次心跳
    }
});

/**
 * 延迟发送消息（带频率控制）
 * @param {string} clientId - 发送方ID
 * @param {WebSocket} client - 发送方连接
 * @param {WebSocket} target - 接收方连接
 * @param {Object} sendData - 发送的数据
 * @param {number} totalSends - 总发送次数
 * @param {number} timeSpace - 发送间隔（ms）
 * @param {string} channel - 通道（A/B）
 */
function delaySendMsg(clientId, client, target, sendData, totalSends, timeSpace, channel) {
    // 立即发送第一次
    target.send(JSON.stringify(sendData));
    totalSends--;

    if (totalSends <= 0) {
        client.send(JSON.stringify({ type: "msg", message: "发送完毕" }));
        return;
    }

    // 创建定时器发送剩余消息
    const timerId = setInterval(() => {
        if (totalSends > 0) {
            target.send(JSON.stringify(sendData));
            totalSends--;
        }

        // 发送完成清理定时器
        if (totalSends <= 0) {
            clearInterval(timerId);
            clientTimers.delete(`${clientId}-${channel}`);
            client.send(JSON.stringify({ type: "msg", message: "发送完毕" }));
        }
    }, timeSpace);

    // 存储定时器ID
    clientTimers.set(`${clientId}-${channel}`, timerId);
    console.log(`通道${channel}定时器已创建，剩余发送次数：${totalSends}`);
}

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    console.error('未捕获异常：', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝：', reason, promise);
});