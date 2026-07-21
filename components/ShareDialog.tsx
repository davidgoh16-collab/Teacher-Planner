import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, Check, Trash2, UserPlus, Copy, Send } from 'lucide-react';
import {
  Share, ShareType, SharePermission,
  createShare, listSharesByMe, revokeShare, setSharePermission,
} from '../services/shareService';

/** Prefilled email draft so the colleague actually hears about the share (the app has no mail server). */
const buildInvite = (recipientEmail: string, type: ShareType, resourceName: string) => {
  const what = type === 'timetable' ? 'my timetable' : `the project "${resourceName}"`;
  const subject = `I've shared ${what} with you on Teacher Planner`;
  const body = `Hi,\n\nI've shared ${what} with you in Teacher Planner.\n\nSign in at ${window.location.origin} using this email address (${recipientEmail}) and it will appear under "Shared with me".\n`;
  return {
    text: `${subject}\n\n${body}`,
    mailto: `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
};

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
  const [invite, setInvite] = useState<{ email: string; pending: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadShares = async () => {
    try {
      const all = await listSharesByMe(owner.uid);
      setShares(all.filter(s => s.type === type && s.resourceId === resourceId));
    } catch (e) {
      console.error('Failed to load existing shares', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setEmail(''); setError(null); setSuccess(null); setPermission('view');
      setInvite(null); setCopied(false);
      loadShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resourceId]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!email.trim()) return;
    const target = email.trim();
    setSharing(true); setError(null); setSuccess(null); setInvite(null); setCopied(false);
    try {
      const res = await createShare({
        owner, type, resourceId, resourceName,
        recipientEmail: target,
        permission: type === 'project' ? permission : 'view',
      });
      if (res.ok) {
        setSuccess(res.pending
          ? `${target} hasn't signed up yet — they'll get access automatically the first time they sign in with that email.`
          : `Shared with ${target}.`);
        setInvite({ email: target.toLowerCase(), pending: !!res.pending });
        setEmail('');
        loadShares();
      } else {
        setError(res.error || 'Could not share.');
      }
    } catch (e: any) {
      console.error('Share failed', e);
      setError(e?.code === 'permission-denied'
        ? "Sharing isn't set up on the server yet — the Firestore security rules need deploying (see README)."
        : e?.message || 'Could not share — please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(buildInvite(invite.email, type, resourceName).text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Clipboard write failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">Share {type === 'timetable' ? 'timetable' : 'project'}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[20rem]">{resourceName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Invite by email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@school.uk"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {type === 'project' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Permission:</span>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as SharePermission)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-slate-700 dark:text-slate-200"
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
              </div>
            )}
            {type === 'timetable' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Shared timetables are read-only and always show your latest version.</p>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs text-primary-600 dark:text-primary-400 flex items-start gap-1"><Check size={14} className="shrink-0 mt-0.5" /> <span>{success}</span></p>}

            {invite && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Let them know — the app doesn't send emails itself:
                </p>
                <div className="flex gap-2">
                  <a
                    href={buildInvite(invite.email, type, resourceName).mailto}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                  >
                    <Send size={13} /> Email them an invite
                  </a>
                  <button
                    onClick={handleCopyInvite}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy invite'}
                  </button>
                </div>
              </div>
            )}

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
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shared with</p>
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                    {s.recipientEmail}
                    {s.recipientUid === null && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 align-middle">
                        Invited — hasn't signed up yet
                      </span>
                    )}
                  </span>
                  {s.type === 'project' && (
                    <select
                      value={s.permission}
                      onChange={async (e) => { await setSharePermission(s, e.target.value as SharePermission); loadShares(); }}
                      className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-slate-700 dark:text-slate-200"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                  )}
                  <button
                    onClick={async () => { await revokeShare(s); loadShares(); }}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
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
