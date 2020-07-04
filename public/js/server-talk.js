function status(response) {
  if (response.status >= 200 && response.status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(new Error(response.statusText));
}

function json(response) {
  return response.json();
}

const host = '127.0.0.1:8000';
const nodeUrl = `http://${host}`;
const wsUrl = `ws://${host}`;

fetch(`${nodeUrl}/chain`, { mode: 'cors' })
  .then(status)
  .then(json)
  .then((data) => {
    console.log('Got data:', data);
  })
  .catch((error) => {
    console.log('Request failed with error:', error);
  });

window.tx_socket = null;

document.getElementById('new-tx').onclick = function sendTransaction() {
  // show spinner
  const loader = document.getElementById('loader');
  loader.style.display = 'block';
  // get values
  const recipient = document.getElementById('receiver').value;
  const sender = document.getElementById('public-key').value;
  const message = document.getElementById('message').value;
  // sign transaction
  const sk = window.sodium.from_hex(document.getElementById('secret-key').value);
  const signature = window.sodium.to_hex(window.sodium.crypto_sign_detached(`<${sender} ${recipient} ${message}>`, sk));
  document.getElementById('signed-tx').value = signature;
  // make transaction
  const tx = {
    sender,
    recipient,
    message,
    signature,
  };
  // send transaction
  fetch(`${nodeUrl}/transactions/new`, {
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
      document.getElementById('etag').value = data.tag;
      loader.style.borderColor = 'green';
      loader.style.animation = 'none';
      loader.style.webkitAnimation = 'none';
      // open websocket
      const params = new URLSearchParams({ tag: data.tag });
      window.tx_socket = new WebSocket(`${wsUrl}/transactions/ws?${params}`);
      // Listen for messages
      window.tx_socket.addEventListener('message', (event) => {
        console.log('Message from server ', event.data);
        document.getElementById('ws-tx-message').value = event.data;
      });
    })
    .catch((error) => {
      console.log('Request failed with error:', error);
      loader.style.borderColor = 'red';
      loader.style.animation = 'none';
      loader.style.webkitAnimation = 'none';
    });
};

document.getElementById('tx-unconfirmed-btn').onclick = function unconfirmedTransaction() {
  const tag = document.getElementById('etag').value;
  const params = new URLSearchParams({
    tag,
  });
  fetch(`${nodeUrl}/transactions/is_unconfirmed?${params}`, {
    method: 'GET',
    mode: 'cors',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(status)
    .then(json)
    .then((data) => {
      console.log('Got data', data);
      document.getElementById('tx-unconfirmed').value = data.unconfirmed;
    });
};

document.getElementById('tx-confirmed-btn').onclick = function confirmedTransaction() {
  const tag = document.getElementById('etag').value;
  const params = new URLSearchParams({
    tag,
  });
  fetch(`${nodeUrl}/transactions/is_confirmed?${params}`, {
    method: 'GET',
    mode: 'cors',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(status)
    .then(json)
    .then((data) => {
      console.log('Got data', data);
      document.getElementById('tx-confirmed').value = data.confirmed;
    });
};

window.chat_socket = null;
document.getElementById('ws-chat-button').onclick = function monitorChat() {
  const sender = document.getElementById('ws-chat-sender').value;
  const params = new URLSearchParams({ sender });
  const chatList = document.getElementById('ws-chat-list');
  window.chat_socket = new WebSocket(`${wsUrl}/chat/ws?${params}`);
  // Listen for messages
  window.chat_socket.addEventListener('message', (event) => {
    console.log('Message from server ', event.data);
    const newMsg = document.createElement('li');
    newMsg.textContent = event.data;
    chatList.appendChild(newMsg);
  });
};
