// Tunnel URL management for cpserver biometric API
// The cpserver registers its tunnel URL with us on startup
// We store it in Settings and use it to proxy queries

async function getTunnelUrl(prisma) {
  const setting = await prisma.setting.findFirst({ where: { key: 'biometric_tunnel_url' } });
  return setting?.value || null;
}

async function setTunnelUrl(prisma, url) {
  await prisma.setting.upsert({
    where: { key: 'biometric_tunnel_url' },
    update: { value: url, updatedAt: new Date() },
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
