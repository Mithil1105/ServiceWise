/**
 * Set the current user's active organization (profiles.organization_id).
 * Caller must have an ACTIVE membership for the given organization.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Server configuration error" });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return json(401, { error: "missing_bearer_token" });

    const token = match[1].trim();
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
    });
    if (!authRes.ok) return json(401, { error: "invalid_or_expired_token" });

    const callerData = await authRes.json();
    if (!callerData?.id) return json(401, { error: "invalid_or_expired_token" });

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organizationId as string | undefined;
    if (!organizationId) return json(400, { error: "organizationId is required" });

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", callerData.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return json(403, { error: "You are not an active member of this organization" });

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: organizationId, updated_at: new Date().toISOString() })
      .eq("id", callerData.id);
    if (updateErr) return json(500, { error: "Failed to set active organization", details: updateErr.message });

    return json(200, { success: true, organizationId });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Internal server error", details: String(e) });
  }
});
