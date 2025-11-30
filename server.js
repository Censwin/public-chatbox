const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 80;

const SAVE_DIR = "/docker/chat";
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let messages = [];
const MAX_STORED_MEMORY = 1500;

// 获取日期字符串 yyyy-mm-dd
function getDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// 获取当天文件路径
function getFileByDate(dateStr) {
  return path.join(SAVE_DIR, `${dateStr}.txt`);
}

// 读取一天消息
function loadDay(dateStr) {
  const file = getFileByDate(dateStr);
  if (!fs.existsSync(file)) return [];

  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 读取最近三天消息
function loadRecent3Days() {
  const now = new Date();
  let all = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    all = all.concat(loadDay(getDateStr(d)));
  }

  if (all.length > MAX_STORED_MEMORY) all = all.slice(-MAX_STORED_MEMORY);

  messages = all;
}

loadRecent3Days();

// 写入当天文件
function persistMessage(entry) {
  const today = getDateStr();
  const file = getFileByDate(today);
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
}

// 静态文件
app.use("/", express.static(path.join(__dirname, "public")));

// 广播
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(raw);
  });
}

// 连接
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "history", data: messages }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type !== "message") return;

    const entry = {
      id: Date.now().toString(36) + Math.floor(Math.random() * 1000),
      nick: msg.nick.slice(0, 32) || "匿名",
      text: msg.text.slice(0, 2000),
      ts: new Date().toISOString(),
    };

    messages.push(entry);
    if (messages.length > MAX_STORED_MEMORY)
      messages = messages.slice(-MAX_STORED_MEMORY);

    persistMessage(entry);
    broadcast({ type: "message", data: entry });
  });
});

server.listen(PORT, () => {
  console.log(`Chat server listening at port ${PORT}`);
});
