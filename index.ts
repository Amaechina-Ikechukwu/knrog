const server = Bun.serve({
  port: 5173,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (req.method === "GET") {
      return new Response(
        `<html>
          <head><title>Knrog Test Server</title></head>
          <body>
            <h1>🎉 Knrog Tunnel Working!</h1>
            <p>Your tunnel is successfully forwarding requests.</p>
            <p>Try sending a POST request with JSON data.</p>
          </body>
        </html>`,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }
    
    if (req.method === "POST") {
      try {
        const body = await req.text();
        console.log(`Received POST request:`, body);
        
        return new Response(
          JSON.stringify({
            status: "success",
            message: "POST request received!",
            receivedData: body,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Failed to parse request" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    
    return new Response("Method not allowed", { status: 405 });
  },
});

console.log(`🚀 Bun server running on http://localhost:${server.port}`);