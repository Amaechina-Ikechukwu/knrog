import { IncomingMessage } from "http";

// Suspicious paths that indicate vulnerability scanning or attacks
const BLOCKED_PATHS = [
  '/.env',
  '/.git/',
  '/.vscode/',
  '/.DS_Store',
  '/config.json',
  '/swagger',
  '/actuator/',
  '/actutor/',
  '/graphql',
  '/api/graphql',
  '/.well-known/security.txt',
  '/telescope/',
  '/debug/',
  '/wp-content/',
  '/wp-admin/',
  '/?rest_route=',
  '/ecp/',
  '/v2/_catalog',
  '/v2/api-docs',
  '/v3/api-docs',
  '/webjars/',
  '/@vite/env',
  '/META-INF/',
  '/server-status',
  '/info.php',
  '/phpinfo.php',
  '.action',
  '/api-docs/',
];

// Suspicious query patterns
const BLOCKED_QUERY_PATTERNS = [
  'rest_route',
  'panel=config',
];

// Suspicious user agents
const BLOCKED_USER_AGENTS = [
  'zgrab',
  'masscan',
  'nmap',
  'nikto',
  'sqlmap',
  'acunetix',
  'nessus',
  'openvas',
  'metasploit',
];

export function isBlockedRequest(req: IncomingMessage): boolean {
  const path = req.url || '/';
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();

  // Block suspicious paths
  for (const blockedPath of BLOCKED_PATHS) {
    if (path.toLowerCase().includes(blockedPath.toLowerCase())) {
      console.log(`[Security] Blocked suspicious path: ${path}`);
      return true;
    }
  }

  // Block suspicious query parameters
  for (const pattern of BLOCKED_QUERY_PATTERNS) {
    if (path.toLowerCase().includes(pattern.toLowerCase())) {
      console.log(`[Security] Blocked suspicious query: ${path}`);
      return true;
    }
  }

  // Block known scanning tools
  for (const agent of BLOCKED_USER_AGENTS) {
    if (userAgent.includes(agent)) {
      console.log(`[Security] Blocked suspicious user agent: ${userAgent}`);
      return true;
    }
  }

  return false;
}

// Track suspicious IPs for rate limiting
const suspiciousIPs = new Map<string, { count: number; firstSeen: number }>();
const SUSPICIOUS_THRESHOLD = 10; // Block after 10 suspicious requests
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

export function trackSuspiciousIP(ip: string): boolean {
  const now = Date.now();
  const record = suspiciousIPs.get(ip);

  if (record) {
    record.count++;
    if (record.count >= SUSPICIOUS_THRESHOLD) {
      console.log(`[Security] IP ${ip} exceeded suspicious request threshold`);
      return true; // Block
    }
  } else {
    suspiciousIPs.set(ip, { count: 1, firstSeen: now });
  }

  return false;
}

// Cleanup old records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of suspiciousIPs.entries()) {
    if (now - record.firstSeen > CLEANUP_INTERVAL) {
      suspiciousIPs.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

export function getClientIP(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
