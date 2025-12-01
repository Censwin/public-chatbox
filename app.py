import os
import json
from datetime import datetime, timedelta
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("/docker/chat", exist_ok=True)
msg_file = "/docker/chat/messages.json"

if not os.path.exists(msg_file):
    with open(msg_file, "w") as f:
        f.write("[]")
        
app = FastAPI()

PORT = 80
SAVE_DIR = "/docker/chat"
MAX_STORED_MEMORY = 1500

os.makedirs(SAVE_DIR, exist_ok=True)

messages = []


def get_date_str(dt=None):
    if dt is None:
        dt = datetime.now()
    return dt.strftime("%Y-%m-%d")


def file_for_date(date_str):
    return os.path.join(SAVE_DIR, f"{date_str}.txt")


def load_day(date_str):
    file = file_for_date(date_str)
    if not os.path.exists(file):
        return []
    try:
        lines = open(file, "r", encoding="utf-8").read().splitlines()
        return [json.loads(line) for line in lines if line.strip()]
    except:
        return []


def load_recent_3_days():
    global messages
    now = datetime.now()
    all_msgs = []
    for i in range(3):
        d = now - timedelta(days=i)
        all_msgs.extend(load_day(get_date_str(d)))

    if len(all_msgs) > MAX_STORED_MEMORY:
        all_msgs = all_msgs[-MAX_STORED_MEMORY:]

    messages = all_msgs


load_recent_3_days()


def persist_message(entry):
    today = get_date_str()
    file = file_for_date(today)
    with open(file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


@app.post("/send")
async def send_message(req: Request):
    data = await req.json()
    nick = data.get("nick", "匿名")[:32]
    text = data.get("text", "")[:2000]

    if not text.strip():
        return JSONResponse({"ok": False})

    entry = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "nick": nick,
        "text": text,
        "ts": datetime.now().isoformat()
    }

    messages.append(entry)
    if len(messages) > MAX_STORED_MEMORY:
        messages[:] = messages[-MAX_STORED_MEMORY:]

    persist_message(entry)

    return JSONResponse({"ok": True})


@app.get("/messages")
def get_messages():
    return JSONResponse(messages)


# 静态文件目录（代替 express.static）
app.mount("/", StaticFiles(directory="public", html=True), name="public")
