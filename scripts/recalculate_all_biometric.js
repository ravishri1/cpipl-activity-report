/**
 * Batch recalculate attendance from biometric punches for ALL months
 * Copy to CPSERVER and run: node recalculate_all_biometric.js
 *
 * Calls POST https://eod.colorpapers.in/api/biometric/recalculate-all
 * for each month from 2023-04 to 2026-04 using the agent key.
 */

const https = require('https');

const AGENT_KEY = 'cpipl-bio-sync-2026-xK9mP4qR7v2';
const EOD_HOST = 'eod.colorpapers.in';

// Generate all months from 2023-04 to 2026-04
function getMonths() {
  const months = [];
  let year = 2023, mon = 4;
  while (year < 2026 || (year === 2026 && mon <= 4)) {
    months.push(`${year}-${String(mon).padStart(2, '0')}`);
    mon++;
    if (mon > 12) { mon = 1; year++; }
  }
  return months;
}

function postRecalculate(month) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ month, agentKey: AGENT_KEY });
    const options = {
      hostname: EOD_HOST,
      port: 443,
      path: '/api/biometric/recalculate-all',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-agent-key': AGENT_KEY,
      },
      timeout: 120000, // 2 min timeout per month
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const months = getMonths();
  console.log(`Processing ${months.length} months from ${months[0]} to ${months[months.length - 1]}\n`);

  let totalEmployeeDays = 0;

  for (const month of months) {
    process.stdout.write(`[${month}] Recalculating... `);
    try {
      const result = await postRecalculate(month);
      if (result.status === 200) {
        const { totalRecalculated, days } = result.body;
        totalEmployeeDays += totalRecalculated || 0;
        console.log(`OK  ${totalRecalculated} employee-days across ${days} days`);
      } else {
        console.log(`FAIL HTTP ${result.status}: ${JSON.stringify(result.body)}`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      await sleep(5000);
    }

    // Small delay between months to avoid overwhelming the server
    await sleep(2000);
  }

  console.log(`\nDone. Total employee-days recalculated: ${totalEmployeeDays}`);
}

main().catch(console.error);
