import Stripe from 'npm:stripe@^14.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { packageId, memberId, price, name, duration } = await req.json();

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine the origin URL - fallback to localhost for testing
    const origin = req.headers.get('origin') || 'http://localhost:5173';

    // Create a dynamic Stripe Checkout Session with LKR currency
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'lkr',
            product_data: {
              name: `Gym Membership: ${name}`,
              description: `${duration} Days Access`,
            },
            unit_amount: Math.round(price * 100), // Stripe uses cents/cents-equivalent
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/members?payment=success`,
      cancel_url: `${origin}/members?payment=cancelled`,
      client_reference_id: memberId, // Pass the member UUID
      metadata: {
        package_id: packageId,
        member_id: memberId,
        duration_days: duration.toString()
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
