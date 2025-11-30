const nickEl = document.getElementById("nick");
const textEl = document.getElementById("text");
const messagesEl = document.getElementById("messages");
const sendBtn = document.getElementById("send");

const proto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(proto + "//" + location.host);

function append(msg) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `
    <div class="meta">${msg.nick} · ${new Date(msg.ts).toLocaleString()}</div>
    <div>${msg.text.replace(/\n/g, "<br>")}</div>
  `;
  messagesEl.appendChild(div);
}

ws.onmessage = (ev) => {
  try {
    const obj = JSON.parse(ev.data);
    if (obj.type === "history") {
      messagesEl.innerHTML = "";
      obj.data.forEach(append);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (obj.type === "message") {
      append(obj.data);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch {}
};

function send() {
  const text = textEl.value.trim();
  if (!text) return;

  ws.send(
    JSON.stringify({
      type: "message",
      nick: nickEl.value || "匿名",
      text,
    })
  );

  textEl.value = "";
  textEl.focus();
}

sendBtn.onclick = send;

textEl.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};
