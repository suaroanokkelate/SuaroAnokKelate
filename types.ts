
export type LanguageCode = 'en' | 'ms' | 'th';

export enum SOSStatus {
  ACTIVE = 'ACTIVE',
  RESCUED = 'RESCUED',
  SAFE = 'SAFE'
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface ChatMessage {
  sender: 'victim' | 'rescuer';
  text: string;
  timestamp: number;
  senderName?: string;
}

export interface SOSRequest {
  id: string;
  name: string;
  phone: string;
  landmark: string;
  status: SOSStatus;
  location: GeoLocation | null;
  timestamp: number;
  message?: string;
  rescuerId?: string;
  isMedicalEmergency: boolean;
  messages: ChatMessage[];
}

export interface Rescuer {
  id: string; // Now a short ID like "117"
  username?: string;
  name: string;
  phone: string;
  rescuesCount: number;
}

export interface Translation {
  title: string;
  sendSOS: string;
  iAmSafe: string;
  name: string;
  phone: string;
  landmark: string;
  landmarkPlaceholder: string;
  location: string;
  submit: string;
  viewMap: string;
  gettingLocation: string;
  locationFound: string;
  locationError: string;
  rescuerView: string;
  distance: string;
  status: string;
  timeSubmitted: string;
  markSafe: string;
  markRescued: string;
  noSOS: string;
  yourSOS: string;
  language: string;
  changeLang: string;
  // League specific
  leagueTab: string;
  rescuerLeague: string;
  rank: string;
  rescuerName: string;
  rescues: string;
  registerRescuer: string;
  joinTeam: string;
  enterRescuerDetails: string;
  registerAndRescue: string;
  cancel: string;
  // Edit specific
  editSOS: string;
  updateSOS: string;
  // Medical
  medicalEmergencyLabel: string;
  // Filters
  filterAll: string;
  filterActive: string;
  filterSafe: string;
  filterRescued: string;
  // Landing & Chat
  modeSOS: string;
  modeRescue: string;
  iWantToRescue: string;
  chat: string;
  sendMessage: string;
  typeMessage: string;
  chatWith: string;
  rescuerLabel: string;
  victimLabel: string;
  // Sorting & Admin
  sortBy: string;
  sortTime: string;
  sortDistance: string;
  adminDashboard: string;
  // ID System
  username: string;
  rescuerId: string;
  sincereRescue: string;
  enterIdToRescue: string;
  yourIdIs: string;
  idNote: string;
  verifyAndRescue: string;
  invalidId: string;
  registerSuccess: string;
  sincereTeamName: string;
}

export interface Dictionary {
  en: Translation;
  ms: Translation;
  th: Translation;
}
