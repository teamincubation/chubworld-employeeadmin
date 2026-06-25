module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const net = require('net');
const { Client } = require('pg');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const targetHost = 'db.mcolsszozjnveoommnuk.supabase.co';
const targetPort = 5432;
const dbPassword = 'Cw@adloaf#root$Admin';

async function fetchProxies() {
  try {
    console.log('Fetching SOCKS5 proxy list...');
    const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=3000&country=all&ssl=all&anonymity=all');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const proxies = text.split('\r\n').map(p => p.trim()).filter(p => p.length > 0);
    console.log(`Found ${proxies.length} proxies.`);
    return proxies;
  } catch (err) {
    console.error('Failed to fetch proxies:', err.message);
    return [];
  }
}

function connectSocks5(proxyIp, proxyPort, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyIp);
    socket.setTimeout(3000);

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
      // 1. Send greeting (SOCKS5, 1 auth method: No Auth)
      socket.write(Buffer.from([0x05, 0x01, 0x00]));
    });

    let state = 0; // 0: waiting for greeting response, 1: waiting for connect response
    socket.on('data', (data) => {
      try {
        if (state === 0) {
          if (data.length < 2 || data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy();
            return reject(new Error('SOCKS5 auth negotiation failed'));
          }
          
          // 2. Send CONNECT request
          const hostBuf = Buffer.from(targetHost);
          const reqBuf = Buffer.alloc(4 + 1 + hostBuf.length + 2);
          reqBuf[0] = 0x05; // Version 5
          reqBuf[1] = 0x01; // Command: Connect
          reqBuf[2] = 0x00; // Reserved
          reqBuf[3] = 0x03; // Address type: Domain Name
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
          
          // Connection established!
          // Remove listeners so the pg client can use the socket
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

async function run() {
  const proxies = await fetchProxies();
  if (proxies.length === 0) return;

  // Let's test the first 350 proxies
  for (let i = 0; i < Math.min(proxies.length, 350); i++) {
    const parts = proxies[i].split(':');
    const ip = parts[0];
    const port = parseInt(parts[1], 10);
    console.log(`[${i+1}/${Math.min(proxies.length, 350)}] Testing SOCKS5 proxy: ${ip}:${port}...`);

    let socksSocket;
    try {
      socksSocket = await connectSocks5(ip, port, targetHost, targetPort);
      console.log('  SOCKS5 tunnel established. Testing database query...');

      // Mock connect so pg client doesn't try to reconnect/DNS lookup on the already-open SOCKS5 stream
      socksSocket.connect = function(...args) {
        const cb = args.find(a => typeof a === 'function');
        if (cb) {
          process.nextTick(cb);
        }
        return this;
      };

      const client = new Client({
        stream: socksSocket,
        database: 'postgres',
        user: 'postgres',
        password: dbPassword,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 4000
      });

      await client.connect();
      console.log('  🎉 SUCCESS! Connected to PG via SOCKS5 proxy!');
      
      console.log('  Executing ALTER TABLE SQL updates...');
      await client.query('ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_type_check;');
      await client.query(`ALTER TABLE employees ADD CONSTRAINT employees_employment_type_check CHECK (employment_type IN ('Full-time', 'Part-time', 'Intern', 'Consultant', 'Contract', 'Probation', 'Remote (WFH)'));`);
      console.log('  🎉 ALTER TABLE queries executed successfully!');
      
      const res = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE conname = 'employees_employment_type_check';
      `);
      console.log('  Constraint Definition:', res.rows);
      
      await client.end();
      return;
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
      if (socksSocket) socksSocket.destroy();
    }
  }
  console.log('All tested SOCKS5 proxies failed.');
}

run();
