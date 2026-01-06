import { IncomingMessage, ServerResponse } from "http";
import { getTunnelSocket } from "./registry";
import{ v4 }from "uuid";

type TunnelMessage =
  | { type: "request"; id: string; method?: string; url?: string; headers?: any }
  | { type: "req_data"; id: string; chunk: string }
  | { type: "req_end"; id: string }
  | { type: "res_headers"; id: string; statusCode: number; headers: any }
  | { type: "res_data"; id: string; chunk: string }
  | { type: "res_end"; id: string }
  | { type: "error"; id: string; message: string };

const responses = new Map<string,ServerResponse>();
const timeouts = new Map<string, NodeJS.Timeout>(); 

export const handleIncomingRequest = (
  req: IncomingMessage,
  res: ServerResponse
) => {
  const host = req.headers.host || "";
  // Extract 'meat' from 'meat.knrog.com'
  const subdomain = host.split(".")[0] || "";
  console.log(`[Gateway] Incoming ${req.method} ${req.url} for subdomain: ${subdomain}`);

  const socket = getTunnelSocket(subdomain);

  if (!socket) {
    res.writeHead(404);
    return res.end(`Knrog Error: No tunnel found for ${subdomain}`);
  }
  const id = v4();
  //set id
  responses.set(id, res);
  const timeout = setTimeout(() => {
    if (responses.has(id)) {
      res.writeHead(504);
      res.end("Gateway Timeout: Local tunnel took too long to respond.");
      responses.delete(id);
      timeouts.delete(id); //  CLEAN UP
    }
  }, 30000);

  timeouts.set(id, timeout); // STORE IT

  // Send the request details to the CLI client via WebSocket
  console.log(`[Gateway] Forwarding request ${id} to tunnel`);
  socket.send(
    JSON.stringify({
      type: "request",
      method: req.method,
      id,
      url: req.url,
      headers: req.headers,
    })
  );

  req.on("data", (chunk) => {
    socket.send(
      JSON.stringify({ type: "req_data", id, chunk: chunk.toString("base64") })
    );
  });

  req.on("end", () => {
    socket.send(JSON.stringify({ type: "req_end", id }));
  });
};



export const handleTunnelMessage= (raw:string)=>{
  let msg:TunnelMessage;
  try{
    msg=JSON.parse(raw);
  }catch(err){
    console.warn("Malformed tunnel message")
    return
  }
  const id = (msg as any).id;
  const res = responses.get(id);
  switch(msg.type){
    case "res_headers":{
      if(!res){
        console.log(`[Gateway] WARNING: No response object for id ${id}`);
        return;
      }
      console.log(`[Gateway] Received res_headers for ${id}, status: ${(msg as any).statusCode}`);
      try {
        // Be defensive: if the client somehow sends an invalid statusCode/headers,
        // don't crash the gateway request.
        const statusCode = (msg as any).statusCode ?? 200;
        const headers = (msg as any).headers ?? {};
        res.writeHead(statusCode, headers)
      } catch (err) {
        res.writeHead(502);
        res.end("Bad Gateway: Invalid upstream response headers")
        responses.delete(id)
        const timeout = timeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          timeouts.delete(id);
        }
      }
      break;
    }
    case"res_data":{
      if(!res)return;
      const buf = Buffer.from(msg.chunk,"base64")
      res.write(buf)
      break;
    }
    case "res_end":{
      if(!res) return;
      res.end();
      responses.delete(id);
      
      const timeout = timeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(id);
      }
      break;
    }
    case 'error':{
      if(res){
        res.writeHead(502);
        res.end("Upstream error: "+msg.message)
        responses.delete(id)
        
        const timeout = timeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          timeouts.delete(id);
        }
      }
      break;
    }
    default:{
      break;
    }
  }
}