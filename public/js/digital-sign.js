function mainCrypto(sodium) {
  document.getElementById('gen-key-btn').onclick = function generateKeys() {
    console.log('Generating keypair');
    window.keypair = sodium.crypto_sign_keypair();
    const sk = sodium.to_hex(window.keypair.privateKey);
    const pk = sodium.to_hex(window.keypair.publicKey);
    document.getElementById('secret-key').value = sk;
    document.getElementById('public-key').value = pk;
  };
  document.getElementById('sign-msg').onclick = function signMessage() {
    console.log('Signing Message');
    if (typeof window.keypair !== 'object') {
      console.log('Keys not generated');
      return;
    }
    const msg = document.getElementById('message').value;
    let sign = sodium.crypto_sign_detached(msg, window.keypair.privateKey);
    sign = sodium.to_hex(sign);
    document.getElementById('sign').value = sign;
  };
  document.getElementById('verify-btn').onclick = function verifyMessage() {
    console.log('Verifying message');
    let pk = document.getElementById('public-key').value;
    pk = sodium.from_hex(pk);
    let sign = document.getElementById('sign').value;
    sign = sodium.from_hex(sign);
    const msg = document.getElementById('message').value;
    const ret = sodium.crypto_sign_verify_detached(sign, msg, pk);
    if (ret) {
      window.alert('Signatre is correct');
    } else {
      window.alert('Signature is WRONG');
    }
  };
}

window.sodium = {
  onload(sodium) {
    console.log('Sodium initialised');
    mainCrypto(sodium);
  },
};
