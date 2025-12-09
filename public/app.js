// DOM 元素
const nickEl = document.getElementById("nick");
const textEl = document.getElementById("text");
const messagesEl = document.getElementById("messages");
const copyToast = document.getElementById("copyToast");
const sendBtn = document.getElementById("sendBtn");

// 当前昵称
let currentNickname = "";

// 生成6位随机数字昵称
function generateRandomNickname() {
  const randomNum = Math.floor(Math.random() * 900000) + 100000;
  return `${randomNum}`;
}

// 初始化昵称（优先读LocalStorage，无则生成随机并缓存）
function initNickname() {
  const savedNick = localStorage.getItem("chat_nickname");

  if (savedNick) {
    currentNickname = savedNick;
    nickEl.value = savedNick;
  } else {
    const randomNick = generateRandomNickname();
    currentNickname = randomNick;
    nickEl.value = randomNick;
    localStorage.setItem("chat_nickname", randomNick);
  }
}

// 监听昵称输入框修改：失去焦点/按回车时更新缓存
nickEl.addEventListener("blur", () => {
  const newNick = nickEl.value.trim();
  if (newNick && newNick !== currentNickname) {
    currentNickname = newNick;
    localStorage.setItem("chat_nickname", newNick);
  }
});

// WebSocket 连接
const proto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(proto + "//" + location.host);

// WebSocket 事件处理
ws.onopen = () => {
  console.log("WebSocket 连接已建立");
  sendBtn.disabled = false;
};

ws.onclose = () => {
  console.log("WebSocket 连接已关闭");
  sendBtn.disabled = true;
};

ws.onerror = (error) => {
  console.error("WebSocket 错误:", error);
  sendBtn.disabled = true;
};

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
  } catch (e) {
    console.error("解析消息失败:", e);
  }
};

// 添加消息到界面
function append(msg) {
  const isOwnMessage = msg.nick === currentNickname;
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${isOwnMessage ? "own-message" : ""}`;

  // 格式化时间
  const time = new Date(msg.ts);
  const timeStr = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 生成消息HTML
  msgDiv.innerHTML = `
    <div class="meta">
      <span class="nickname">${escapeHtml(msg.nick)}</span>
      <div class="meta-right">
        <span class="time">${timeStr}</span>
        <a class="copy-link" href="javascript:void(0)" data-text="${escapeHtml(
          msg.text
        )}" title="复制消息">
          复制
        </a>
      </div>
    </div>
    <div class="content">${formatMessage(msg.text)}</div>
  `;

  messagesEl.appendChild(msgDiv);

  // 添加复制功能
  const copyLink = msgDiv.querySelector(".copy-link");
  copyLink.addEventListener("click", function (e) {
    e.preventDefault();
    const textToCopy = this.getAttribute("data-text");
    copyToClipboard(textToCopy, this);
  });
}

// 发送消息
function send() {
  const text = textEl.value.trim();
  if (!text) return;

  const nickname = nickEl.value.trim() || generateRandomNickname();
  currentNickname = nickname;
  localStorage.setItem("chat_nickname", nickname);

  // 发送前禁用按钮防止重复发送
  sendBtn.disabled = true;
  ws.send(
    JSON.stringify({
      type: "message",
      nick: nickname,
      text,
    })
  );

  // 发送后恢复按钮
  setTimeout(() => {
    sendBtn.disabled = false;
  }, 300);

  textEl.value = "";
  autoResizeTextarea(textEl);
  textEl.focus();
}

// 输入框按键事件（仅保留Shift+Enter换行）
textEl.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
  }

  // 自动调整文本框高度
  setTimeout(() => {
    autoResizeTextarea(textEl);
  }, 0);
};

// 绑定发送按钮事件
sendBtn.addEventListener("click", send);
sendBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});

// 复制到剪贴板
function copyToClipboard(text, link) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => showCopySuccess(link))
      .catch((err) => {
        console.error("复制失败:", err);
        fallbackCopyTextToClipboard(text, link);
      });
  } else {
    fallbackCopyTextToClipboard(text, link);
  }
}

// 降级复制方案
function fallbackCopyTextToClipboard(text, link) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) showCopySuccess(link);
    else console.error("复制命令执行失败");
  } catch (err) {
    console.error("复制失败:", err);
  }

  document.body.removeChild(textArea);
}

// 显示复制成功状态
function showCopySuccess(link) {
  const originalText = link.textContent;
  link.textContent = "已复制";
  link.classList.add("copied");
  showToast(copyToast, "已复制到剪贴板", 2000);
  setTimeout(() => {
    link.textContent = originalText;
    link.classList.remove("copied");
  }, 3000);
}

// 显示 toast 提示
function showToast(toastElement, message, duration = 2000) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  setTimeout(() => {
    toastElement.classList.remove("show");
  }, duration);
}

// 工具函数
function formatMessage(text) {
  let formatted = escapeHtml(text).replace(/\n/g, "<br>");
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  formatted = formatted.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  const newHeight = Math.min(textarea.scrollHeight, 150);
  textarea.style.height = newHeight + "px";
}

// 昵称输入框回车切换焦点（并更新缓存）
nickEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const newNick = nickEl.value.trim();
    if (newNick) {
      currentNickname = newNick;
      localStorage.setItem("chat_nickname", newNick);
    }
    textEl.focus();
  }
});

// 页面初始化
window.addEventListener("load", () => {
  initNickname(); // 初始化随机昵称
  autoResizeTextarea(textEl);
  nickEl.focus();
  sendBtn.disabled = true; // 初始禁用发送按钮
});
