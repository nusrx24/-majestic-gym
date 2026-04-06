import React, { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { addDays, format } from 'date-fns';

const AssignMembershipModal = ({ isOpen, onClose, member, onSuccess }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSub, setActiveSub] = useState(null);

  useEffect(() => {
    if (isOpen && member) {
      fetchPackages();
      checkActiveSubscription();
    } else {
      setSelectedPkg(null);
      setActiveSub(null);
    }
  }, [isOpen, member]);

  const fetchPackages = async () => {
    setLoading(true);
    const { data } = await supabase.from('packages').select('*').order('price', { ascending: true });
    setPackages(data || []);
    setLoading(false);
  };

  const checkActiveSubscription = async () => {
    const { data } = await supabase
      .from('member_subscriptions')
      .select('end_date')
      .eq('member_id', member.id)
      .eq('payment_status', 'paid')
      .order('end_date', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      // Allow a 1-day overlap tolerance just in case
      if (new Date(data[0].end_date) >= new Date()) {
        setActiveSub(data[0]);
      }
    }
  };

  const handleCashPayment = async () => {
    if (!selectedPkg) return;
    setIsProcessing(true);
    
    // Calculate new expiration dates (Support Seamless Renewals)
    let startDate = new Date();
    if (activeSub) {
      // If they already have an active plan, this new plan will start exactly when the old one ends!
      startDate = new Date(activeSub.end_date);
      startDate = addDays(startDate, 1); // Start the day after it expires
    }
    
    const endDate = addDays(startDate, selectedPkg.duration_days);

    const payload = {
      member_id: member.id,
      package_id: selectedPkg.id,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      payment_method: 'cash',
      payment_status: 'paid',
      amount_paid: Number(selectedPkg.price)
    };

    console.log("Sending Subscription Payload:", payload);

    const { error } = await supabase.from('member_subscriptions').insert([payload]);

    setIsProcessing(false);
    
    if (error) {
      console.error("Supabase Error:", error);
      alert("Error assigning package: " + error.message);
    } else {
      onSuccess(); // Close modal and refresh outside
    }
  };

  const handleStripePayment = async () => {
    if (!selectedPkg) return;
    setIsProcessing(true);
    
    try {
      // Get the current user session to pass auth header
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          packageId: selectedPkg.id,
          memberId: member.id,
          price: Number(selectedPkg.price),
          name: selectedPkg.name,
          duration: Number(selectedPkg.duration_days)
        }
      });

      if (error) {
        let detail = error.message;
        try {
          const bodyText = await error?.context?.text();
          const bodyJson = JSON.parse(bodyText);
          detail = bodyJson?.error || bodyText || error.message;
        } catch (_) {}
        throw new Error(detail);
      }
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned. Response: ' + JSON.stringify(data));
      }
    } catch (err) {
      alert("Stripe Error: " + err.message);
      setIsProcessing(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-lg rounded-xl border border-gray-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-xl font-bold text-white">Assign Package</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-textSecondary mb-4">
            Select a membership plan for <strong className="text-neon">{member.first_name} {member.last_name}</strong>
          </p>

          {activeSub && (
            <div className="mb-4 bg-neon/10 border border-neon/50 p-3 rounded-lg text-sm text-neon font-medium">
              Note: This member has an active plan ending on {activeSub.end_date}. Buying a new package now will extend their membership from that date (Renewal).
            </div>
          )}
          
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-textSecondary">Loading packages...</div>
            ) : packages.map(pkg => (
                <div 
                  key={pkg.id} 
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedPkg?.id === pkg.id ? 'border-neon bg-neon/10' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-white tracking-tight">{pkg.name}</h3>
                      <p className="text-sm text-textSecondary">{pkg.duration_days} Days Access</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-neon text-lg">Rs. {pkg.price}</p>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex flex-col gap-3">
          <button 
            disabled={!selectedPkg || isProcessing}
            onClick={handleCashPayment}
            className="btn-primary w-full flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            {isProcessing ? 'Processing...' : 'Pay with CASH Now'}
          </button>
          <button 
            disabled={!selectedPkg || isProcessing}
            onClick={handleStripePayment}
            className="w-full py-3 rounded-lg border border-purple-500 text-purple-400 font-medium hover:bg-purple-500/10 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <CreditCard className="w-5 h-5" />
            {isProcessing ? 'Connecting to Stripe...' : 'Create Stripe Payment Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignMembershipModal;
