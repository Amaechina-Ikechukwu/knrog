import { IncomingMessage, ServerResponse } from "http";
import { getTunnelSocket } from "./registry";

export const handleIncomingRequest = (
  req: IncomingMessage,
  res: ServerResponse
) => {
  const host = req.headers.host || "";
  // Extract 'meat' from 'meat.relife.com'
  const subdomain = host.split(".")[0]||"";

  const socket = getTunnelSocket(subdomain);

  if (!socket) {
    res.writeHead(404);
    return res.end(`Relife Error: No tunnel found for ${subdomain}`);
  }

  // Send the request details to the CLI client via WebSocket
  socket.send(
    JSON.stringify({
      type: "request",
      method: req.method,
      url: req.url,
      headers: req.headers,
      status:req.statusCode,
      statusMessage:req.statusMessage
    })
  );

  // Industry Tip: For a full version, you would use a 'Response Map'
  // to hold the 'res' object until the client sends back the body.
  res.write(`Request forwarded to ${subdomain}...`);
  res.end();
};
