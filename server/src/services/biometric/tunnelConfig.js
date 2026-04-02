// Tunnel URL management for cpserver biometric API
// The cpserver registers its dynamic tunnel URL on startup.
// Tunnel URL is stored in DB (it changes per session — NOT a credential).
// Agent key comes from env var only (BIOMETRIC_AGENT_KEY).

async function getTunnelUrl(prisma) {
  // Env var override for fixed tunnel URLs
  if (process.env.BIOMETRIC_TUNNEL_URL) return process.env.BIOMETRIC_TUNNEL_URL;
  const setting = await prisma.setting.findFirst({ where: { key: 'biometric_tunnel_url' } });
  return setting?.value || null;
}

async function setTunnelUrl(prisma, url) {
  await prisma.setting.upsert({
    where: { key: 'biometric_tunnel_url' },
    update: { value: url },
    create: { key: 'biometric_tunnel_url', value: url },
  });
}

async function fetchFromTunnel(tunnelUrl, path, agentKey) {
  const url = `${tunnelUrl}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}key=${agentKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'x-agent-key': agentKey },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Tunnel returned ${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`Tunnel unreachable: ${err.message}`);
  }
}

module.exports = { getTunnelUrl, setTunnelUrl, fetchFromTunnel };
