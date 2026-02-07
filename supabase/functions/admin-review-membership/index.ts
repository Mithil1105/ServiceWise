/**
 * Org admin or master admin: approve or block a pending membership.
 * Body: memberId (organization_members.id), action: 'approve' | 'block', role?: string (for approve).
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

    const isMasterAdmin = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", callerData.id)
      .is("organization_id", null)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => !!data);

    const body = await req.json().catch(() => ({}));
    const memberId = body.memberId as string | undefined;
    const action = body.action as string | undefined;
    const role = (body.role as string) ?? "supervisor";

    if (!memberId) return json(400, { error: "memberId is required" });
    if (action !== "approve" && action !== "block") return json(400, { error: "action must be approve or block" });

    const validRoles = ["supervisor", "manager", "admin"];
    const newRole = validRoles.includes(role) ? role : "supervisor";

    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("organization_members")
      .select("id, organization_id, user_id, status, role")
      .eq("id", memberId)
      .single();
    if (fetchErr || !member) return json(404, { error: "Membership not found" });

    if (!isMasterAdmin) {
      const { data: callerMember } = await supabaseAdmin
        .from("organization_members")
        .select("role")
        .eq("organization_id", member.organization_id)
        .eq("user_id", callerData.id)
        .eq("status", "active")
        .maybeSingle();
      if (!callerMember || !["admin", "manager"].includes(callerMember.role)) {
        return json(403, { error: "Org admin access required" });
      }
    }

    if (action === "approve") {
      if (member.status === "active") return json(400, { error: "Already approved" });
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("organization_members")
        .update({ status: "active", role: newRole })
        .eq("id", memberId)
        .select()
        .single();
      if (updateErr) return json(500, { error: "Failed to approve", details: updateErr.message });
      return json(200, { success: true, action: "approve", membership: updated });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("organization_members")
      .update({ status: "blocked" })
      .eq("id", memberId)
      .select()
      .single();
    if (updateErr) return json(500, { error: "Failed to block", details: updateErr.message });
    return json(200, { success: true, action: "block", membership: updated });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Internal server error", details: String(e) });
  }
});
