import http from "node:http";

const TARGET_API_BASE = "http://92.118.206.166:30281";
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "*";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-API-Key",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  try {
    const targetUrl = new URL(req.url || "/", TARGET_API_BASE).toString();
    const headers = { ...req.headers };
    delete headers.host;
    headers["x-forwarded-proto"] = "https";

    const chunks = [];
    if (req.method !== "GET" && req.method !== "HEAD") {
      for await (const chunk of req) {
        chunks.push(chunk);
      }
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: "manual"
    });

    const responseHeaders = {};
    upstreamRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      responseHeaders[key] = value;
    });

    if (req.headers.origin) {
      responseHeaders["access-control-allow-origin"] = req.headers.origin;
      responseHeaders["access-control-allow-credentials"] = "true";
      responseHeaders["vary"] = "Origin";
    }

    res.writeHead(upstreamRes.status, responseHeaders);
    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    res.writeHead(502, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true"
    });
    res.end(JSON.stringify({ success: false, error: "Proxy error", details: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`HTTPS Proxy listening on port ${PORT}`);
});
