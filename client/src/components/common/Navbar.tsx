import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Wifi, WifiOff, RefreshCw, Bell, LogOut, User as UserIcon, Shield, Navigation } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useOfflineSync } from '../../hooks/useOfflineSync.js';
import { NotificationDrawer } from '../notification/NotificationDrawer.js';
import type { CampusNotification } from '../../types.js';

interface NavbarProps {
  notifications: CampusNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  notifications,
  onMarkAllRead,
  onMarkRead
}) => {
  const { user, role, logout, quickLoginAs } = useAuth();
  const { isOnline, isSyncing, pendingCount, triggerSync } = useOfflineSync();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSwitchRoleOpen, setIsSwitchRoleOpen] = useState(false);
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleRoleSwitch = async (targetRole: 'admin' | 'driver' | 'student') => {
    setIsSwitchRoleOpen(false);
    await quickLoginAs(targetRole);
    if (targetRole === 'admin') navigate('/admin');
    else if (targetRole === 'driver') navigate('/driver');
    else navigate('/student');
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'driver':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <Navigation className="w-3 h-3" /> Driver
          </span>
        );
      case 'student':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <UserIcon className="w-3 h-3" /> Student
          </span>
        );
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              onClick={() => {
                if (role === 'admin') navigate('/admin');
                else if (role === 'driver') navigate('/driver');
                else navigate('/student');
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                  Campus<span className="text-sky-600">Transit</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 uppercase tracking-widest">
                    LIVE
                  </span>
                </span>
                <p className="text-[10px] text-slate-500 hidden sm:block">Hardware-Free Smart GPS Network</p>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              {/* Online / Offline Sync Indicator */}
              <div className="hidden sm:flex items-center">
                {isOnline ? (
                  isSyncing ? (
                    <span
                      onClick={triggerSync}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer animate-pulse"
                      title="Syncing offline queue to backend"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Syncing {pendingCount} pts...
                    </span>
                  ) : pendingCount > 0 ? (
                    <button
                      onClick={triggerSync}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300 hover:bg-sky-200 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync {pendingCount} Queued
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Wifi className="w-3.5 h-3.5" />
                      Online
                    </span>
                  )
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                    title={`Offline. ${pendingCount} GPS records saved in local IndexedDB`}
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                    Offline ({pendingCount} queued)
                  </span>
                )}
              </div>

              {/* Demo Role Switcher (For Judges / Evaluators) */}
              <div className="relative">
                <button
                  onClick={() => setIsSwitchRoleOpen(!isSwitchRoleOpen)}
                  className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
                  title="Switch role for demonstration"
                >
                  <span>Role:</span>
                  {getRoleBadge()}
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {isSwitchRoleOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Demo Role Switch
                    </div>
                    <button
                      onClick={() => handleRoleSwitch('student')}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 ${
                        role === 'student' ? 'text-sky-600 font-bold bg-sky-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>Student View</span>
                      {role === 'student' && '✓'}
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('driver')}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 ${
                        role === 'driver' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>Driver Cockpit</span>
                      {role === 'driver' && '✓'}
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('admin')}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 ${
                        role === 'admin' ? 'text-purple-600 font-bold bg-purple-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>Admin Fleet Center</span>
                      {role === 'admin' && '✓'}
                    </button>
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => setIsNotifOpen(true)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* User Avatar & Logout */}
              {user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={onMarkAllRead}
        onMarkRead={onMarkRead}
      />
    </>
  );
};
