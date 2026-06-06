export default {
  async fetch(request, env, ctx) {
    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get("url");
    const psid = urlObj.searchParams.get("psid");
    const psidts = urlObj.searchParams.get("psidts");

    if (!targetUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };

      if (psid && psidts) {
        headers["Cookie"] = `__Secure-1PSID=${psid}; __Secure-1PSIDTS=${psidts};`;
      }

      const response = await fetch(targetUrl, {
        headers: headers,
        redirect: "follow"
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (e) {
      return new Response("Error fetching: " + e.message, { status: 500 });
    }
  }
};
