// DOM 元素
const nickEl = document.getElementById("nick");
const textEl = document.getElementById("text");
const messagesEl = document.getElementById("messages");
const copyToast = document.getElementById("copyToast");

// 当前昵称
let currentNickname = nickEl.value || "用户";

// WebSocket 连接
const proto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(proto + "//" + location.host);

// WebSocket 事件处理
ws.onopen = () => {
  console.log("WebSocket 连接已建立");
};

ws.onclose = () => {
  console.log("WebSocket 连接已关闭");
};

ws.onerror = (error) => {
  console.error("WebSocket 错误:", error);
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

  msgDiv.innerHTML = `
    <div class="meta">
      <span class="nickname">${escapeHtml(msg.nick)}</span>
      <span class="time">${timeStr}</span>
    </div>
    <div class="content">${formatMessage(msg.text)}</div>
    <div class="actions">
      <button class="copy-btn" data-text="${escapeHtml(msg.text)}">
        复制
      </button>
    </div>
  `;

  messagesEl.appendChild(msgDiv);

  // 添加复制功能
  const copyBtn = msgDiv.querySelector(".copy-btn");
  copyBtn.addEventListener("click", function () {
    const textToCopy = this.getAttribute("data-text");
    copyToClipboard(textToCopy, this);
  });
}

// 发送消息
function send() {
  const text = textEl.value.trim();
  if (!text) return;

  const nickname = nickEl.value.trim() || "匿名";
  currentNickname = nickname;

  ws.send(
    JSON.stringify({
      type: "message",
      nick: nickname,
      text,
    })
  );

  textEl.value = "";
  autoResizeTextarea(textEl);
  textEl.focus();
}

// 输入框按键事件
textEl.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }

  // 自动调整文本框高度
  setTimeout(() => {
    autoResizeTextarea(textEl);
  }, 0);
};

// 复制到剪贴板
function copyToClipboard(text, button) {
  const originalText = button.innerHTML;

  // 使用现代 Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showCopySuccess(button);
      })
      .catch((err) => {
        console.error("复制失败:", err);
        fallbackCopyTextToClipboard(text, button);
      });
  } else {
    // 降级方案
    fallbackCopyTextToClipboard(text, button);
  }
}

// 降级复制方案
function fallbackCopyTextToClipboard(text, button) {
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // 防止在移动端滚动
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      showCopySuccess(button);
    } else {
      console.error("复制命令执行失败");
    }
  } catch (err) {
    console.error("复制失败:", err);
  }

  document.body.removeChild(textArea);
}

// 显示复制成功状态
function showCopySuccess(button) {
  button.innerHTML = "已复制";
  button.classList.add("copied");

  // 显示全局 toast 提示
  showToast(copyToast, "已复制到剪贴板", 2000);

  // 3秒后恢复按钮状态
  setTimeout(() => {
    button.innerHTML = "复制";
    button.classList.remove("copied");
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
  // 将换行符转换为 <br>
  let formatted = escapeHtml(text).replace(/\n/g, "<br>");

  // 将 URL 转换为可点击链接
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
  const newHeight = Math.min(textarea.scrollHeight, 150); // 最大150px
  textarea.style.height = newHeight + "px";
}

// 初始化文本区域高度
autoResizeTextarea(textEl);

// 昵称输入框也支持回车键切换焦点到消息输入框
nickEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    textEl.focus();
  }
});

// 页面加载后自动聚焦到昵称输入框
window.addEventListener("load", () => {
  nickEl.focus();
});
