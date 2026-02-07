/**
 * Master admin only: create a new organization. Caller becomes org admin (active member).
 * Uses auth.getUser(token) for JWT validation (reliable for Edge Functions).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(500, { error: "Server configuration error" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return json(401, { error: "Invalid token" });
    }

    // Master admin = user_roles with role='admin' and organization_id IS NULL
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("organization_id", null)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr) throw roleErr;
    if (!roleRow) {
      return json(403, { error: "Forbidden: not master admin" });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name as string)?.trim();
    const status = (body.status as "active" | "suspended") ?? "active";
    if (!name) {
      return json(400, { error: "name is required" });
    }

    let slug = slugify(name) || "org";
    let attempts = 0;
    while (attempts < 100) {
      const { data: existing } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
      attempts++;
    }
    if (attempts >= 100) {
      return json(500, { error: "Could not generate unique slug" });
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name, slug, status, created_by: user.id })
      .select("id, join_code")
      .single();

    if (orgErr) {
      return json(500, { error: "Failed to create organization", details: orgErr.message });
    }

    await supabaseAdmin.from("organization_settings").insert({ organization_id: org.id }).then(() => {});

    await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "admin",
      status: "active",
    });

    await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: user.id,
        organization_id: org.id,
        role: "admin",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,organization_id" }
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (profile?.organization_id == null) {
      await supabaseAdmin
        .from("profiles")
        .update({ organization_id: org.id, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    return json(200, {
      success: true,
      organizationId: org.id,
      joinCode: org.join_code,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
