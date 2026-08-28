/**
 * Manual replay helper — sends a captured .hl7 fixture to a running
 * device-ingestion instance exactly as a real monitor would, for local/demo
 * verification. Not part of the automated test suite (that's parser.test.js).
 *
 * Run:  node test/replay.js [path-to-file.hl7] [host] [port]
 */
const net = require('net');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, 'fixtures', 'sample-real-device.hl7');
const host = process.argv[3] || 'localhost';
const port = Number(process.argv[4] || 7061);

const raw = fs.readFileSync(filePath, 'utf8');
const messages = raw.split(/(?=^MSH\|)/m).map((m) => m.trim()).filter(Boolean);
console.log(`Loaded ${messages.length} messages from ${filePath}`);

const socket = net.connect(port, host, () => {
  console.log(`Connected to ${host}:${port}, sending messages 1/sec...`);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= messages.length) {
      clearInterval(timer);
      socket.end();
      return;
    }
    socket.write(messages[i] + '\r\n');
    i += 1;
  }, 200);
});

socket.on('error', (err) => console.error('Connection error:', err.message));
socket.on('close', () => console.log('Connection closed.'));
