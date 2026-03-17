const http = require('http');

// Test different API paths to find the correct one
const BASE_URL = 'http://192.168.2.222:85';
const API_PATHS = [
  '/IClock/WebService.asmx',
  '/iclocdock/WebService.asmx',
  '/iclock/WebService.asmx',
  '/webservice.asmx',
  '/Service.asmx',
];

// Device credentials from DB
const CREDS = {
  apiUser: 'essl',
  apiPassword: 'Essl@123',  // From .env.example — user should confirm
  apiKey: '11',
  companyCode: 'CP',
  serial: 'CEXJ230260034',  // CP OUT device
};

function buildSoap(creds) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 1);
  const fmtDate = (d) => {
    const [y, m, day] = d.toISOString().slice(0, 10).split('-');
    return `${m}/${day}/${y}`;
  };
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <UserName>${creds.apiUser}</UserName>
      <UserPassword>${creds.apiPassword}</UserPassword>
      <APIKey>${creds.apiKey}</APIKey>
      <CompanyCode>${creds.companyCode}</CompanyCode>
      <CompanySName>${creds.companyCode}</CompanySName>
      <SerialNumber>${creds.serial}</SerialNumber>
      <FromDate>${fmtDate(from)}</FromDate>
      <ToDate>${fmtDate(now)}</ToDate>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;
}

function httpRequest(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/GetTransactionsLog"',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Timeout')));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Debugging eSSL SOAP API ===\n');

  // First, check what pages exist on the server
  console.log('1. Checking base URL...');
  try {
    const base = await httpRequest(BASE_URL + '/', '');
    console.log(`   Base URL: HTTP ${base.status}`);
  } catch (e) {
    console.log(`   Base URL error: ${e.message}`);
  }

  // Try each API path
  const soapBody = buildSoap(CREDS);
  console.log(`\n2. Testing API paths with device ${CREDS.serial}...\n`);

  for (const path of API_PATHS) {
    const url = BASE_URL + path;
    try {
      const res = await httpRequest(url, soapBody);
      console.log(`   ${path} -> HTTP ${res.status}`);
      if (res.status === 200) {
        console.log(`   *** SUCCESS! Response (first 500 chars):`);
        console.log(`   ${res.body.slice(0, 500)}`);
      } else if (res.status === 500) {
        // Extract SOAP fault message
        const faultMatch = res.body.match(/<faultstring>(.*?)<\/faultstring>/);
        if (faultMatch) {
          console.log(`   SOAP Fault: ${faultMatch[1]}`);
        } else {
          console.log(`   Response: ${res.body.slice(0, 300)}`);
        }
      }
    } catch (e) {
      console.log(`   ${path} -> Error: ${e.message}`);
    }
  }

  // Also try with different company code
  console.log('\n3. Testing with companyCode "essl" (cp in device uses this)...');
  CREDS.companyCode = 'essl';
  CREDS.serial = 'CEXJ230260263';
  const soapBody2 = buildSoap(CREDS);
  for (const path of ['/IClock/WebService.asmx']) {
    const url = BASE_URL + path;
    try {
      const res = await httpRequest(url, soapBody2);
      console.log(`   ${path} (essl/CEXJ230260263) -> HTTP ${res.status}`);
      if (res.status === 200) {
        console.log(`   *** SUCCESS! Has data: ${res.body.includes('<Table>')}`);
        const tableCount = (res.body.match(/<Table>/g) || []).length;
        console.log(`   Punch records found: ${tableCount}`);
      } else {
        const faultMatch = res.body.match(/<faultstring>(.*?)<\/faultstring>/);
        console.log(`   ${faultMatch ? 'SOAP Fault: ' + faultMatch[1] : res.body.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  }

  // Try with credentials from esslSyncAgent .env.example
  console.log('\n4. Testing with original agent credentials (dany/Essl@123)...');
  CREDS.apiUser = 'dany';
  CREDS.apiPassword = 'Essl@123';
  CREDS.companyCode = 'essl';
  CREDS.serial = 'CUB7240300491';
  const soapBody3 = buildSoap(CREDS);
  for (const path of ['/IClock/WebService.asmx']) {
    const url = BASE_URL + path;
    try {
      const res = await httpRequest(url, soapBody3);
      console.log(`   ${path} (dany/CUB7240300491) -> HTTP ${res.status}`);
      if (res.status === 200) {
        console.log(`   *** SUCCESS!`);
        const tableCount = (res.body.match(/<Table>/g) || []).length;
        console.log(`   Punch records found: ${tableCount}`);
      } else {
        const faultMatch = res.body.match(/<faultstring>(.*?)<\/faultstring>/);
        console.log(`   ${faultMatch ? 'SOAP Fault: ' + faultMatch[1] : res.body.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
