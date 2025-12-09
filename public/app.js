// 确保DOM完全加载后执行
document.addEventListener("DOMContentLoaded", () => {
  // DOM 元素
  const nickEl = document.getElementById("nick");
  const textEl = document.getElementById("text");
  const messagesEl = document.getElementById("messages");
  const copyToast = document.getElementById("copyToast");
  const sendBtn = document.getElementById("sendBtn");

  // 防呆：检查元素是否存在
  if (!nickEl || !textEl || !messagesEl || !copyToast || !sendBtn) {
    console.error("核心DOM元素缺失！");
    return;
  }

  // 当前昵称
  let currentNickname = "";
  // WebSocket 实例
  let ws = null;

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

  // 初始化WebSocket连接
  function initWebSocket() {
    // 先关闭旧连接（如果有）
    if (ws) {
      ws.close();
    }

    // 重新创建连接
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(proto + "//" + location.host);

    // WebSocket 事件处理
    ws.onopen = () => {
      console.log("WebSocket 连接已建立");
      // 立即启用发送按钮
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    };

    ws.onclose = (e) => {
      console.log("WebSocket 连接已关闭", e);
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.8";
      // 断线重连（3秒后重试）
      setTimeout(() => initWebSocket(), 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket 错误:", error);
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.8";
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
  }

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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast(copyToast, "连接已断开，正在重连...", 2000);
      initWebSocket(); // 重连
      return;
    }

    const nickname = nickEl.value.trim() || generateRandomNickname();
    currentNickname = nickname;
    localStorage.setItem("chat_nickname", nickname);

    // 发送消息（临时禁用按钮）
    sendBtn.disabled = true;
    try {
      ws.send(
        JSON.stringify({
          type: "message",
          nick: nickname,
          text,
        })
      );
      // 清空输入框
      textEl.value = "";
      autoResizeTextarea(textEl);
      textEl.focus();
    } catch (e) {
      console.error("发送消息失败:", e);
      showToast(copyToast, "发送失败，请重试", 2000);
    } finally {
      // 无论成功失败，恢复按钮
      sendBtn.disabled = false;
    }
  }

  // 输入框按键事件（仅保留Shift+Enter换行）
  textEl.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // 阻止默认换行
    }
    // 自动调整文本框高度
    setTimeout(() => autoResizeTextarea(textEl), 0);
  };

  // 绑定发送按钮事件（防重复点击）
  let isSending = false;
  sendBtn.addEventListener("click", () => {
    if (isSending) return;
    isSending = true;
    send();
    setTimeout(() => (isSending = false), 500); // 500ms防重复
  });

  // 发送按钮支持回车触发
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

  // 工具函数：格式化消息（换行+链接）
  function formatMessage(text) {
    let formatted = escapeHtml(text).replace(/\n/g, "<br>");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    return formatted;
  }

  // 工具函数：转义HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // 工具函数：自动调整文本框高度
  function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + "px";
  }

  // 昵称输入框回车切换焦点
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

  // 初始化流程（按顺序执行）
  initNickname(); // 初始化随机昵称
  autoResizeTextarea(textEl); // 调整输入框高度
  initWebSocket(); // 初始化WebSocket
  nickEl.focus(); // 聚焦昵称框
  // 初始禁用发送按钮
  sendBtn.disabled = true;
  sendBtn.style.opacity = "0.8";
});
