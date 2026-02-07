/**
 * Send email via Resend API.
 * Set RESEND_API_KEY in Supabase Edge Function secrets.
 *
 * For Supabase Auth verification emails to use Resend:
 * Dashboard → Auth → SMTP Settings:
 *   Host: smtp.resend.com, Port: 465, User: resend, Password: <your Resend API key>
 */
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_URL = "https://api.resend.com/emails";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "RESEND_API_KEY is not set. Add it in Supabase Edge Function secrets." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const body = await req.json().catch(() => ({}));
        const from = (body.from as string)?.trim();
        const to = body.to as string | string[] | undefined;
        const subject = (body.subject as string)?.trim();
        const html = body.html as string | undefined;
        const text = body.text as string | undefined;
        const replyTo = (body.replyTo as string)?.trim();

        if (!from || !subject) {
            return new Response(
                JSON.stringify({ error: "from and subject are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const toArr = Array.isArray(to) ? to : to ? [String(to).trim()] : [];
        if (toArr.length === 0 || toArr.some((e) => !e)) {
            return new Response(
                JSON.stringify({ error: "to must be a non-empty string or array of emails" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!html && !text) {
            return new Response(
                JSON.stringify({ error: "html or text is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const payload: Record<string, unknown> = {
            from,
            to: toArr,
            subject,
        };
        if (html) payload.html = html;
        if (text) payload.text = text;
        if (replyTo) payload.reply_to = replyTo;

        const res = await fetch(RESEND_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return new Response(
                JSON.stringify({
                    error: "Resend API error",
                    status: res.status,
                    details: (data as { message?: string }).message ?? data,
                }),
                { status: res.status >= 500 ? 502 : res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, id: (data as { id?: string }).id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
