/* Optional, local-only certification fixture. Not a translation service. */
'use strict';
const http = require('node:http');

const fixture = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QudadFlow Translator local review fixture</title></head><body><main><h1>Hello world</h1><p>Good morning. Read more.</p><p>This is a local simulated API demonstration. Only the sample phrases have fixed Chinese translations; other text is echoed.</p></main></body></html>';
const translate = text => text.replace(/Hello world/g, '你好，世界').replace(/Good morning/g, '早上好').replace(/Read more/g, '了解更多');
const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return response.end(fixture);
  }
  const json = (status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(value));
  };
  if (request.method !== 'POST' || request.url !== '/translate') return json(404, { error: 'Not found' });
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) return json(413, { error: 'Request too large' });
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body.text !== 'string') return json(400, { error: 'Expected a text string' });
    json(200, { data: { translation: translate(body.text) }, demo: true });
  } catch {
    if (!response.headersSent) json(400, { error: 'Invalid JSON request' });
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(8765, '127.0.0.1', () => {
  console.log('Local simulated API only; no keys, external requests, or request logging.');
  console.log('Fixture: http://127.0.0.1:8765/');
  console.log('Endpoint: http://127.0.0.1:8765/translate (POST). Stop with Ctrl+C.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
