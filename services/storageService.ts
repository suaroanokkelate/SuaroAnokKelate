
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SOSRequest, SOSStatus, Rescuer, ChatMessage } from '../types';

// --- CONFIGURATION ---
// TO ENABLE CROSS-DEVICE SYNC:
// 1. Go to https://supabase.com, create a free project.
// 2. In SQL Editor, run:
//    create table app_data ( id text primary key, collection text, value jsonb );
//    alter table app_data enable row level security;
//    create policy "Public Access" on app_data for all using (true);
// 3. Copy Project URL and Anon Key to below:

const SUPABASE_URL = 'https://gvnanidpxdalswytrpsy.supabase.co'; // e.g. 'https://xyz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bmFuaWRweGRhbHN3eXRycHN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3ODk2MCwiZXhwIjoyMDc5NDU0OTYwfQ.2kg3ObY9NbrOiNmn8zd8OUCFRqzim5pANUIKSbdm2rU'; // e.g. 'eyJ...'

// ---------------------

const STORAGE_KEY = 'floodguard_sos_data';
const USER_SOS_KEY = 'floodguard_user_sos_id';
const RESCUERS_KEY = 'floodguard_rescuers_data';
const LOCAL_RESCUER_ID_KEY = 'floodguard_local_rescuer_id';

export const SINCERE_TEAM_ID = '000';

let supabase: SupabaseClient | null = null;
let isCloudEnabled = false;
let hasCloudError = false; // Circuit breaker to stop trying if cloud is broken

if (SUPABASE_URL.startsWith('https') && SUPABASE_KEY.length > 10) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    isCloudEnabled = true;
  } catch (err) {
    console.warn("Invalid Supabase Configuration. Defaulting to Local Mode.");
  }
} else {
  // Silent fallback to local mode if keys are missing
  isCloudEnabled = false;
}

// Broadcast channel for local tab sync (works even in offline mode)
const channel = new BroadcastChannel('suarobanjir_updates');

// Seed Data
const SEED_DATA: SOSRequest[] = [
  {
    id: 'seed-1',
    name: 'Ahmad Razak',
    phone: '012-3456789',
    landmark: 'Near the big mosque, water level rising',
    status: SOSStatus.ACTIVE,
    location: { lat: 3.1412, lng: 101.6865 }, 
    timestamp: Date.now() - 3600000,
    isMedicalEmergency: false,
    messages: []
  },
  {
    id: 'seed-2',
    name: 'Somsak Boon',
    phone: '081-2345678',
    landmark: 'Red roof house, stuck on 2nd floor',
    status: SOSStatus.ACTIVE,
    location: { lat: 3.1450, lng: 101.6900 },
    timestamp: Date.now() - 1800000,
    isMedicalEmergency: true,
    messages: []
  }
];

const SEED_RESCUERS: Rescuer[] = [
  { id: SINCERE_TEAM_ID, name: 'Sincere Rescue Team', phone: '-', rescuesCount: 42 },
  { id: '117', username: 'chief117', name: 'Master Chief', phone: '011-117117', rescuesCount: 15 },
];

// --- Helpers ---

const notifyUpdates = () => {
  channel.postMessage({ type: 'UPDATE' });
};

export const subscribeToChanges = (callback: () => void) => {
  // Local tab listener
  channel.onmessage = () => callback();

  // Cloud listener
  let realtimeChannel: any = null;
  if (isCloudEnabled && supabase && !hasCloudError) {
    realtimeChannel = supabase.channel('public:app_data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload) => {
         callback();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn("Realtime connection error. Updates may strictly be local.");
        }
      });
  }

  return () => { 
    channel.onmessage = null; 
    if (realtimeChannel) supabase?.removeChannel(realtimeChannel);
  };
};

const handleCloudError = (e: any) => {
  console.warn("Cloud Sync Failed (Switching to Local Mode for this session):", e.message || e);
  hasCloudError = true; // Disable cloud calls for the rest of the session
};

// --- Data Access (Async for Cloud Support) ---

export const fetchSOS = async (): Promise<SOSRequest[]> => {
  if (isCloudEnabled && supabase && !hasCloudError) {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('collection', 'sos');
      
      if (error) throw error;
      if (data) return data.map((row: any) => row.value);
    } catch (e) {
      handleCloudError(e);
    }
  }

  // Fallback / Local Mode
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    return SEED_DATA;
  }
  return JSON.parse(data);
};

export const fetchRescuers = async (): Promise<Rescuer[]> => {
  if (isCloudEnabled && supabase && !hasCloudError) {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('collection', 'rescuers');
      
      if (error) throw error;
      // Ensure Sincere Team always exists
      const cloudRescuers = data ? data.map((row: any) => row.value) : [];
      if (!cloudRescuers.find((r: Rescuer) => r.id === SINCERE_TEAM_ID)) {
          // If fresh DB, add seed
          return SEED_RESCUERS;
      }
      return cloudRescuers;
    } catch (e) {
       handleCloudError(e);
    }
  }

  const data = localStorage.getItem(RESCUERS_KEY);
  if (!data) {
    localStorage.setItem(RESCUERS_KEY, JSON.stringify(SEED_RESCUERS));
    return SEED_RESCUERS;
  }
  return JSON.parse(data);
};

// --- Actions ---

const saveSOSRequestToCloud = async (req: SOSRequest) => {
  if (!supabase || hasCloudError) return;
  try {
    const { error } = await supabase.from('app_data').upsert({
      id: `sos_${req.id}`,
      collection: 'sos',
      value: req
    });
    if (error) throw error;
  } catch (e) {
    handleCloudError(e);
  }
};

const saveRescuerToCloud = async (rescuer: Rescuer) => {
  if (!supabase || hasCloudError) return;
  try {
    const { error } = await supabase.from('app_data').upsert({
      id: `rescuer_${rescuer.id}`,
      collection: 'rescuers',
      value: rescuer
    });
    if (error) throw error;
  } catch (e) {
    handleCloudError(e);
  }
};

export const createSOS = async (sos: Omit<SOSRequest, 'id' | 'timestamp' | 'status' | 'messages'>): Promise<SOSRequest> => {
  const newSOS: SOSRequest = {
    ...sos,
    id: Date.now().toString() + Math.floor(Math.random()*1000),
    timestamp: Date.now(),
    status: SOSStatus.ACTIVE,
    messages: []
  };

  if (isCloudEnabled && !hasCloudError) {
    await saveSOSRequestToCloud(newSOS);
  }
  
  // Always save local as backup/cache
  const all = await fetchSOS(); // This fetches local if cloud disabled, or cloud if enabled (but cloud might fail)
  // We need to ensure we don't duplicate if fetchSOS returned cloud data but saveToCloud failed.
  // Simplest strategy for hybrid: Always read/write local, optionally write cloud.
  
  // Refetch local specifically for updating cache
  const localData = localStorage.getItem(STORAGE_KEY);
  const currentLocal: SOSRequest[] = localData ? JSON.parse(localData) : SEED_DATA;
  
  const exists = currentLocal.find(s => s.id === newSOS.id);
  if (!exists) {
    currentLocal.push(newSOS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLocal));
  }
  
  localStorage.setItem(USER_SOS_KEY, newSOS.id);
  notifyUpdates();
  return newSOS;
};

export const updateSOSStatus = async (id: string, status: SOSStatus, rescuerId?: string): Promise<void> => {
  const all = await fetchSOS();
  const item = all.find(i => i.id === id);
  if (!item) return;

  const updatedItem = { ...item, status, rescuerId: rescuerId || item.rescuerId };

  if (isCloudEnabled && !hasCloudError) {
    await saveSOSRequestToCloud(updatedItem);
  }
  
  // Update local
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
      const currentLocal: SOSRequest[] = JSON.parse(localData);
      const updatedAll = currentLocal.map(s => s.id === id ? updatedItem : s);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
  }

  const myId = getMySOSId();
  if (id === myId && (status === SOSStatus.SAFE || status === SOSStatus.RESCUED)) {
     localStorage.removeItem(USER_SOS_KEY);
  }
  notifyUpdates();
};

export const updateSOSDetails = async (id: string, details: Partial<SOSRequest>): Promise<void> => {
  const all = await fetchSOS();
  const item = all.find(i => i.id === id);
  if (!item) return;

  const updatedItem = { ...item, ...details, timestamp: Date.now() };

  if (isCloudEnabled && !hasCloudError) {
    await saveSOSRequestToCloud(updatedItem);
  } 
  
  // Update Local
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
      const currentLocal: SOSRequest[] = JSON.parse(localData);
      const updatedAll = currentLocal.map(s => s.id === id ? updatedItem : s);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
  }
  
  notifyUpdates();
};

export const addMessage = async (sosId: string, message: ChatMessage): Promise<void> => {
  const all = await fetchSOS();
  const item = all.find(i => i.id === sosId);
  if (!item) return;

  const updatedItem = { ...item, messages: [...(item.messages || []), message] };
  
  if (isCloudEnabled && !hasCloudError) {
    await saveSOSRequestToCloud(updatedItem);
  }
  
  // Update Local
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
      const currentLocal: SOSRequest[] = JSON.parse(localData);
      const updatedAll = currentLocal.map(s => s.id === sosId ? updatedItem : s);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
  }
  
  notifyUpdates();
};

export const getMySOSId = (): string | null => {
  return localStorage.getItem(USER_SOS_KEY);
};

export const getMySOS = async (): Promise<SOSRequest | undefined> => {
  const id = getMySOSId();
  if (!id) return undefined;
  const all = await fetchSOS();
  return all.find(s => s.id === id);
};

// --- Rescuer Logic ---

const generateRescuerID = (existing: Rescuer[]): string => {
  let id = '';
  let unique = false;
  // Safety break
  let tries = 0;
  while (!unique && tries < 100) {
    id = Math.floor(100 + Math.random() * 900).toString();
    // eslint-disable-next-line no-loop-func
    if (!existing.find(r => r.id === id) && id !== SINCERE_TEAM_ID) {
      unique = true;
    }
    tries++;
  }
  return id;
};

export const registerRescuer = async (username: string, name: string, phone: string): Promise<Rescuer> => {
  const rescuers = await fetchRescuers();
  const id = generateRescuerID(rescuers);
  
  const newRescuer: Rescuer = {
    id,
    username,
    name,
    phone,
    rescuesCount: 0
  };
  
  if (isCloudEnabled && !hasCloudError) {
    await saveRescuerToCloud(newRescuer);
  }
  
  // Update local
  const localData = localStorage.getItem(RESCUERS_KEY);
  const currentLocal: Rescuer[] = localData ? JSON.parse(localData) : SEED_RESCUERS;
  currentLocal.push(newRescuer);
  localStorage.setItem(RESCUERS_KEY, JSON.stringify(currentLocal));
  
  localStorage.setItem(LOCAL_RESCUER_ID_KEY, newRescuer.id);
  notifyUpdates();
  return newRescuer;
};

export const getLocalRescuer = async (): Promise<Rescuer | undefined> => {
  const id = localStorage.getItem(LOCAL_RESCUER_ID_KEY);
  if (!id) return undefined;
  const rescuers = await fetchRescuers();
  return rescuers.find(r => r.id === id);
};

export const isValidRescuerID = async (id: string): Promise<boolean> => {
  const rescuers = await fetchRescuers();
  return rescuers.some(r => r.id === id);
}

export const processRescue = async (sosId: string, rescuerId?: string) => {
  const rescuers = await fetchRescuers();
  
  let targetId = SINCERE_TEAM_ID;
  let targetRescuer = rescuers.find(r => r.id === rescuerId);
  
  if (rescuerId && targetRescuer) {
      targetId = rescuerId;
  } else {
      // Ensure Sincere Team exists
      targetRescuer = rescuers.find(r => r.id === SINCERE_TEAM_ID);
      if (!targetRescuer) {
          targetRescuer = { id: SINCERE_TEAM_ID, name: 'Sincere Rescue Team', phone: '-', rescuesCount: 0 };
          rescuers.push(targetRescuer);
      }
      targetId = SINCERE_TEAM_ID;
  }

  // Update Rescuer count
  if (targetRescuer) {
      targetRescuer.rescuesCount += 1;
      if (isCloudEnabled && !hasCloudError) {
        await saveRescuerToCloud(targetRescuer);
      }
      
      // Update local
      const localData = localStorage.getItem(RESCUERS_KEY);
      if (localData) {
          const currentLocal: Rescuer[] = JSON.parse(localData);
          const updated = currentLocal.map(r => r.id === targetRescuer!.id ? targetRescuer! : r);
          if (!updated.find(r => r.id === targetRescuer!.id)) updated.push(targetRescuer);
          localStorage.setItem(RESCUERS_KEY, JSON.stringify(updated));
      }
  }

  // Update SOS Status
  await updateSOSStatus(sosId, SOSStatus.RESCUED, targetId);
};
