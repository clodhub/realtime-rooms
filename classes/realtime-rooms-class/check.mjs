import { assert, load } from './runtime.mjs';
const { Live } = await load('web/index.ts');
const sockets = [];
class Socket {
  static OPEN = 1;
  readyState = 1;
  sent = [];
  constructor(url) { this.url = url; sockets.push(this); }
  send(text) { this.sent.push(text); }
  close(code) { this.code = code; this.onclose?.(); }
}
globalThis.WebSocket = Socket;
globalThis.window = { setInterval: () => 0, setTimeout: () => 0 };
const messages = [], down = [];
const connection = new Live('https://example.org', '/room/ws', () => '{"type":"hello"}', message => messages.push(message), value => down.push(value));
connection.open();
connection.open();
assert.equal(sockets.length, 1);
const socket = sockets[0];
assert.equal(socket.url, 'wss://example.org/room/ws');
socket.onopen();
assert.deepEqual(socket.sent, ['{"type":"hello"}']);
socket.onmessage({ data: 'pong' });
socket.onmessage({ data: 'invalid' });
socket.onmessage({ data: '{"type":"view","version":3}' });
assert.deepEqual(messages, [{ type: 'view', version: 3 }]);
connection.send('move');
assert.equal(socket.sent.at(-1), 'move');
connection.close();
assert.equal(socket.code, 1000);
assert.deepEqual(down, [false]);
socket.onmessage({ data: '{"type":"view","version":4}' });
assert.equal(messages.length, 1);
