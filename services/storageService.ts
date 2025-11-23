
import { SOSRequest, SOSStatus, Rescuer, ChatMessage } from '../types';

const STORAGE_KEY = 'floodguard_sos_data';
const USER_SOS_KEY = 'floodguard_user_sos_id';
const RESCUERS_KEY = 'floodguard_rescuers_data';
const LOCAL_RESCUER_ID_KEY = 'floodguard_local_rescuer_id';

export const SINCERE_TEAM_ID = '000';

// Broadcast channel for cross-tab synchronization
const channel = new BroadcastChannel('suarobanjir_updates');

// Seed some data for visualization
const SEED_DATA: SOSRequest[] = [
  {
    id: 'seed-1',
    name: 'Ahmad Razak',
    phone: '012-3456789',
    landmark: 'Near the big mosque, water level rising',
    status: SOSStatus.ACTIVE,
    location: { lat: 3.1412, lng: 101.6865 }, // Roughly KL
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
    isMedicalEmergency: true, // Example medical emergency
    messages: []
  }
];

// Seed rescuers for the league
const SEED_RESCUERS: Rescuer[] = [
  { id: SINCERE_TEAM_ID, name: 'Sincere Rescue Team', phone: '-', rescuesCount: 42 },
  { id: '117', username: 'chief117', name: 'Master Chief', phone: '011-117117', rescuesCount: 15 },
  { id: '204', username: 'rescue_john', name: 'John Doe', phone: '011-1111111', rescuesCount: 8 },
];

const notifyUpdates = () => {
  channel.postMessage({ type: 'UPDATE' });
};

export const subscribeToChanges = (callback: () => void) => {
  channel.onmessage = () => callback();
  return () => { channel.onmessage = null; };
};

export const getAllSOS = (): SOSRequest[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    return SEED_DATA;
  }
  return JSON.parse(data);
};

export const createSOS = (sos: Omit<SOSRequest, 'id' | 'timestamp' | 'status' | 'messages'>): SOSRequest => {
  const all = getAllSOS();
  const newSOS: SOSRequest = {
    ...sos,
    id: Date.now().toString(),
    timestamp: Date.now(),
    status: SOSStatus.ACTIVE,
    messages: []
  };
  
  all.push(newSOS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  localStorage.setItem(USER_SOS_KEY, newSOS.id);
  notifyUpdates();
  return newSOS;
};

export const updateSOSStatus = (id: string, status: SOSStatus, rescuerId?: string): void => {
  const all = getAllSOS();
  const updated = all.map(item => {
    if (item.id === id) {
      return { ...item, status, rescuerId: rescuerId || item.rescuerId };
    }
    return item;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  
  // Only remove local user key if the update corresponds to their own SOS
  const myId = getMySOSId();
  if (id === myId && (status === SOSStatus.SAFE || status === SOSStatus.RESCUED)) {
     localStorage.removeItem(USER_SOS_KEY);
  }
  notifyUpdates();
};

export const updateSOSDetails = (id: string, details: Partial<SOSRequest>): void => {
  const all = getAllSOS();
  const updated = all.map(item => {
    if (item.id === id) {
      return { ...item, ...details, timestamp: Date.now() };
    }
    return item;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyUpdates();
};

export const addMessage = (sosId: string, message: ChatMessage): void => {
  const all = getAllSOS();
  const updated = all.map(item => {
    if (item.id === sosId) {
      const messages = item.messages || [];
      return { ...item, messages: [...messages, message] };
    }
    return item;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyUpdates();
};

export const getMySOSId = (): string | null => {
  return localStorage.getItem(USER_SOS_KEY);
};

export const getMySOS = (): SOSRequest | undefined => {
  const id = getMySOSId();
  if (!id) return undefined;
  const all = getAllSOS();
  return all.find(s => s.id === id);
};

// --- Rescuer Logic ---

export const getAllRescuers = (): Rescuer[] => {
  const data = localStorage.getItem(RESCUERS_KEY);
  if (!data) {
    localStorage.setItem(RESCUERS_KEY, JSON.stringify(SEED_RESCUERS));
    return SEED_RESCUERS;
  }
  return JSON.parse(data);
};

// Generate a random 3-digit ID to start, e.g., 100-999
const generateRescuerID = (existing: Rescuer[]): string => {
  let id = '';
  let unique = false;
  while (!unique) {
    id = Math.floor(100 + Math.random() * 900).toString();
    // eslint-disable-next-line no-loop-func
    if (!existing.find(r => r.id === id) && id !== SINCERE_TEAM_ID) {
      unique = true;
    }
  }
  return id;
};

export const registerRescuer = (username: string, name: string, phone: string): Rescuer => {
  const rescuers = getAllRescuers();
  const id = generateRescuerID(rescuers);
  
  const newRescuer: Rescuer = {
    id,
    username,
    name,
    phone,
    rescuesCount: 0
  };
  
  rescuers.push(newRescuer);
  localStorage.setItem(RESCUERS_KEY, JSON.stringify(rescuers));
  localStorage.setItem(LOCAL_RESCUER_ID_KEY, newRescuer.id);
  notifyUpdates();
  return newRescuer;
};

export const getLocalRescuer = (): Rescuer | undefined => {
  const id = localStorage.getItem(LOCAL_RESCUER_ID_KEY);
  if (!id) return undefined;
  const rescuers = getAllRescuers();
  return rescuers.find(r => r.id === id);
};

export const isValidRescuerID = (id: string): boolean => {
  const rescuers = getAllRescuers();
  return rescuers.some(r => r.id === id);
}

export const processRescue = (sosId: string, rescuerId?: string) => {
  const rescuers = getAllRescuers();
  
  // Determine target ID
  let targetId = SINCERE_TEAM_ID;
  if (rescuerId && isValidRescuerID(rescuerId)) {
      targetId = rescuerId;
  } else {
      // Ensure Sincere Team exists
      if (!rescuers.find(r => r.id === SINCERE_TEAM_ID)) {
          rescuers.push({ id: SINCERE_TEAM_ID, name: 'Sincere Rescue Team', phone: '-', rescuesCount: 0 });
      }
  }

  // Increment Score
  const updatedRescuers = rescuers.map(r => 
    r.id === targetId ? { ...r, rescuesCount: r.rescuesCount + 1 } : r
  );
  localStorage.setItem(RESCUERS_KEY, JSON.stringify(updatedRescuers));
  
  // Update SOS Status
  updateSOSStatus(sosId, SOSStatus.RESCUED, targetId);
  notifyUpdates();
};
