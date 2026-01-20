// Simple test server to expose via Knrog
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>My Test App</title></head>
      <body>
        <h1>🎉 Hello from my local app!</h1>
        <p>This is running on my computer but accessible via Knrog tunnel</p>
        <p>Request: ${req.method} ${req.url}</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});

server.listen(3000, () => {
  console.log('Test app running on http://localhost:3000');
  console.log('Now run: bun run cli 3000');
});
