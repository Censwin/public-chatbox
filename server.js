const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 80;
const SAVE_DIR = "/docker/chat";
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);

app.use(express.json());

let messages = [];
const MAX_STORED_MEMORY = 1500;

function getDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getFileByDate(dateStr) {
  return path.join(SAVE_DIR, `${dateStr}.txt`);
}

function loadDay(dateStr) {
  const file = getFileByDate(dateStr);
  if (!fs.existsSync(file)) return [];
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

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

function persistMessage(entry) {
  const today = getDateStr();
  fs.appendFileSync(getFileByDate(today), JSON.stringify(entry) + "\n", "utf8");
}

app.post("/send", (req, res) => {
  const nick = (req.body.nick || "匿名").slice(0, 32);
  const text = (req.body.text || "").slice(0, 2000);

  if (!text) return res.json({ ok: false });

  const entry = {
    id: Date.now().toString(36),
    nick,
    text,
    ts: new Date().toISOString(),
  };

  messages.push(entry);
  if (messages.length > MAX_STORED_MEMORY)
    messages = messages.slice(-MAX_STORED_MEMORY);

  persistMessage(entry);

  res.json({ ok: true });
});

app.get("/messages", (req, res) => {
  res.json(messages);
});

app.use("/", express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log("Chat server listening at port", PORT);
});
