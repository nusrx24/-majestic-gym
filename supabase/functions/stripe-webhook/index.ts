import Stripe from 'npm:stripe@^14.0.0';
import { createClient } from 'npm:@supabase/supabase-js@^2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  
  if (!signature || !webhookSecret) return new Response('Requires signature and secret', { status: 400 });

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      const memberId = session.metadata.member_id;
      const packageId = session.metadata.package_id;
      const durationDays = parseInt(session.metadata.duration_days);

      // Initialize Supabase Admin Client using secure Service Role key
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Fetch existing subscription to handle renewal logic automatically
      const { data: existingData } = await supabaseAdmin
        .from('member_subscriptions')
        .select('end_date')
        .eq('member_id', memberId)
        .eq('payment_status', 'paid')
        .order('end_date', { ascending: false })
        .limit(1);

      let startDate = new Date();
      if (existingData && existingData.length > 0 && new Date(existingData[0].end_date) >= new Date()) {
        startDate = new Date(existingData[0].end_date);
        startDate.setDate(startDate.getDate() + 1); // Start day after it expires
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      await supabaseAdmin.from('member_subscriptions').insert([{
        member_id: memberId,
        package_id: packageId,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_method: 'stripe_online',
        payment_status: 'paid',
        amount_paid: (session.amount_total || 0) / 100, // Store actual Stripe amount paid
        stripe_checkout_session: session.id
      }]);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400 }
    );
  }
});
