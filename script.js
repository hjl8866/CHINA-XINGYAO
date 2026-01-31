const chatOutput = document.getElementById('chat-output');
const inputBox = document.getElementById('input-box');
const sendBtn = document.getElementById('send-btn');

sendBtn.addEventListener('click', () => {
  const userMessage = inputBox.value;
  if (userMessage.trim()!== '') {
    // 防止SQL注入过滤特殊字符
    const safeInput = preventSQLInjection(userMessage); 
    const sanitizedMessage = sanitizeInput(safeInput); 
    displayMessage('user', sanitizedMessage);
    const aiReply = getAIMessage(sanitizedMessage); 
    displayMessage('ai', aiReply);
    inputBox.value = '';
  }
});

function displayMessage(sender, message) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add(sender);
  messageDiv.textContent = `${sender === 'user'? '你：' : '机器人：'}${message}`;
  chatOutput.appendChild(messageDiv);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function getAIMessage(userMessage) {
  if (userMessage.toLowerCase().includes('你好')) {
    return '无法连接到服务器，请稍后再试。';
  }
  return '无法连接到服务器，请稍后再试。';
}

// 防止XSS攻击对输出也进行安全处理
function sanitizeOutput(output) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = output;
  return tempDiv.textContent;
}

// 当从 API 获取回复后，调用此函数处理再显示
function displaySafeAIMessage(sender, message) {
  const safeMessage = sanitizeOutput(message);
  displayMessage(sender, safeMessage);
}

// 防止SQL注入函数
function preventSQLInjection(input) {
  const sqlKeywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE"];
  const lowerCaseInput = input.toLowerCase();
  for (const keyword of sqlKeywords) {
    if (lowerCaseInput.includes(keyword)) {
      return input.replace(keyword, '');
    }
  }
  return input;
}