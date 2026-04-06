import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, User, Dumbbell, Clock, CheckCircle, XCircle, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const MemberKiosk = () => {
  const [step, setStep] = useState('member'); // member, equipment, success
  const [member, setMember] = useState(null);
  const [machine, setMachine] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('kiosk-reader', {
      fps: 10,
      qrbox: 250,
      aspectRatio: 1.0
    });

    scanner.render(onScanSuccess, onScanError);

    return () => {
      scanner.clear();
    };
  }, [step]);

  const onScanSuccess = async (decodedText) => {
    if (loading) return;

    if (step === 'member') {
      await identifyMember(decodedText);
    } else if (step === 'equipment') {
      await identifyMachine(decodedText);
    }
  };

  const onScanError = (err) => {
    // Silence errors to keep console clean during scanning
  };

  const identifyMember = async (idString) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('member_id_string', idString)
        .single();

      if (error || !data) throw new Error("Member ID not recognized. Please scan your gym ID.");
      
      setMember(data);
      setStep('equipment');
      
      // Auto-timeout if no machine scanned
      setTimeout(() => {
        if (step === 'equipment') resetKiosk();
      }, 30000);

    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const identifyMachine = async (qrString) => {
    if (!qrString.startsWith('EQUIP_SCAN:')) {
      setError("Invalid Machine QR. Please scan the QR code on the equipment.");
      return;
    }

    const machineId = qrString.split(':')[1];
    setLoading(true);
    setError(null);

    try {
      // 1. Get Machine Info
      const { data: equip, error: equipErr } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', machineId)
        .single();

      if (equipErr || !equip) throw new Error("Machine not recognized.");
      if (equip.status !== 'good') throw new Error(`This ${equip.name} is currently ${equip.status.replace('_', ' ')}.`);

      setMachine(equip);

      // 2. Check for Active Session
      const { data: session } = await supabase
        .from('equipment_usage')
        .select('*')
        .eq('member_id', member.id)
        .eq('equipment_id', machineId)
        .is('end_time', null)
        .maybeSingle();

      if (session) {
        await endSession(session, equip);
      } else {
        await startNewSession(equip);
      }

    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async (equip) => {
    const { data, error } = await supabase
      .from('equipment_usage')
      .insert([{
        equipment_id: equip.id,
        member_id: member.id,
        start_time: new Date().toISOString(),
        payment_status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    
    setLastAction({ type: 'start', machine: equip.name });
    setStep('success');
    autoReset();
  };

  const endSession = async (session, equip) => {
    const startTime = new Date(session.start_time);
    const endTime = new Date();
    const durationMinutes = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60)));
    const totalCharge = durationMinutes * equip.per_minute_rate;

    const { error } = await supabase
      .from('equipment_usage')
      .update({ 
        end_time: endTime.toISOString(),
        total_charge: totalCharge
      })
      .eq('id', session.id);

    if (error) throw error;

    setLastAction({ 
      type: 'stop', 
      machine: equip.name, 
      charge: totalCharge,
      mins: durationMinutes
    });
    setStep('success');
    autoReset();
  };

  const autoReset = () => {
    setTimeout(() => {
      resetKiosk();
    }, 5000);
  };

  const resetKiosk = () => {
    setMember(null);
    setMachine(null);
    setStep('member');
    setError(null);
    setLastAction(null);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center justify-center font-sans overflow-hidden">
      {/* Background Neon Glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
         <div className="absolute top-1/4 -left-20 w-96 h-96 bg-neon/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-neon/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      </div>

      <div className="w-full max-w-2xl z-10 space-y-8">
        <div className="text-center space-y-2">
           <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">
             Self-Scan <span className="text-neon">Kiosk</span>
           </h1>
           <p className="text-textSecondary uppercase font-black tracking-[0.3em] text-[10px] md:text-xs">Majestic GYM Smart Hub v2.0</p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-4">
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${step === 'member' ? 'bg-neon text-black border-neon' : 'bg-gray-900 text-gray-500 border-gray-800'}`}>
              <User className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase">Identify</span>
           </div>
           <ArrowRight className="w-4 h-4 text-gray-800" />
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${step === 'equipment' ? 'bg-neon text-black border-neon' : 'bg-gray-900 text-gray-500 border-gray-800'}`}>
              <Dumbbell className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase">Scan Machine</span>
           </div>
        </div>

        <div className="relative">
          {/* Main Interface Card */}
          <div className="bg-surface border border-gray-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
            
            {step !== 'success' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-black uppercase italic tracking-tight">
                    {step === 'member' ? 'Scan your Gym Member ID' : `Hi ${member?.first_name}, scan the machine`}
                  </h2>
                  <p className="text-textSecondary text-xs mt-2 opacity-60">Center the QR code in the frame below</p>
                </div>

                <div className="relative">
                  {/* Scanner Frame UI */}
                  <div id="kiosk-reader" className="overflow-hidden rounded-[2rem] border-4 border-gray-900 shadow-inner"></div>
                  
                  {/* Neon Scanner Overlays */}
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-1 bg-neon/40 shadow-[0_0_15px_rgba(204,255,0,0.5)] animate-scan z-20"></div>
                  
                  {loading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 rounded-[2rem]">
                       <RefreshCw className="w-10 h-10 text-neon animate-spin" />
                       <p className="text-neon text-[10px] font-black uppercase tracking-widest">Identifying...</p>
                    </div>
                  )}

                  {error && (
                    <div className="absolute inset-x-4 bottom-4 bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-shake z-40">
                       <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                       <p className="text-xs font-bold">{error}</p>
                    </div>
                  )}
                </div>

                {member && step === 'equipment' && (
                  <div className="p-4 bg-neon/10 border border-neon/30 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
                     <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-neon" />
                        <span className="text-white font-black uppercase text-sm tracking-tight">{member.first_name} {member.last_name}</span>
                     </div>
                     <button onClick={resetKiosk} className="text-[10px] font-black uppercase text-textSecondary hover:text-white underline">Logout</button>
                  </div>
                )}
              </div>
            )}

            {step === 'success' && lastAction && (
              <div className="text-center py-10 space-y-8 animate-in zoom-in-90 duration-500">
                 <div className="w-32 h-32 rounded-[2.5rem] bg-neon/20 border-2 border-neon/50 flex items-center justify-center text-neon mx-auto shadow-[0_0_50px_rgba(204,255,0,0.2)]">
                    <CheckCircle className="w-16 h-16" />
                 </div>
                 
                 <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">
                      {lastAction.type === 'start' ? 'Workout Started!' : 'Workout Complete!'}
                    </h2>
                    {lastAction.type === 'stop' && (
                       <div className="mt-4 space-y-2">
                          <p className="text-neon font-black text-2xl italic tracking-tighter">Rs. {lastAction.charge}</p>
                          <p className="text-textSecondary text-[10px] font-black uppercase tracking-[0.2em]">{lastAction.mins} mins on {lastAction.machine}</p>
                       </div>
                    )}
                    {lastAction.type === 'start' && (
                       <p className="text-textSecondary text-xs mt-2 font-medium">Session initialized for {lastAction.machine}. Time to grind!</p>
                    )}
                 </div>

                 <div className="pt-6">
                    <div className="inline-flex items-center gap-2 text-[10px] font-black text-neon uppercase opacity-60">
                       <RefreshCw className="w-3 h-3 animate-spin" />
                       Resetting Kiosk...
                    </div>
                 </div>
              </div>
            )}

          </div>

          {/* Footer Info */}
          <div className="mt-8 grid grid-cols-2 gap-4">
             <div className="p-4 bg-gray-900/40 rounded-3xl border border-gray-800 flex items-center gap-3">
                <Clock className="w-5 h-5 text-textSecondary" />
                <div>
                   <p className="text-[8px] text-gray-500 font-black uppercase leading-none">Server Time</p>
                   <p className="text-xs font-bold text-white mt-1">{format(new Date(), 'HH:mm:ss')}</p>
                </div>
             </div>
             <div className="p-4 bg-gray-900/40 rounded-3xl border border-gray-800 flex items-center gap-3">
                <QrCode className="w-5 h-5 text-textSecondary" />
                <div>
                   <p className="text-[8px] text-gray-500 font-black uppercase leading-none">Status</p>
                   <p className="text-xs font-bold text-green-400 mt-1 uppercase">Live Node</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default MemberKiosk;
