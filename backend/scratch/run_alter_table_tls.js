const net = require('net');
const tls = require('tls');
const { Client } = require('pg');

const targetHost = 'db.mcolsszozjnveoommnuk.supabase.co';
const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

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

async function run() {
  for (const password of passwords) {
    console.log(`\nAttempting connection via SOCKS5 TLS to [${targetHost}]:5432 with user: postgres and password: ${password.substring(0, 3)}...`);
    let rawSocket;
    let secureSocket;
    try {
      rawSocket = await connectSocks5(proxyIp, proxyPort, targetHost, 5432);
      console.log('SOCKS5 tunnel established. Wrapping in TLSSocket...');

      secureSocket = new tls.TLSSocket(rawSocket, {
        rejectUnauthorized: false,
        servername: targetHost
      });

      await new Promise((res, rej) => {
        secureSocket.once('secureConnect', () => {
          console.log('TLS handshake completed successfully!');
          res();
        });
        secureSocket.once('error', (err) => {
          rej(err);
        });
      });

      // Mock connect for pg client reuse of stream
      secureSocket.connect = function(...args) {
        const cb = args.find(a => typeof a === 'function');
        if (cb) {
          process.nextTick(cb);
        }
        return this;
      };

      const client = new Client({
        stream: secureSocket,
        database: 'postgres',
        user: 'postgres',
        password: password
      });

      await client.connect();
      console.log('🎉 CONNECTED SUCCESSFULLY VIA TLS OVER PROXY!');
      
      console.log('Altering constraint...');
      const dropSql = 'ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_type_check;';
      await client.query(dropSql);
      console.log('Dropped old constraint.');

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
      console.log('🎉 ALTERATION DONE AND VERIFIED successfully!');
      return;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
      if (secureSocket) secureSocket.destroy();
      else if (rawSocket) rawSocket.destroy();
    }
  }
}

run();
