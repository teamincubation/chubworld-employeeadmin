module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const net = require('net');
const { Client } = require('pg');

const targetHost = 'db.mcolsszozjnveoommnuk.supabase.co';
const targetPort = 5432;
const dbPassword = 'Cw@adloaf#root$Admin';

const ip = '23.26.125.56';
const port = 40000;

function connectSocks5(proxyIp, proxyPort, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyIp);
    socket.setTimeout(5000);

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Proxy connection timeout'));
    });

    socket.on('error', (err) => {
      reject(err);
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
          resolve(socket);
        }
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });
  });
}

async function run() {
  console.log(`Connecting to proxy ${ip}:${port}...`);
  try {
    const socket = await connectSocks5(ip, port, targetHost, targetPort);
    console.log('SOCKS5 tunnel established. Attempting PG client connect...');

    const client = new Client({
      stream: socket,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('🎉 CONNECTED SUCCESSFULLY!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.log('Connection failed!');
    console.error('Error Details:', err);
  }
}

run();
