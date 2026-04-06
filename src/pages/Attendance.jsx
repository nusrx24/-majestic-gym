import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, User, AlertTriangle, Wifi } from 'lucide-react';
import { format } from 'date-fns';

const COOLDOWN_SECONDS = 5;

const Attendance = () => {
  const [scanResult, setScanResult]           = useState(null);
  const [cameraError, setCameraError]         = useState(null);
  const [countdown, setCountdown]             = useState(0);
  const [recentCheckIns, setRecentCheckIns]   = useState([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(true);
  const [liveCount, setLiveCount]             = useState(0); // real-time counter

  const html5Ref      = useRef(null);
  const lockedRef     = useRef(false);
  const isStartingRef = useRef(false);
  const isMountedRef  = useRef(true);
  const cooldownRef   = useRef(null);
  const intervalRef   = useRef(null);

  /* ─── Fetch check-ins ─── */
  const fetchRecentCheckIns = async () => {
    if (!isMountedRef.current) return;
    setLoadingCheckIns(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance')
      .select('*, members(first_name, last_name, member_id_string)')
      .gte('checked_in_at', `${today}T00:00:00`)
      .order('checked_in_at', { ascending: false })
      .limit(20);
    if (isMountedRef.current) {
      setRecentCheckIns(data || []);
      setLiveCount(data?.length || 0);
      setLoadingCheckIns(false);
    }
  };

  /* ─── Camera stop/start ─── */
  const stopCamera = async () => {
    isStartingRef.current = false;
    if (!html5Ref.current) return;
    const inst = html5Ref.current;
    html5Ref.current = null;
    try { await inst.stop(); } catch (_) {}
    try { await inst.clear(); } catch (_) {}
  };

  const startCamera = async () => {
    if (html5Ref.current || isStartingRef.current) return;
    isStartingRef.current = true;
    if (!isMountedRef.current) return;
    setCameraError(null);

    try {
      // Get all available cameras and pick the best one
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        if (isMountedRef.current) setCameraError('No camera found on this device.');
        isStartingRef.current = false;
        return;
      }

      // Prefer rear-facing camera on mobile, fallback to first available
      const rearCamera = devices.find(d => /back|rear|environment/i.test(d.label));
      const cameraId = rearCamera ? rearCamera.id : devices[0].id;

      const instance = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });

      await instance.start(
        cameraId,
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        handleScan,
        () => {} // ignore per-frame errors
      );

      if (!isMountedRef.current) {
        try { await instance.stop(); } catch (_) {}
        try { await instance.clear(); } catch (_) {}
        return;
      }
      html5Ref.current = instance;
    } catch (err) {
      isStartingRef.current = false;
      if (!isMountedRef.current) return;
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
        setCameraError('Camera access denied. Please allow camera permission in your browser settings and refresh the page.');
      } else if (msg.includes('no cameras') || msg.includes('device')) {
        setCameraError('No camera detected. Please connect a camera and refresh.');
      }
      // All other errors → silent (prevents "Camera error: undefined" popups)
    }
  };

  /* ─── Cooldown + auto-restart ─── */
  const clearTimers = () => {
    clearTimeout(cooldownRef.current);
    clearInterval(intervalRef.current);
  };

  const beginCooldown = () => {
    clearTimers();
    if (!isMountedRef.current) return;
    setCountdown(COOLDOWN_SECONDS);

    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current) { clearInterval(intervalRef.current); return; }
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);

    cooldownRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setScanResult(null);
      setCountdown(0);
      lockedRef.current = false;
      await startCamera();
    }, COOLDOWN_SECONDS * 1000);
  };

  /* ─── QR scan handler ─── */
  const handleScan = async (decodedText) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    await stopCamera();

    const memberId = decodedText.trim();

    // 1. Look up member
    const { data: memberData, error } = await supabase
      .from('members').select('*').eq('member_id_string', memberId).single();

    if (error || !memberData) {
      if (isMountedRef.current) setScanResult({ status: 'error', message: `QR not recognised: "${memberId}". Member not found in system.` });
      beginCooldown();
      return;
    }

    // 2. Duplicate guard
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from('attendance').select('checked_in_at')
      .eq('member_id', memberData.id)
      .gte('checked_in_at', todayStart.toISOString())
      .limit(1);

    if (existing?.length > 0) {
      const time = format(new Date(existing[0].checked_in_at), 'hh:mm a');
      if (isMountedRef.current) setScanResult({
        status: 'duplicate', member: memberData,
        message: `Already checked in today at ${time}. Entry not duplicated.`
      });
      beginCooldown();
      return;
    }

    // 3. Active subscription check
    const today = new Date().toISOString().split('T')[0];
    const { data: subData } = await supabase
      .from('member_subscriptions').select('end_date, packages(name)')
      .eq('member_id', memberData.id).eq('payment_status', 'paid')
      .gte('end_date', today).order('end_date', { ascending: false }).limit(1);

    if (!subData?.length) {
      if (isMountedRef.current) setScanResult({
        status: 'expired', member: memberData,
        message: 'Membership expired or not found. Please renew at the front desk.'
      });
      beginCooldown();
      return;
    }

    // 4. Log check-in
    await supabase.from('attendance').insert([{ member_id: memberData.id, check_in_method: 'qr_scan' }]);
    if (isMountedRef.current) setScanResult({
      status: 'success', member: memberData,
      packageName: subData[0].packages?.name, expiresOn: subData[0].end_date,
      message: 'Welcome! Check-in successful.'
    });
    beginCooldown();
  };

  /* ─── Lifecycle + Realtime ─── */
  useEffect(() => {
    isMountedRef.current = true;
    fetchRecentCheckIns();

    // Small delay to let DOM settle before camera init
    const initTimer = setTimeout(() => startCamera(), 400);

    // Supabase Realtime: auto-refresh list on new check-ins
    const channel = supabase
      .channel('attendance-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, () => {
        if (isMountedRef.current) fetchRecentCheckIns();
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
      clearTimers();
      stopCamera();
      supabase.removeChannel(channel);
    };
  }, []);

  const cfg = {
    success:   { border: 'border-green-500',  bg: 'bg-green-500/10',  text: 'text-green-400',  icon: <CheckCircle className="w-16 h-16 text-green-400 mb-4" /> },
    duplicate: { border: 'border-blue-500',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   icon: <CheckCircle className="w-16 h-16 text-blue-400 mb-4" /> },
    expired:   { border: 'border-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: <XCircle className="w-16 h-16 text-yellow-400 mb-4" /> },
    error:     { border: 'border-red-500',    bg: 'bg-red-500/10',    text: 'text-red-400',    icon: <XCircle className="w-16 h-16 text-red-400 mb-4" /> },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Attendance</h1>
          <p className="text-textSecondary mt-1">Scanner starts automatically. No button required.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-sm">
          <Wifi className="w-4 h-4" />
          <span>{liveCount} check-ins today</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Scanner Panel */}
        <div className="card flex flex-col items-center">
          <h2 className="text-lg font-bold text-white mb-4 self-start">QR Code Scanner</h2>

          {cameraError ? (
            <div className="w-full rounded-xl p-6 flex flex-col items-center text-center bg-red-500/10 border-2 border-red-500">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-red-400 font-semibold mb-4 text-sm">{cameraError}</p>
              <button onClick={() => { setCameraError(null); startCamera(); }} className="btn-primary text-sm">
                Retry Camera
              </button>
            </div>
          ) : scanResult ? (
            <div className={`w-full rounded-xl p-6 flex flex-col items-center text-center border-2 ${cfg[scanResult.status]?.border} ${cfg[scanResult.status]?.bg}`}>
              {cfg[scanResult.status]?.icon}
              {scanResult.member && <h2 className="text-2xl font-bold text-white mb-1">{scanResult.member.first_name} {scanResult.member.last_name}</h2>}
              {scanResult.member && <p className="text-textSecondary font-mono text-sm mb-2">{scanResult.member.member_id_string}</p>}
              {scanResult.packageName && <span className="text-xs bg-neon/20 text-neon px-3 py-1 rounded-full mb-2">{scanResult.packageName}</span>}
              {scanResult.expiresOn && <p className="text-textSecondary text-sm mb-2">Expires: {scanResult.expiresOn}</p>}
              <p className={`font-semibold mt-1 mb-5 ${cfg[scanResult.status]?.text}`}>{scanResult.message}</p>
              {/* Auto-countdown bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="h-1.5 bg-neon rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / COOLDOWN_SECONDS) * 100}%` }} />
              </div>
              <p className="text-textSecondary text-sm">
                {countdown > 0 ? `Scanner resets in ${countdown}s…` : 'Restarting scanner…'}
              </p>
            </div>
          ) : (
            <>
              <div className="w-full rounded-xl overflow-hidden bg-black border-2 border-neon mb-3" style={{ minHeight: '320px' }}>
                <div id="qr-reader" className="w-full h-full" />
              </div>
              <div className="flex items-center gap-2 text-neon text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-neon animate-pulse inline-block" />
                Scanner active — hold a QR code up to the camera
              </div>
            </>
          )}
        </div>

        {/* Today's Check-Ins – live via Realtime */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Today's Check-Ins</h2>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Live
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '460px' }}>
            {loadingCheckIns ? (
              <div className="text-center py-8 text-textSecondary text-sm">Loading…</div>
            ) : recentCheckIns.length === 0 ? (
              <div className="text-center py-8 text-textSecondary text-sm">No check-ins today yet.</div>
            ) : recentCheckIns.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{entry.members?.first_name} {entry.members?.last_name}</p>
                  <p className="text-textSecondary text-xs font-mono">{entry.members?.member_id_string}</p>
                </div>
                <div className="flex items-center gap-1 text-textSecondary text-xs flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {format(new Date(entry.checked_in_at), 'hh:mm a')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
