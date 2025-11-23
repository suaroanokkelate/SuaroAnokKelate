
import React, { useState, useEffect } from 'react';
import { SOSRequest, Rescuer, SOSStatus, Translation } from '../types';
import * as storageService from '../services/storageService';
import RadarView from './RadarView';

interface AdminDashboardProps {
  t: Translation;
  onClose: () => void;
  allSOS: SOSRequest[];
  allRescuers: Rescuer[];
  refreshData: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ t, onClose, allSOS, allRescuers, refreshData }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<'overview' | 'sos' | 'rescuers'>('overview');
  const [editSOSId, setEditSOSId] = useState<string | null>(null);
  
  // Filter States
  const [filterStatus, setFilterStatus] = useState<'ALL' | SOSStatus>('ALL');

  // Stats
  const totalSOS = allSOS.length;
  const activeSOS = allSOS.filter(s => s.status === SOSStatus.ACTIVE).length;
  const medicalSOS = allSOS.filter(s => s.isMedicalEmergency).length;
  const rescuedSOS = allSOS.filter(s => s.status === SOSStatus.RESCUED).length;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'suarobanjir' && password === 'Tumpat!5295') {
      setIsAuthenticated(true);
    } else {
      alert("Invalid Username or Password");
    }
  };

  const handleDeleteSOS = async (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      await storageService.deleteSOS(id);
      refreshData();
    }
  };

  const handleDeleteRescuer = async (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      await storageService.deleteRescuer(id);
      refreshData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="mb-4 text-4xl text-blue-600"><i className="fa-solid fa-lock"></i></div>
          <h2 className="text-2xl font-bold mb-6 text-slate-800">{t.adminLogin}</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t.username}
              className="w-full text-center p-3 border rounded bg-slate-50 outline-none focus:border-blue-500"
              autoFocus
            />
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t.password}
              className="w-full text-center p-3 border rounded bg-slate-50 outline-none focus:border-blue-500"
            />
            <button className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">
              {t.login}
            </button>
            <button type="button" onClick={onClose} className="w-full text-slate-400 py-2">
              {t.back}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredSOS = allSOS.filter(s => filterStatus === 'ALL' || s.status === filterStatus);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-auto flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <h1 className="font-bold text-xl flex items-center gap-2">
          <i className="fa-solid fa-gauge-high"></i> SuaroBanjir Admin
        </h1>
        <div className="flex gap-4">
           <button onClick={() => setView('overview')} className={`px-3 py-1 rounded ${view === 'overview' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>{t.overview}</button>
           <button onClick={() => setView('sos')} className={`px-3 py-1 rounded ${view === 'sos' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>SOS Data</button>
           <button onClick={() => setView('rescuers')} className={`px-3 py-1 rounded ${view === 'rescuers' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>Rescuers</button>
           <button onClick={onClose} className="text-red-400 hover:text-red-300 ml-4"><i className="fa-solid fa-power-off"></i> {t.logout}</button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full">
        
        {view === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                  <div className="text-slate-500 text-sm font-bold uppercase">{t.totalVictims}</div>
                  <div className="text-3xl font-black text-slate-800">{totalSOS}</div>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
                  <div className="text-slate-500 text-sm font-bold uppercase">{t.activeRequests}</div>
                  <div className="text-3xl font-black text-red-600">{activeSOS}</div>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
                  <div className="text-slate-500 text-sm font-bold uppercase">{t.medicalNeeds}</div>
                  <div className="text-3xl font-black text-purple-600">{medicalSOS}</div>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                  <div className="text-slate-500 text-sm font-bold uppercase">{t.filterRescued}</div>
                  <div className="text-3xl font-black text-green-600">{rescuedSOS}</div>
               </div>
            </div>

            {/* Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Map Visualization */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold mb-4">Live Heatmap</h3>
                 <RadarView requests={allSOS.filter(s => s.status === SOSStatus.ACTIVE)} myLocation={{lat: 3.1412, lng: 101.6865}} /> 
                 <p className="text-xs text-slate-400 mt-2 text-center">Visualizing all ACTIVE signals relative to central point</p>
              </div>

              {/* Charts */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6">
                 <div>
                    <h3 className="font-bold mb-4">Status Distribution</h3>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                       <div style={{width: `${(activeSOS/totalSOS)*100}%`}} className="bg-red-500 h-full"></div>
                       <div style={{width: `${(rescuedSOS/totalSOS)*100}%`}} className="bg-blue-500 h-full"></div>
                       <div style={{width: `${((totalSOS-activeSOS-rescuedSOS)/totalSOS)*100}%`}} className="bg-slate-400 h-full"></div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                       <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Active</span>
                       <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Rescued</span>
                       <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-400 rounded-full"></div> Safe</span>
                    </div>
                 </div>

                 <div>
                     <h3 className="font-bold mb-4">Top Rescuers</h3>
                     <div className="space-y-2">
                        {allRescuers.sort((a,b) => b.rescuesCount - a.rescuesCount).slice(0,5).map((r, i) => (
                          <div key={r.id} className="flex items-center gap-2">
                             <div className="w-6 text-xs font-bold text-slate-400">#{i+1}</div>
                             <div className="flex-1 text-sm">{r.name}</div>
                             <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div style={{width: `${Math.min(r.rescuesCount * 5, 100)}%`}} className="bg-blue-600 h-full"></div>
                             </div>
                             <div className="text-xs font-bold">{r.rescuesCount}</div>
                          </div>
                        ))}
                     </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {view === 'sos' && (
           <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold">SOS Requests Database</h3>
                 <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as SOSStatus | 'ALL')}
                    className="border rounded p-1 text-sm"
                 >
                    <option value="ALL">All Status</option>
                    <option value={SOSStatus.ACTIVE}>Active</option>
                    <option value={SOSStatus.RESCUED}>Rescued</option>
                    <option value={SOSStatus.SAFE}>Safe</option>
                 </select>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                       <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Details</th>
                          <th className="p-3 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {filteredSOS.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                             <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(row.timestamp).toLocaleString()}</td>
                             <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                   row.status === SOSStatus.ACTIVE ? 'bg-red-100 text-red-600' : 
                                   row.status === SOSStatus.RESCUED ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                   {row.status}
                                </span>
                                {row.isMedicalEmergency && <span className="ml-1 px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-600">MED</span>}
                             </td>
                             <td className="p-3 font-medium">{row.name}<br/><span className="text-xs text-slate-400">{row.phone}</span></td>
                             <td className="p-3 text-xs max-w-xs truncate">{row.landmark}</td>
                             <td className="p-3 text-right">
                                <button onClick={() => handleDeleteSOS(row.id)} className="text-red-500 hover:text-red-700 px-2"><i className="fa-solid fa-trash"></i></button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {view === 'rescuers' && (
           <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="p-4 border-b bg-slate-50">
                 <h3 className="font-bold">Registered Rescuers</h3>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                       <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Username</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Rescues</th>
                          <th className="p-3 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {allRescuers.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                             <td className="p-3 font-mono font-bold text-blue-600">{row.id}</td>
                             <td className="p-3 font-medium">{row.name}</td>
                             <td className="p-3 text-slate-500">@{row.username || '-'}</td>
                             <td className="p-3 text-slate-500">{row.phone}</td>
                             <td className="p-3 font-bold">{row.rescuesCount}</td>
                             <td className="p-3 text-right">
                                <button onClick={() => handleDeleteRescuer(row.id)} className="text-red-500 hover:text-red-700 px-2"><i className="fa-solid fa-trash"></i></button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;