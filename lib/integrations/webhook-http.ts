import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { createHmac } from "node:crypto";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["192.88.99.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix);

export function isPublicIPv4(address: string) {
  return isIP(address) === 4 && !blocked.check(address);
}

export function parseWebhookUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    url.hostname.length > 253 ||
    (isIP(url.hostname) && !isPublicIPv4(url.hostname)) ||
    url.hostname.includes(":") ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local")
  ) {
    throw new Error(
      "Use a public HTTPS endpoint on port 443, without credentials or a fragment.",
    );
  }
  return url;
}

export function signWebhook(body: string, secret: string, timestamp: string) {
  return createHmac("sha256", secret)
    .update(timestamp + "." + body)
    .digest("hex");
}

export async function sendWebhook(
  urlText: string,
  secret: string,
  payload: unknown,
  eventId: string,
) {
  const url = parseWebhookUrl(urlText);
  // Resolve at every attempt, then pin the connection to that checked address.
  // ponytail: IPv4 only; add vetted IPv6 ranges if an IPv6-only receiver is needed.
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const answers = await Promise.race([
    lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(
        () => reject(new Error("Webhook DNS lookup timed out")),
        5_000,
      );
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!answers.length || answers.some((a) => !isPublicIPv4(a.address)))
    throw new Error(
      "Webhook destination does not resolve to a public IPv4 address.",
    );
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        family: 4,
        agent: false,
        lookup: (_hostname, _options, callback) =>
          callback(null, answers[0].address, 4),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "OpenReply-Webhook/1",
          "X-OpenReply-Event-Id": eventId,
          "X-OpenReply-Timestamp": timestamp,
          "X-OpenReply-Signature":
            "sha256=" + signWebhook(body, secret, timestamp),
        },
      },
      (response) => {
        // Do not follow redirects or retain response bodies (may contain secrets).
        const status = response.statusCode ?? 0;
        response.destroy();
        resolve(status);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Webhook request timed out")),
      10_000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", () => reject(new Error("Webhook connection failed")));
    req.end(body);
  });
}
