/**
 * Authenticated user requests to join an organization by join_code (SW-XXXX-XXXX).
 * Creates organization_members row with status='pending'. Org admin approves via admin-review-membership.
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
    const joinCodeRaw = (body.joinCode as string)?.trim() ?? "";
    const joinCode = joinCodeRaw.toUpperCase().replace(/\s/g, "");
    const requestedRole = (body.requestedRole as string) ?? "supervisor";

    if (!/^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(joinCode)) {
      return json(400, { error: "Valid join code required (e.g. SW-ABCD-1234)" });
    }

    const validRoles = ["supervisor", "manager", "admin"];
    const role = validRoles.includes(requestedRole) ? requestedRole : "supervisor";

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, status")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (orgErr) return json(500, { error: "db_error", details: orgErr.message });
    if (!org) return json(404, { error: "Organization not found" });
    if (org.status !== "active") return json(403, { error: "Organization is not active" });

    const { data: existing } = await supabaseAdmin
      .from("organization_members")
      .select("status")
      .eq("organization_id", org.id)
      .eq("user_id", callerData.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") return json(400, { error: "Already requested to join this organization" });
      if (existing.status === "active") return json(400, { error: "Already a member of this organization" });
      return json(400, { error: "Your request was declined" });
    }

    const { error: insertErr } = await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: callerData.id,
      role,
      status: "pending",
    });
    if (insertErr) return json(500, { error: "Failed to submit request", details: insertErr.message });

    return json(200, { success: true, status: "pending", organizationId: org.id, organizationName: org.name });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Internal server error", details: String(e) });
  }
});
