import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { X, Camera, Search, User, RefreshCw, AlertCircle } from 'lucide-react';

const ScanMemberModal = ({ isOpen, onClose, onMemberScanned, title = "Scan Member QR" }) => {
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const html5Ref = useRef(null);
  const isStartingRef = useRef(false);

  const stopCamera = async () => {
    isStartingRef.current = false;
    if (html5Ref.current) {
      const inst = html5Ref.current;
      html5Ref.current = null;
      try { await inst.stop(); } catch (_) {}
      try { await inst.clear(); } catch (_) {}
    }
  };

  const startCamera = async () => {
    if (html5Ref.current || isStartingRef.current) return;
    isStartingRef.current = true;
    setErrorMsg('');
    setScanStatus('scanning');

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setErrorMsg('No camera detected.');
        setScanStatus('error');
        isStartingRef.current = false;
        return;
      }

      const rearCamera = devices.find(d => /back|rear|environment/i.test(d.label));
      const cameraId = rearCamera ? rearCamera.id : devices[0].id;

      const instance = new Html5Qrcode('modal-qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });

      await instance.start(
        cameraId,
        { fps: 10, qrbox: { width: 200, height: 200 } },
        handleScan,
        () => {} 
      );

      html5Ref.current = instance;
    } catch (err) {
      setErrorMsg('Camera access denied or failed.');
      setScanStatus('error');
      isStartingRef.current = false;
    }
  };

  const handleScan = async (decodedText) => {
    await stopCamera();
    setScanStatus('processing');
    
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('member_id_string', decodedText.trim())
      .single();

    if (error || !data) {
      setErrorMsg('Member not found. Check the QR code.');
      setScanStatus('error');
    } else {
      onMemberScanned(data);
      onClose();
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    const { data } = await supabase
      .from('members')
      .select('*')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,member_id_string.ilike.%${searchTerm}%`)
      .limit(5);
    
    setSearchResults(data || []);
    setSearching(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setSearchTerm('');
      setSearchResults([]);
      setScanStatus('idle');
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Scanner Area */}
          <div className="relative group">
            <div className={`w-full aspect-square rounded-2xl overflow-hidden bg-black border-2 transition-all ${
              scanStatus === 'scanning' ? 'border-neon' : 
              scanStatus === 'error' ? 'border-red-500' : 'border-gray-800'
            }`}>
              <div id="modal-qr-reader" className="w-full h-full" />
              
              {scanStatus !== 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-6 text-center">
                  {scanStatus === 'error' ? (
                    <>
                      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                      <p className="text-red-400 font-bold text-sm mb-4">{errorMsg}</p>
                      <button onClick={startCamera} className="btn-primary text-xs flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Retry Scanner
                      </button>
                    </>
                  ) : scanStatus === 'processing' ? (
                    <>
                      <RefreshCw className="w-12 h-12 text-neon animate-spin mb-4" />
                      <p className="text-neon font-black uppercase tracking-widest text-xs">Verifying Identity...</p>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase font-black tracking-widest"><span className="bg-surface px-4 text-textSecondary">OR SEARCH MANUALLY</span></div>
          </div>

          {/* Search Area */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Name or Member ID..." 
                className="input-field pl-10 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button type="submit" className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors">
              {searching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </form>

          {/* Search Results */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {searchResults.map(result => (
              <button 
                key={result.id}
                onClick={() => { onMemberScanned(result); onClose(); }}
                className="w-full flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800 hover:border-neon/50 hover:bg-neon/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:text-neon">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm tracking-tight">{result.first_name} {result.last_name}</p>
                  <p className="text-[10px] text-textSecondary font-mono uppercase">{result.member_id_string}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanMemberModal;
