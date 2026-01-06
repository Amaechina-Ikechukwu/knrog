import { IncomingMessage, ServerResponse } from "http";
import { getTunnelSocket } from "./registry";
import{ v4 }from "uuid";

type TunnelMessage =
  | { type: "request"; id: string; method?: string; url?: string; header?: any }
  | { type: "req_data"; id: string; chunk: string }
  | { type: "req_end"; id: string }
  | { type: "res_headers"; id: string; statusCode: number; header: any }
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

  //Delete id on close
 req.on("close", () => {
   responses.delete(id);

   //ADD TIMEOUT CLEANUP HERE TOO
   const timeout = timeouts.get(id);
   if (timeout) {
     clearTimeout(timeout);
     timeouts.delete(id);
   }
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
      if(!res)return;
      console.log(`msg for id: ${id}: ${JSON.stringify(msg,null,2)}`)
      res.writeHead(msg.statusCode,msg.headers)
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