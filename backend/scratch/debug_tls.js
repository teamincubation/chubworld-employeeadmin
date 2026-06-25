const net = require('net');
const tls = require('tls');

const targetHost = 'db.mcolsszozjnveoommnuk.supabase.co';
const proxyIp = '23.26.125.56';
const proxyPort = 40000;

function connectSocks5(proxyIp, proxyPort, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyIp);
    socket.setTimeout(6000);

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Proxy connection timeout'));
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.on('close', () => {
      reject(new Error('Socket closed before SOCKS5 connection established'));
    });

    socket.on('connect', () => {
      socket.write(Buffer.from([0x05, 0x01, 0x00]));
    });

    let state = 0;
    socket.on('data', (data) => {
      try {
        if (state === 0) {
          if (data.length < 2 || data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy();
            return reject(new Error('SOCKS5 auth negotiation failed'));
          }
          
          const hostBuf = Buffer.from(targetHost);
          const reqBuf = Buffer.alloc(4 + 1 + hostBuf.length + 2);
          reqBuf[0] = 0x05;
          reqBuf[1] = 0x01;
          reqBuf[2] = 0x00;
          reqBuf[3] = 0x03;
          reqBuf[4] = hostBuf.length;
          hostBuf.copy(reqBuf, 5);
          reqBuf.writeUInt16BE(targetPort, 5 + hostBuf.length);

          state = 1;
          socket.write(reqBuf);
        } else if (state === 1) {
          if (data.length < 4 || data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy();
            return reject(new Error(`SOCKS5 connection failed with status code ${data[1]}`));
          }
          
          socket.removeAllListeners('data');
          socket.removeAllListeners('error');
          socket.removeAllListeners('timeout');
          socket.removeAllListeners('close');
          socket.on('error', () => {});
          resolve(socket);
        }
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });
  });
}

async function debugTls() {
  console.log('Establishing SOCKS5 tunnel...');
  let rawSocket;
  try {
    rawSocket = await connectSocks5(proxyIp, proxyPort, targetHost, 5432);
    console.log('Tunnel established.');
    
    // We send Postgres SSLRequest first
    // Length: 8 bytes, Code: 1234.5679 (0x04d2 0x162f) -> [0, 0, 0, 8, 4, 210, 22, 47]
    console.log('Sending PostgreSQL SSLRequest...');
    rawSocket.write(Buffer.from([0x00, 0x00, 0x00, 0x08, 0x04, 0xd2, 0x16, 0x2f]));
    
    rawSocket.once('data', (data) => {
      console.log('Postgres response to SSLRequest:', data.toString(), data);
      if (data[0] === 0x53) { // 'S' -> SSL supported
        console.log('SSL supported by DB. Wrapping in TLSSocket...');
        const secureSocket = new tls.TLSSocket(rawSocket, {
          rejectUnauthorized: false,
          servername: targetHost
        });
        
        secureSocket.on('secureConnect', () => {
          console.log('🎉 TLS secureConnect success!');
          secureSocket.destroy();
        });
        secureSocket.on('error', (err) => {
          console.error('TLS Error:', err);
        });
      } else {
        console.log('SSL NOT supported or other response.');
        rawSocket.destroy();
      }
    });
  } catch (err) {
    console.error('Failed:', err);
  }
}

debugTls();
