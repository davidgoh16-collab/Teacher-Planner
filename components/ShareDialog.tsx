import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, Check, Trash2, UserPlus } from 'lucide-react';
import {
  Share, ShareType, SharePermission,
  createShare, listSharesByMe, revokeShare, setSharePermission,
} from '../services/shareService';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  owner: { uid: string; email: string; displayName: string };
  type: ShareType;
  resourceId: string;
  resourceName: string;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, owner, type, resourceId, resourceName }) => {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('view');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);

  const loadShares = async () => {
    const all = await listSharesByMe(owner.uid);
    setShares(all.filter(s => s.type === type && s.resourceId === resourceId));
  };

  useEffect(() => {
    if (isOpen) {
      setEmail(''); setError(null); setSuccess(null); setPermission('view');
      loadShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resourceId]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!email.trim()) return;
    setSharing(true); setError(null); setSuccess(null);
    const res = await createShare({
      owner, type, resourceId, resourceName,
      recipientEmail: email.trim(),
      permission: type === 'project' ? permission : 'view',
    });
    setSharing(false);
    if (res.ok) {
      setSuccess(`Shared with ${email.trim()}.`);
      setEmail('');
      loadShares();
    } else {
      setError(res.error || 'Could not share.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Share {type === 'timetable' ? 'timetable' : 'project'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[20rem]">{resourceName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invite by email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@school.uk"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {type === 'project' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Permission:</span>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as SharePermission)}
                  className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-gray-700 dark:text-gray-200"
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
              </div>
            )}
            {type === 'timetable' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Shared timetables are read-only and always show your latest version.</p>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={14} /> {success}</p>}

            <button
              onClick={handleShare}
              disabled={sharing || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Share
            </button>
          </div>

          {shares.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shared with</p>
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{s.recipientEmail}</span>
                  {s.type === 'project' && (
                    <select
                      value={s.permission}
                      onChange={async (e) => { await setSharePermission(s, e.target.value as SharePermission); loadShares(); }}
                      className="text-xs rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-gray-700 dark:text-gray-200"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                  )}
                  <button
                    onClick={async () => { await revokeShare(s); loadShares(); }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                    title="Stop sharing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
