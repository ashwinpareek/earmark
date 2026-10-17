// Render cron job: once a day, ask the web service to renew and re-check PayPal holds.
const host = process.env.APP_HOST;
const url = (host?.startsWith("http") ? host : `https://${host}`) + "/api/cron/holds";
const r = await fetch(url, { method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } });
const body = await r.text();
console.log(r.status, body);
if (!r.ok) process.exit(1);
