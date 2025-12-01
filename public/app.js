const nickEl = document.getElementById("nick");
const textEl = document.getElementById("text");
const messagesEl = document.getElementById("messages");
const sendBtn = document.getElementById("send");

function append(msg) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `
    <div class="meta">${msg.nick} · ${new Date(msg.ts).toLocaleString()}</div>
    <div>${msg.text.replace(/\n/g, "<br>")}</div>
  `;
  messagesEl.appendChild(div);
}

async function loadMessages() {
  const res = await fetch("/messages");
  const list = await res.json();

  messagesEl.innerHTML = "";
  list.forEach(append);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function send() {
  const text = textEl.value.trim();
  if (!text) return;

  await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nick: nickEl.value || "匿名",
      text,
    }),
  });

  textEl.value = "";
  textEl.focus();

  loadMessages();
}

sendBtn.onclick = send;

textEl.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};

// 页面加载时读取一次消息
loadMessages();
