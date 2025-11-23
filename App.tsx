
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SOSRequest, LanguageCode, SOSStatus, GeoLocation, Rescuer, ChatMessage } from './types';
import { TRANSLATIONS } from './constants';
import * as storageService from './services/storageService';
import RadarView from './components/RadarView';

type UserMode = 'victim' | 'rescuer' | null;
type SortOption = 'time' | 'distance';

const App: React.FC = () => {
  // Initialize language from local storage or default to 'en'
  const [lang, setLang] = useState<LanguageCode>(() => {
      const saved = localStorage.getItem('suarobanjir_lang');
      return (saved as LanguageCode) || 'en';
  });
  
  const [userMode, setUserMode] = useState<UserMode>(null);
  const [activeTab, setActiveTab] = useState<string>('sos'); // 'sos', 'map', 'league'

  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeSOS, setActiveSOS] = useState<SOSRequest | undefined>(undefined);
  const [allSOS, setAllSOS] = useState<SOSRequest[]>([]);
  const [allRescuers, setAllRescuers] = useState<Rescuer[]>([]);
  
  // Filter & Sort State
  const [filterStatus, setFilterStatus] = useState<SOSStatus | 'ALL'>(SOSStatus.ACTIVE);
  const [sortBy, setSortBy] = useState<SortOption>('time');

  // Form State for SOS
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isMedicalEmergency, setIsMedicalEmergency] = useState(false);
  const [isEditingSOS, setIsEditingSOS] = useState(false);

  // Rescuer Logic & Modals
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showRescueAttributionModal, setShowRescueAttributionModal] = useState(false);
  const [showGeneratedIDModal, setShowGeneratedIDModal] = useState(false);
  const [pendingRescueId, setPendingRescueId] = useState<string | null>(null);
  
  // Registration Form
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [newRescuerID, setNewRescuerID] = useState('');

  // Rescue Attribution Form
  const [attributionID, setAttributionID] = useState('');

  // Chat State
  const [chatSOSId, setChatSOSId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang];

  // Persist language choice
  useEffect(() => {
    localStorage.setItem('suarobanjir_lang', lang);
  }, [lang]);

  // Handle Tab Switching based on Mode
  useEffect(() => {
    if (userMode === 'victim') setActiveTab('sos');
    if (userMode === 'rescuer') setActiveTab('map');
  }, [userMode]);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    setAddress(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLocationError(null);

        // Reverse Geocoding via Nominatim (OpenStreetMap)
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            if (data && data.address) {
                const a = data.address;
                // Construct a concise address string: Road, Village/Suburb, Town
                const parts = [
                    a.road,
                    a.village || a.suburb || a.residential || a.neighbourhood,
                    a.town || a.city || a.district
                ].filter(Boolean);
                // Remove duplicates and join
                const uniqueParts = [...new Set(parts)];
                if (uniqueParts.length > 0) {
                    setAddress(uniqueParts.join(', '));
                }
            }
        } catch (e) {
            console.error("Geocoding error:", e);
            // Fail silently, standard location locked message will show
        }
      },
      (err) => {
        setLocationError(err.message);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const refreshData = useCallback(() => {
    setAllSOS(storageService.getAllSOS());
    setActiveSOS(storageService.getMySOS());
    setAllRescuers(storageService.getAllRescuers().sort((a, b) => b.rescuesCount - a.rescuesCount));
  }, []);

  useEffect(() => {
    fetchLocation();
    refreshData();
    const interval = setInterval(refreshData, 3000); // Faster polling for chat
    return () => clearInterval(interval);
  }, [fetchLocation, refreshData]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allSOS, showChatModal, activeSOS]);

  // Update form fields
  useEffect(() => {
    if (activeSOS && !isEditingSOS) {
      setName(activeSOS.name);
      setPhone(activeSOS.phone);
      setLandmark(activeSOS.landmark);
      setIsMedicalEmergency(activeSOS.isMedicalEmergency);
    }
  }, [activeSOS, isEditingSOS]);

  const handleSendSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    storageService.createSOS({
      name,
      phone,
      landmark,
      location,
      isMedicalEmergency,
      message: ''
    });
    refreshData();
  };

  const startEditing = () => {
    if (activeSOS) setIsEditingSOS(true);
  };

  const cancelEditing = () => {
    setIsEditingSOS(false);
    if (activeSOS) {
        setName(activeSOS.name);
        setPhone(activeSOS.phone);
        setLandmark(activeSOS.landmark);
        setIsMedicalEmergency(activeSOS.isMedicalEmergency);
    }
  };

  const handleUpdateSOS = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSOS) return;
    storageService.updateSOSDetails(activeSOS.id, { name, phone, landmark, isMedicalEmergency });
    setIsEditingSOS(false);
    refreshData();
  };

  const handleQuickUpdate = () => {
    if (!activeSOS) return;
    if (window.confirm("Update your request with current details and location?")) {
        storageService.updateSOSDetails(activeSOS.id, {
            name, phone, landmark, isMedicalEmergency,
            location: location || activeSOS.location
        });
        refreshData();
    }
  };

  const handleMarkSafe = (id?: string | React.MouseEvent) => {
    const targetId = typeof id === 'string' ? id : activeSOS?.id;
    if (targetId) {
      storageService.updateSOSStatus(targetId, SOSStatus.SAFE);
      refreshData();
      if (activeSOS && targetId === activeSOS.id) setActiveSOS(undefined);
    }
  };

  const handleVictimMarkRescued = () => {
    if (activeSOS) {
        if(window.confirm("Confirm you have been rescued?")) {
           storageService.updateSOSStatus(activeSOS.id, SOSStatus.RESCUED);
           refreshData();
           setActiveSOS(undefined);
        }
    }
  };

  // --- Rescuer Flow ---

  const initiateRescue = (sosId: string) => {
    setPendingRescueId(sosId);
    setAttributionID(''); // Clear previous input
    // Check for local rescuer ID to autofill
    const local = storageService.getLocalRescuer();
    if (local) {
        setAttributionID(local.id);
    }
    setShowRescueAttributionModal(true);
  };

  const submitRescueAttribution = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingRescueId) return;
    
    if (attributionID) {
        if (!storageService.isValidRescuerID(attributionID)) {
            alert(t.invalidId);
            return;
        }
        storageService.processRescue(pendingRescueId, attributionID);
    } else {
        // Should not happen via form submit, but handled in sincere handler
        storageService.processRescue(pendingRescueId);
    }
    
    refreshData();
    setShowRescueAttributionModal(false);
    setPendingRescueId(null);
  };

  const handleSincereRescue = () => {
      if (!pendingRescueId) return;
      storageService.processRescue(pendingRescueId); // No ID = Sincere
      refreshData();
      setShowRescueAttributionModal(false);
      setPendingRescueId(null);
  };

  // --- Rescuer Registration ---
  
  const openRegistration = () => {
      setRegUsername('');
      setRegName('');
      setRegPhone('');
      setShowRegistrationModal(true);
  };

  const handleRegistration = (e: React.FormEvent) => {
      e.preventDefault();
      const newRescuer = storageService.registerRescuer(regUsername, regName, regPhone);
      setNewRescuerID(newRescuer.id);
      setShowRegistrationModal(false);
      setShowGeneratedIDModal(true);
      refreshData();
  };

  // --- Chat ---

  const openChat = (sosId: string) => {
    setChatSOSId(sosId);
    setShowChatModal(true);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const targetId = userMode === 'rescuer' ? chatSOSId : activeSOS?.id;
    if (!targetId) return;

    const sender = userMode === 'rescuer' ? 'rescuer' : 'victim';
    const localRescuer = storageService.getLocalRescuer();
    const senderName = sender === 'rescuer' ? (localRescuer?.username || localRescuer?.name || t.rescuerLabel) : (activeSOS?.name || t.victimLabel);

    storageService.addMessage(targetId, {
        sender,
        text: chatMessage,
        timestamp: Date.now(),
        senderName
    });
    setChatMessage('');
    refreshData();
  };

  // Helper to calculate approximate distance number for sorting
  const getDistanceNum = (target: GeoLocation | null) => {
    if (!location || !target) return Infinity;
    const R = 6371; 
    const dLat = (target.lat - location.lat) * Math.PI / 180;
    const dLon = (target.lng - location.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(location.lat * Math.PI / 180) * Math.cos(target.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // returns km
  };

  const formatDistance = (distKm: number) => {
    if (distKm === Infinity) return '? km';
    return distKm < 1 ? `${(distKm * 1000).toFixed(0)}m` : `${distKm.toFixed(1)}km`;
  };

  const filteredSOS = allSOS.filter(item => filterStatus === 'ALL' || item.status === filterStatus);
  
  const sortedSOS = [...filteredSOS].sort((a, b) => {
    if (a.id === activeSOS?.id) return -1;
    if (b.id === activeSOS?.id) return 1;

    if (sortBy === 'time') {
        return b.timestamp - a.timestamp;
    } else {
        const distA = getDistanceNum(a.location);
        const distB = getDistanceNum(b.location);
        return distA - distB;
    }
  });

  // --- Render Landing Page ---
  if (!userMode) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 max-w-md mx-auto shadow-2xl relative">
         <div className="absolute top-6 right-6 flex items-center gap-2 animate-bounce-x">
             <span className="text-sm font-bold text-blue-600">{t.changeLang} --&gt;</span>
            <select 
                value={lang} 
                onChange={(e) => setLang(e.target.value as LanguageCode)}
                className="text-slate-700 text-lg font-bold py-2 px-4 rounded-lg border-2 border-blue-100 bg-blue-50 outline-none focus:border-blue-400 shadow-sm cursor-pointer"
            >
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
                <option value="th">ภาษาไทย</option>
            </select>
         </div>
         <div className="text-center mb-12 mt-12">
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <i className="fa-solid fa-life-ring text-5xl text-white"></i>
            </div>
            <h1 className="text-4xl font-bold text-slate-800">{t.title}</h1>
            <p className="text-slate-500 mt-2">Emergency Flood Response</p>
         </div>

         <div className="w-full space-y-6">
            <button 
                onClick={() => setUserMode('victim')}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-8 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
            >
                <i className="fa-solid fa-tower-broadcast text-4xl"></i>
                <span className="text-xl font-bold uppercase tracking-wider">{t.modeSOS}</span>
            </button>

            <button 
                onClick={() => setUserMode('rescuer')}
                className="w-full bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 py-8 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
            >
                <i className="fa-solid fa-hand-holding-heart text-4xl"></i>
                <span className="text-xl font-bold uppercase tracking-wider">{t.modeRescue}</span>
            </button>
         </div>
         <footer className="absolute bottom-6 text-xs text-slate-300">
            © 2024 SuaroAnokKelate
         </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-white flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-100 p-4 sticky top-0 z-40 flex flex-col gap-2 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                {userMode === 'victim' ? 
                    <i className="fa-solid fa-circle-exclamation text-red-600 text-xl"></i> : 
                    <i className="fa-solid fa-shield-halved text-blue-600 text-xl"></i>
                }
                <h1 className="text-xl font-bold text-slate-800">{t.title}</h1>
            </div>
            <button onClick={() => setUserMode(null)} className="text-slate-400 hover:text-slate-600 px-2">
                <i className="fa-solid fa-house"></i>
            </button>
          </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {userMode === 'victim' ? (
              <>
                <button 
                    onClick={() => setActiveTab('sos')}
                    className={`flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${activeTab === 'sos' ? 'bg-white text-red-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                    {t.sendSOS}
                </button>
                <button 
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                    {t.viewMap}
                </button>
              </>
          ) : (
              <>
                <button 
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                    {t.rescuerView}
                </button>
                <button 
                    onClick={() => setActiveTab('league')}
                    className={`flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${activeTab === 'league' ? 'bg-white text-yellow-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                    {t.leagueTab}
                </button>
              </>
          )}
        </div>

        {/* SOS Tab (Victim) */}
        {activeTab === 'sos' && (
          <div className="space-y-6">
            {activeSOS && !isEditingSOS ? (
              <div className={`bg-white border-2 rounded-xl p-6 text-center animate-fade-in ${activeSOS.isMedicalEmergency ? 'border-purple-400' : 'border-green-400'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl animate-pulse ${activeSOS.isMedicalEmergency ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                  <i className={`fa-solid ${activeSOS.isMedicalEmergency ? 'fa-truck-medical' : 'fa-tower-broadcast'}`}></i>
                </div>
                <h2 className="text-xl font-bold mb-1 text-slate-800">{t.yourSOS}</h2>
                <p className="text-slate-500 mb-4">{t.locationFound}</p>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left text-sm text-slate-700 mb-4">
                    <p><strong>{t.status}:</strong> {activeSOS.status}</p>
                    <p><strong>{t.name}:</strong> {activeSOS.name}</p>
                    <p className="truncate"><strong>{t.landmark}:</strong> {activeSOS.landmark}</p>
                </div>
                
                {/* Embedded Chat */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-48 mb-4">
                    <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 border-b border-slate-200">{t.chat}</div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {(activeSOS.messages || []).length === 0 && <p className="text-xs text-center text-slate-300 mt-4">No messages yet.</p>}
                        {(activeSOS.messages || []).map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.sender === 'victim' ? 'items-end' : 'items-start'}`}>
                                <div className={`px-3 py-2 rounded-lg text-xs max-w-[80%] ${msg.sender === 'victim' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                    {msg.text}
                                </div>
                                <span className="text-[9px] text-slate-400 mt-1">{msg.senderName}</span>
                            </div>
                        ))}
                        <div ref={chatBottomRef}></div>
                    </div>
                    <form onSubmit={sendChatMessage} className="p-2 border-t border-slate-100 flex gap-2">
                        <input 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 text-sm outline-none focus:border-blue-400"
                            placeholder={t.typeMessage}
                            value={chatMessage}
                            onChange={e => setChatMessage(e.target.value)}
                        />
                        <button type="submit" className="text-blue-600 px-2"><i className="fa-solid fa-paper-plane"></i></button>
                    </form>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={startEditing} className="bg-white border border-slate-300 text-slate-600 font-bold py-2 px-4 rounded-lg">
                    {t.editSOS}
                  </button>
                  <button onClick={handleQuickUpdate} className="bg-white border border-blue-300 text-blue-600 font-bold py-2 px-4 rounded-lg">
                     {t.updateSOS}
                  </button>
                  <button onClick={handleVictimMarkRescued} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md">
                    {t.markRescued}
                  </button>
                  <button onClick={handleMarkSafe} className="bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-md">
                    {t.iAmSafe}
                  </button>
                </div>
              </div>
            ) : (
              /* SOS Form */
              <form onSubmit={isEditingSOS ? handleUpdateSOS : handleSendSOS} className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 space-y-4">
                <div className={`text-xs font-mono p-2 rounded flex justify-between ${location ? 'bg-white border border-green-200 text-green-700' : 'bg-white border border-orange-200 text-orange-700'}`}>
                  <span>{location ? (address ? address : t.locationFound) : t.gettingLocation}</span>
                  {location && <i className="fa-solid fa-location-dot"></i>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.name} <span className="text-red-500">*</span></label>
                  <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.phone} <span className="text-red-500">*</span></label>
                  <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.landmark}</label>
                  <textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={3} className="w-full bg-white border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" placeholder={t.landmarkPlaceholder} />
                </div>
                 <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${isMedicalEmergency ? 'bg-white border-purple-500 shadow-sm' : 'bg-white border-slate-200'}`} onClick={() => setIsMedicalEmergency(!isMedicalEmergency)}>
                    <input readOnly type="checkbox" checked={isMedicalEmergency} className="h-5 w-5 text-purple-600" />
                    <div className="text-sm">
                       <span className="font-bold text-slate-700">{t.medicalEmergencyLabel}</span>
                    </div>
                </div>

                {isEditingSOS ? (
                  <div className="flex gap-2">
                     <button type="button" onClick={cancelEditing} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-lg">{t.cancel}</button>
                     <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg">{t.updateSOS}</button>
                  </div>
                ) : (
                  <button type="submit" disabled={!location} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-lg shadow-lg">
                    {t.submit}
                  </button>
                )}
              </form>
            )}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filters */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {(['ALL', SOSStatus.ACTIVE, SOSStatus.RESCUED, SOSStatus.SAFE] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                                filterStatus === status 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                        >
                            {status === 'ALL' ? t.filterAll : status === SOSStatus.ACTIVE ? t.filterActive : status === SOSStatus.RESCUED ? t.filterRescued : t.filterSafe}
                        </button>
                    ))}
                </div>
                
                {/* Sort */}
                <div className="flex items-center gap-2 text-xs text-slate-500 border-b border-slate-100 pb-2">
                    <span className="font-bold uppercase">{t.sortBy}:</span>
                    <button 
                        onClick={() => setSortBy('time')}
                        className={`px-3 py-1 rounded-md transition-colors ${sortBy === 'time' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-50'}`}
                    >
                        {t.sortTime}
                    </button>
                    <button 
                        onClick={() => setSortBy('distance')}
                        className={`px-3 py-1 rounded-md transition-colors ${sortBy === 'distance' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-50'}`}
                    >
                        {t.sortDistance}
                    </button>
                </div>
            </div>

            <RadarView requests={filteredSOS} myLocation={location} mySOSId={activeSOS?.id} />

            <div className="space-y-3 mt-4">
              {sortedSOS.map((req) => {
                  const isMe = req.id === activeSOS?.id;
                  const isMedical = req.isMedicalEmergency;
                  const isSafe = req.status === SOSStatus.SAFE;
                  const isRescued = req.status === SOSStatus.RESCUED;

                  let borderColor = "border-slate-200";
                  if (isSafe) borderColor = "border-slate-300 opacity-70";
                  else if (isRescued) borderColor = "border-blue-400";
                  else if (isMedical) borderColor = "border-purple-400 ring-1 ring-purple-100";
                  else if (isMe) borderColor = "border-green-400 ring-1 ring-green-100";

                  const distanceNum = getDistanceNum(req.location);

                  return (
                  <div key={req.id} className={`bg-white p-4 rounded-lg shadow-sm border ${borderColor} flex flex-col gap-3`}>
                    <div className="flex flex-wrap gap-2">
                        {isMe && <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">YOU</span>}
                        {isMedical && <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">MEDICAL / ELDERLY</span>}
                        {isRescued && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">RESCUED</span>}
                        {isSafe && <span className="bg-slate-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">SAFE</span>}
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{req.name}</h4>
                        <p className="text-xs text-slate-500"><i className="fa-solid fa-phone mr-1"></i> {req.phone}</p>
                        {req.landmark && <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-1 rounded inline-block">{req.landmark}</p>}
                      </div>
                      {req.location && location && (
                        <div className="text-right">
                           <span className="text-xs font-bold text-slate-400 block">{formatDistance(distanceNum)}</span>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${req.location.lat},${req.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                              Map <i className="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </div>
                      )}
                    </div>
                    
                    {req.status === SOSStatus.ACTIVE && (
                        <div className="flex gap-2 mt-1">
                            {userMode === 'rescuer' && (
                                <>
                                    <button onClick={() => initiateRescue(req.id)} className="flex-1 py-2 bg-white border border-blue-500 text-blue-600 rounded text-xs font-bold shadow-sm hover:bg-blue-50 transition-colors">
                                        {t.markRescued}
                                    </button>
                                    <button onClick={() => openChat(req.id)} className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 rounded text-xs font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                        <i className="fa-regular fa-comments"></i> {t.chat}
                                    </button>
                                </>
                            )}
                            {isMe && (
                                <button onClick={() => handleMarkSafe(req.id)} className="flex-1 py-2 bg-white border border-green-500 text-green-600 rounded text-xs font-bold">
                                    {t.markSafe}
                                </button>
                            )}
                        </div>
                    )}
                  </div>
                )})}
            </div>
            
            <div className="pt-6 pb-2 text-center">
                <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); alert("This would link to the external Admin Web Dashboard."); }}
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs font-semibold transition-colors border border-slate-200 rounded-full px-4 py-2 hover:bg-slate-50"
                >
                    <i className="fa-solid fa-chart-pie"></i>
                    {t.adminDashboard}
                </a>
            </div>
          </div>
        )}

        {/* League Tab */}
        {activeTab === 'league' && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-trophy text-yellow-500"></i> {t.rescuerLeague}</h2>
                 <button 
                    onClick={openRegistration}
                    className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full shadow hover:bg-blue-700"
                 >
                    {t.joinTeam}
                 </button>
             </div>
             
             <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b border-slate-100">
                  <tr><th className="px-4 py-3 text-center">#</th><th className="px-4 py-3">{t.rescuerName}</th><th className="px-4 py-3 text-right">{t.rescues}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allRescuers.map((rescuer, index) => (
                    <tr key={rescuer.id} className={rescuer.id === storageService.SINCERE_TEAM_ID ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium flex flex-col">
                          <span>{rescuer.id === storageService.SINCERE_TEAM_ID ? t.sincereTeamName : rescuer.name}</span>
                          {rescuer.username && <span className="text-[10px] text-slate-400">@{rescuer.username}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{rescuer.rescuesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Rescuer Registration Modal */}
      {showRegistrationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-up">
            <h3 className="text-lg font-bold mb-2">{t.joinTeam}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.enterRescuerDetails}</p>
            <form onSubmit={handleRegistration} className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-700">{t.username}</label>
                  <input required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="border p-2 rounded w-full bg-white" />
               </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-xs font-bold text-slate-700">{t.name}</label>
                      <input required value={regName} onChange={e => setRegName(e.target.value)} className="border p-2 rounded w-full bg-white" />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-700">{t.phone}</label>
                      <input required value={regPhone} onChange={e => setRegPhone(e.target.value)} className="border p-2 rounded w-full bg-white" />
                  </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setShowRegistrationModal(false)} className="flex-1 bg-slate-100 py-2 rounded font-bold text-slate-600">{t.cancel}</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">{t.registerAndRescue}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated ID Modal (Success) */}
      {showGeneratedIDModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6">
              <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm text-center animate-scale-up relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                  <i className="fa-solid fa-circle-check text-5xl text-green-500 mb-4"></i>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{t.registerSuccess}</h3>
                  <p className="text-sm text-slate-500 mb-6">{t.idNote}</p>
                  
                  <div className="bg-slate-100 p-4 rounded-lg border-2 border-slate-200 mb-6">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.yourIdIs}</p>
                      <p className="text-4xl font-black text-slate-800 tracking-widest">{newRescuerID}</p>
                  </div>

                  <button onClick={() => setShowGeneratedIDModal(false)} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow hover:bg-green-700">
                      OK
                  </button>
              </div>
          </div>
      )}

      {/* Rescue Attribution Modal */}
      {showRescueAttributionModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
             <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-up">
                <h3 className="text-lg font-bold mb-4 text-center">{t.markRescued}</h3>
                
                <form onSubmit={submitRescueAttribution} className="space-y-4">
                    <div className="text-center">
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t.enterIdToRescue}</label>
                        <input 
                            type="text" 
                            value={attributionID}
                            onChange={(e) => setAttributionID(e.target.value)}
                            placeholder="123"
                            className="text-center text-2xl font-bold tracking-widest w-32 mx-auto block p-2 border-2 border-blue-200 rounded-lg focus:border-blue-600 outline-none bg-white"
                            maxLength={4}
                        />
                    </div>
                    
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-blue-700">
                        {t.verifyAndRescue}
                    </button>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-xs">OR</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <button type="button" onClick={handleSincereRescue} className="w-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold py-3 rounded-lg hover:bg-yellow-100">
                        <i className="fa-solid fa-heart mr-2"></i> {t.sincereRescue}
                    </button>

                    <button type="button" onClick={() => setShowRescueAttributionModal(false)} className="w-full text-slate-400 text-xs font-bold py-2 hover:text-slate-600">
                        {t.cancel}
                    </button>
                </form>
             </div>
          </div>
      )}

      {/* Chat Modal */}
      {showChatModal && chatSOSId && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md sm:rounded-xl h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 sm:rounded-t-xl">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <i className="fa-regular fa-comments"></i> 
                        {t.chatWith} {allSOS.find(s => s.id === chatSOSId)?.name}
                    </h3>
                    <button onClick={() => setShowChatModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                     {(() => {
                         const targetSOS = allSOS.find(s => s.id === chatSOSId);
                         const msgs = targetSOS?.messages || [];
                         if (msgs.length === 0) return <p className="text-center text-slate-300 text-sm mt-10">Start the conversation...</p>;
                         return msgs.map((msg, idx) => (
                             <div key={idx} className={`flex flex-col ${msg.sender === 'rescuer' ? 'items-end' : 'items-start'}`}>
                                 <div className={`px-4 py-2 rounded-2xl text-sm max-w-[75%] shadow-sm ${msg.sender === 'rescuer' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                                     {msg.text}
                                 </div>
                                 <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </div>
                         ));
                     })()}
                     <div ref={chatBottomRef}></div>
                </div>
                <form onSubmit={sendChatMessage} className="p-4 border-t bg-white flex gap-2">
                    <input 
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t.typeMessage}
                        value={chatMessage}
                        onChange={e => setChatMessage(e.target.value)}
                    />
                    <button type="submit" className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow hover:bg-blue-700">
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;
