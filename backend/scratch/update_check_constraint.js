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

async function run() {
  console.log(`Connecting to proxy ${ip}:${port}...`);
  try {
    const socket = await connectSocks5(ip, port, targetHost, targetPort);
    console.log('SOCKS5 tunnel established. Attempting PG client connect...');

    // Mock connect so pg client doesn't try to reconnect/DNS lookup on the already-open SOCKS5 stream
    socket.connect = function(...args) {
      const cb = args.find(a => typeof a === 'function');
      if (cb) {
        process.nextTick(cb);
      }
      return this;
    };

    const client = new Client({
      stream: socket,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('🎉 CONNECTED SUCCESSFULLY!');
    
    console.log('Altering constraint...');
    const dropSql = 'ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_type_check;';
    await client.query(dropSql);
    console.log('Dropped old constraint if existed.');

    const addSql = `ALTER TABLE employees ADD CONSTRAINT employees_employment_type_check CHECK (employment_type IN ('Full-time', 'Part-time', 'Intern', 'Consultant', 'Contract', 'Probation', 'Remote (WFH)'));`;
    await client.query(addSql);
    console.log('Added new constraint.');

    const checkSql = `
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE conname = 'employees_employment_type_check';
    `;
    const res = await client.query(checkSql);
    console.log('Constraint Definition in DB:', res.rows);

    await client.end();
  } catch (err) {
    console.log('Connection failed!');
    console.error('Error Details:', err);
  }
}

run();
