import React, { useState, useEffect } from 'react';
import { AppItem } from '../types';
import * as LucideIcons from 'lucide-react';
import { X, Save, Trash2, Image, LayoutGrid, Check } from 'lucide-react';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AppItem;
  onSave: (app: AppItem) => void;
  onDelete: (id: string) => void;
  isReadOnly: boolean;
}

const PRESET_ICONS = [
  'Globe', 'Mail', 'Calendar', 'Briefcase', 'Book', 'BookOpen', 'FileText', 'Folder',
  'MessageSquare', 'Phone', 'Video', 'Camera', 'Music', 'Map', 'Navigation', 'Compass',
  'PenTool', 'Edit', 'Scissors', 'Code', 'Terminal', 'Cpu', 'Database', 'HardDrive',
  'Monitor', 'Smartphone', 'Tablet', 'Watch', 'Cloud', 'CloudLightning', 'CloudRain',
  'Sun', 'Moon', 'Star', 'Heart', 'Award', 'Shield', 'Lock', 'Key', 'Settings',
  'Wrench', 'Hammer', 'Tool', 'ShoppingCart', 'CreditCard', 'DollarSign', 'Percent',
  'Activity', 'TrendingUp', 'BarChart', 'PieChart', 'User', 'Users', 'Home', 'Building'
];

const AppModal: React.FC<AppModalProps> = ({ isOpen, onClose, initialData, onSave, onDelete, isReadOnly }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [iconType, setIconType] = useState<'preset' | 'imageUrl'>(initialData?.iconType || 'preset');
  const [iconValue, setIconValue] = useState(initialData?.iconValue || 'Globe');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setUrl(initialData.url);
      setIconType(initialData.iconType);
      setIconValue(initialData.iconValue);
    } else {
      setName('');
      setUrl('');
      setIconType('preset');
      setIconValue('Globe');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !name.trim() || !url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    const appItem: AppItem = {
      id: initialData?.id || `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      url: finalUrl,
      iconType,
      iconValue: iconValue.trim() || 'Globe',
      createdAt: initialData?.createdAt || Date.now(),
    };

    onSave(appItem);
    onClose();
  };

  const handleDelete = () => {
      if (initialData && !isReadOnly) {
          onDelete(initialData.id);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <LayoutGrid className="text-green-600 dark:text-green-400" />
              {initialData ? 'Edit App' : 'Add New App'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
          {/* Name & URL */}
          <div className="grid grid-cols-1 gap-5">
              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">App Name *</label>
                  <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. Google Drive"
                      autoFocus
                  />
              </div>

              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL (Link) *</label>
                  <input
                      type="text"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. https://drive.google.com"
                  />
              </div>
          </div>

          {/* Icon Selection */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Icon Choice</label>

              <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${iconType === 'preset' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input type="radio" name="iconType" value="preset" checked={iconType === 'preset'} onChange={() => setIconType('preset')} className="hidden" />
                      <LayoutGrid size={18} />
                      <span className="font-medium text-sm">Preset Icon</span>
                  </label>

                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${iconType === 'imageUrl' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input type="radio" name="iconType" value="imageUrl" checked={iconType === 'imageUrl'} onChange={() => setIconType('imageUrl')} className="hidden" />
                      <Image size={18} />
                      <span className="font-medium text-sm">Image URL</span>
                  </label>
              </div>

              {iconType === 'preset' ? (
                  <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 h-48 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-6 gap-2">
                          {PRESET_ICONS.map(iconName => {
                              const IconComponent = (LucideIcons as any)[iconName];
                              if (!IconComponent) return null;

                              const isSelected = iconValue === iconName;
                              return (
                                  <button
                                      key={iconName}
                                      type="button"
                                      onClick={() => setIconValue(iconName)}
                                      className={`p-2 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-green-600 text-white shadow-md scale-110' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
                                      title={iconName}
                                  >
                                      <IconComponent size={20} />
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              ) : (
                  <div className="mt-4">
                      <input
                          type="text"
                          value={iconValue}
                          onChange={(e) => setIconValue(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          placeholder="https://example.com/icon.png"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Provide a direct link to an image (PNG, JPG, SVG, etc.). For best results, use a square image.</p>
                  </div>
              )}
          </div>

          </div>

          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
            {initialData && !isReadOnly ? (
                <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Trash2 size={16} /> Delete
                </button>
            ) : <div />}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!name.trim() || !url.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <Save size={16} /> Save App
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppModal;