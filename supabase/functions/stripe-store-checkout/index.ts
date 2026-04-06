import Stripe from 'npm:stripe@^14.0.0';
import { createClient } from 'npm:@supabase/supabase-js@^2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const { cartItems, memberId, staffCreated } = await req.json();

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Create a Pending Sale Record first to get the ID
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('inventory_sales')
      .insert([{
        member_id: memberId || null,
        total_amount: cartItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0),
        payment_method: 'stripe_online',
        payment_status: 'pending'
      }])
      .select()
      .single();

    if (saleError) throw saleError;

    // 2. Add Sale Items
    for (const item of cartItems) {
      await supabaseAdmin.from('inventory_sale_items').insert([{
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }]);
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cartItems.map((item: any) => ({
        price_data: {
          currency: 'lkr',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/shop?success=true&sale_id=${sale.id}`,
      cancel_url: `${req.headers.get('origin')}/shop?canceled=true`,
      metadata: {
        transaction_type: 'store_sale',
        sale_id: sale.id,
        member_id: memberId || 'guest'
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
