/**
 * Temporary script to exchange Shopify OAuth code for an access token.
 * Run: node scripts/shopify-oauth.mjs
 * Then visit the OAuth URL in your browser.
 * After authorizing, this catches the redirect and exchanges the code.
 */

import http from 'http';

const CLIENT_ID = 'ed0e259e587ff6146f8efbb8a8d2911d';
const CLIENT_SECRET = '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';
const SHOP = 'lunettiq-pencilz.myshopify.com';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3456');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(200);
    res.end('Waiting for OAuth callback... No code received yet.');
    return;
  }

  console.log('\n✅ Got authorization code:', code);
  console.log('Exchanging for access token...\n');

  try {
    const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      console.log('═══════════════════════════════════════');
      console.log('ACCESS TOKEN:', data.access_token);
      console.log('SCOPE:', data.scope);
      console.log('═══════════════════════════════════════');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Success!</h1>
        <p>Access token has been printed to your terminal.</p>
        <p>You can close this tab and stop the server (Ctrl+C).</p>
      `);
    } else {
      console.log('Error response:', data);
      res.writeHead(400);
      res.end('Error: ' + JSON.stringify(data));
    }
  } catch (err) {
    console.error('Exchange failed:', err);
    res.writeHead(500);
    res.end('Exchange failed: ' + err.message);
  }
});

server.listen(3456, () => {
  console.log('\n🔑 Shopify OAuth token exchange server running on http://localhost:3456');
  console.log('\nOpen this URL in your browser:\n');
  console.log(`https://admin.shopify.com/store/lunettiq-pencilz/oauth/authorize?client_id=${CLIENT_ID}&scope=read_customers,write_customers,read_discounts,write_discounts,read_files,write_files,write_inventory,read_inventory,read_metaobjects,write_metaobjects,read_orders,write_orders,read_products,write_products,read_content,write_content&redirect_uri=http://localhost:3456/`);
  console.log('\n');
});
