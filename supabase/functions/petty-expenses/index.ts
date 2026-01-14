import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vehicle_number, from, to } = await req.json();

    console.log('Fetching petty expenses for:', { vehicle_number, from, to });

    // Get external Supabase credentials from environment
    const pettySupabaseUrl = Deno.env.get('PETTY_SUPABASE_URL');
    const pettySupabaseKey = Deno.env.get('PETTY_SUPABASE_SERVICE_KEY');
    const pettyOrgId = Deno.env.get('PETTY_ORG_ID');

    // If external petty cash is not configured, return empty array
    if (!pettySupabaseUrl || !pettySupabaseKey) {
      console.log('External petty cash not configured, returning empty array');
      return new Response(
        JSON.stringify({ 
          expenses: [],
          message: 'External petty cash integration not configured'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Build query params - filter by organization_id
    let queryParams = `vehicle_number=eq.${encodeURIComponent(vehicle_number)}`;
    
    // Add organization filter if configured
    if (pettyOrgId) {
      queryParams += `&organization_id=eq.${encodeURIComponent(pettyOrgId)}`;
    }
    
    if (from) {
      queryParams += `&date=gte.${from}`;
    }
    if (to) {
      queryParams += `&date=lte.${to}`;
    }

    // Fetch from external Supabase
    const response = await fetch(
      `${pettySupabaseUrl}/rest/v1/expenses?${queryParams}&order=date.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': pettySupabaseKey,
          'Authorization': `Bearer ${pettySupabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching from petty cash:', errorText);
      
      return new Response(
        JSON.stringify({ 
          expenses: [],
          error: 'Failed to fetch from petty cash system'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // Return 200 with empty array to not break the app
        }
      );
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} expenses from petty cash`);

    // Normalize the expense data
    const expenses = data.map((expense: any) => ({
      id: expense.id,
      date: expense.date,
      category: expense.category || expense.expense_type || 'Other',
      amount: expense.amount,
      vendor: expense.vendor || expense.vendor_name,
      notes: expense.notes || expense.description,
      source: 'PettyCash',
    }));

    return new Response(
      JSON.stringify({ expenses }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in petty-expenses function:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        expenses: [],
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 with empty array to not break the app
      }
    );
  }
});
