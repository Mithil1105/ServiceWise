/**
 * Storage Edge Function: R2 upload, delete, and signed URL.
 * Edge-safe implementation using aws4fetch (no Node-only APIs).
 */
import { AwsClient } from "https://esm.sh/aws4fetch@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getConfig() {
  const endpoint = Deno.env.get("CLOUDFLARE_R2_ENDPOINT");
  const accessKeyId = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("CLOUDFLARE_R2_BUCKET") ?? "app-uploads";
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function encodeKey(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function objectUrl(endpoint: string, bucket: string, key: string): string {
  return `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
}

function parseBody(req: Request): Promise<Record<string, unknown>> {
  return req.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return json(200, { ok: true });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Server configuration error" });

    const body = await parseBody(req);
    const token =
      (body.access_token as string)?.trim() ||
      (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "missing_bearer_token" });

    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
    });
    if (!authRes.ok) return json(401, { error: "invalid_or_expired_token" });
    const callerData = await authRes.json();
    if (!callerData?.id) return json(401, { error: "invalid_or_expired_token" });

    const cfg = getConfig();
    if (!cfg) return json(503, { error: "R2 not configured" });
    const aws = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const action = body.action as string;
    if (action === "upload") {
      const key = body.key as string;
      const content = body.content as string;
      const contentType = (body.contentType as string) || "application/octet-stream";
      if (!key || content == null) return json(400, { error: "key and content required" });
      const binary = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
      const res = await aws.fetch(objectUrl(cfg.endpoint, cfg.bucket, key), {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: binary,
      });
      if (!res.ok) {
        const details = await res.text().catch(() => "");
        return json(res.status || 500, { error: "Upload failed", details });
      }
      return json(200, { key });
    }

    if (action === "delete") {
      const keys = body.keys as string[];
      if (!Array.isArray(keys) || keys.length === 0) return json(400, { error: "keys array required" });
      let deleted = 0;
      const failures: Array<{ key: string; status: number }> = [];
      for (const key of keys) {
        const res = await aws.fetch(objectUrl(cfg.endpoint, cfg.bucket, key), { method: "DELETE" });
        if (res.ok || res.status === 404) {
          deleted += 1;
        } else {
          failures.push({ key, status: res.status });
        }
      }
      if (failures.length > 0) {
        return json(500, { error: "Delete failed for one or more objects", failures, deleted });
      }
      return json(200, { deleted: keys.length });
    }

    if (action === "signedUrl") {
      const key = body.key as string;
      const expiresIn = Math.min(Math.max(Number(body.expiresIn) || 3600, 1), 604800);
      if (!key) return json(400, { error: "key required" });
      const url = new URL(objectUrl(cfg.endpoint, cfg.bucket, key));
      // For aws4fetch with signQuery, expiration must be in query params.
      url.searchParams.set("X-Amz-Expires", String(expiresIn));
      const signedRequest = await aws.sign(new Request(url.toString(), { method: "GET" }), {
        aws: { signQuery: true },
      });
      return json(200, { url: signedRequest.url });
    }

    return json(400, { error: "Invalid action; use upload, delete, or signedUrl" });
  } catch (error) {
    console.error("storage-r2 error:", error);
    return json(500, { error: error instanceof Error ? error.message : "Internal error" });
  }
});
