// Vercel serverless function that proxies chat completions to NVIDIA API.
// It expects a POST request with a JSON body identical to the NVIDIA API spec.
// The NVIDIA API key must be provided via the VERCEL environment variable `NVIDIA_API_KEY`.

export default async function handler(req, res) {
  // Only POST is supported
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Missing NVIDIA_API_KEY environment variable" });
  }

  try {
    const downstream = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await downstream.json();
    // Propagate content type if present
    const ct = downstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    return res.status(downstream.status).json(data);
  } catch (err) {
    console.error("NVIDIA proxy error", err);
    return res.status(502).json({ error: "Bad Gateway – unable to contact NVIDIA API" });
  }
}
