window.httpProt = 'https';
window.wsProt = 'wss';
window.host = 'blockchat-node-01.herokuapp.com';
const allMessages = {};

document.getElementById('host').value = window.host;

// change host
document.getElementById('host-btn').onclick = () => {
  const newHost = document.getElementById('host').value;
  window.host = newHost;
};

// helper functions for fetch API
function status(response) {
  if (response.status >= 200 && response.status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(new Error(response.statusText));
}

function json(response) {
  return response.json();
}

function addMessageNoListen(message, sent, txStatus = 'unc') {
  const msgEl = document.createElement('li');
  if (sent) {
    msgEl.className = 'chat-sent';
  } else {
    msgEl.className = 'chat-rec';
  }
  msgEl.textContent = message;
  // to show current status of message
  const msgStatus = document.createElement('span');
  msgStatus.className = 'chat-status';
  msgStatus.textContent = `(${txStatus})`;
  msgEl.appendChild(msgStatus);
  document.getElementById('chat').appendChild(msgEl);
  return msgStatus;
}

function addMessage(message, tag, sent, txToUpdate) {
  const tx = txToUpdate;
  tx.sent = sent;
  const msgStatus = addMessageNoListen(message, sent);
  // open websocket
  const wsParams = new URLSearchParams({ tag });
  window.tx_socket = new WebSocket(`${window.wsProt}://${window.host}/transactions/ws?${wsParams}`);
  // Listen for messages
  window.tx_socket.addEventListener('message', (wsEvent) => {
    console.log('Message from server ', wsEvent.data);
    tx.status = wsEvent.data;
    msgStatus.textContent = `(${wsEvent.data})`;
  });
}

function switchChat() {
  window.receiverKey = this.textContent;
  const chatEl = document.getElementById('chat');
  // remove messages
  while (chatEl.lastElementChild) {
    chatEl.removeChild(chatEl.lastElementChild);
  }
  // add messages from memory
  allMessages[window.receiverKey].messages.forEach((tx) => {
    addMessageNoListen(tx.message, tx.sent, tx.status);
  });
}

function addChat(receiverPubKey) {
  const newEl = document.createElement('li');
  newEl.className = 'chat-user';
  newEl.textContent = receiverPubKey;
  newEl.onclick = switchChat;
  allMessages[receiverPubKey] = { messages: [] };
  document.getElementById('chats').appendChild(newEl);
}

document.getElementById('add-chat-button').onclick = () => {
  const receiverPubKey = document.getElementById('add-chat-receiver').value;
  addChat(receiverPubKey);
};

function startMessageListener() {
  if (typeof window.chat_socket === 'object') {
    window.chat_socket.close();
    console.log('Stopped old listener');
  }
  console.log('Started listener');
  window.chat_socket = null;
  const sender = document.getElementById('public-key').value;
  const params = new URLSearchParams({ sender });
  window.chat_socket = new WebSocket(`${window.wsProt}://${window.host}/chat/ws?${params}`);
  // Listen for messages
  window.chat_socket.addEventListener('message', (event) => {
    console.log('Message from server ', event.data);
    const tx = JSON.parse(event.data);
    if (typeof allMessages[tx.sender] !== 'object') {
      addChat(tx.sender);
    }
    allMessages[tx.sender].messages.push(tx);
    if (tx.sender === window.receiverKey) {
      addMessage(tx.message, tx.tag, false, tx);
    }
    // TODO: handle other messages
  });
}

function getOldMessages() {
  const sender = document.getElementById('public-key').value;
  const params = new URLSearchParams({ user_key: sender });
  fetch(`${window.httpProt}://${window.host}/chat/messages?${params}`, {
    mode: 'cors',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(status)
    .then(json)
    .then((data) => {
      data.transactions.forEach((tx) => {
        let sent = null;
        let receiver = null;
        if (tx.sender === sender) {
          sent = true;
          receiver = tx.receiver;
        } else {
          sent = false;
          receiver = tx.sender;
        }
        const newTx = tx;
        newTx.sent = sent;
        if (typeof allMessages[receiver] !== 'object') {
          addChat(receiver);
        }
        allMessages[receiver].messages.push(newTx);
      });
    });
}

function mainCrypto(sodium) {
  document.getElementById('gen-key-btn').onclick = function generateKeys() {
    console.log('Generating keypair');
    window.keypair = sodium.crypto_sign_keypair();
    const sk = sodium.to_hex(window.keypair.privateKey);
    const pk = sodium.to_hex(window.keypair.publicKey);
    document.getElementById('secret-key').value = sk;
    document.getElementById('public-key').value = pk;
    localStorage.setItem('secretKey', sk);
    localStorage.setItem('publicKey', pk);
    startMessageListener();
    getOldMessages();
  };
  const lsk = localStorage.getItem('secretKey');
  const lpk = localStorage.getItem('publicKey');
  if (lsk != null && lpk != null) {
    document.getElementById('secret-key').value = lsk;
    document.getElementById('public-key').value = lpk;
    startMessageListener();
    getOldMessages();
  }
}

function signMessage(secretKey, sender, recipient, message) {
  console.log('Signing Message');
  const signature = window.sodium.to_hex(window.sodium.crypto_sign_detached(`<${sender} ${recipient} ${message}>`, secretKey));
  return signature;
}

function sendMessage() {
  if (typeof window.receiverKey !== 'string') {
    return false;
  }
  const recipient = window.receiverKey;
  const sk = window.sodium.from_hex(document.getElementById('secret-key').value);
  const sender = document.getElementById('public-key').value;
  const message = document.getElementById('chat-msg').value;
  const signature = signMessage(sk, sender, recipient, message);
  // construct transaction
  const tx = {
    sender,
    recipient,
    message,
    signature,
  };
  // post message
  fetch(`${window.httpProt}://${window.host}/transactions/new`, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(tx),
  })
    .then(status)
    .then(json)
    .then((data) => {
      console.log('Got data:', data);
      // add message to var
      allMessages[recipient].messages.push(tx);
      // add message to DOM
      addMessage(message, data.tag, true, tx);
    })
    .catch((error) => {
      console.log('Request failed with error:', error);
    });
  return true;
}

document.getElementById('chat-send-button').onclick = sendMessage;

window.sodium = {
  onload(sodium) {
    console.log('Sodium initialised');
    mainCrypto(sodium);
  },
};
