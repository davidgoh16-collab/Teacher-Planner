import React, { useState, useEffect } from 'react';
import { AppItem, AppCategory } from '../types';
import * as LucideIcons from 'lucide-react';
import { X, Save, Trash2, Image, LayoutGrid, Check } from 'lucide-react';
import { TIMETABLE_PALETTE, mapLegacyColor } from '../utils/timetablePalette';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AppItem;
  onSave: (app: AppItem) => void;
  onDelete: (id: string) => void;
  isReadOnly: boolean;
  categories: AppCategory[];
}

// Icon colours use the same curated earth-tone palette as the timetable, so
// Apps Hub stays on-theme (see utils/timetablePalette.ts).
const APP_BG_COLORS = TIMETABLE_PALETTE.map(c => ({ label: c.name, class: c.chipClass, hex: c.hex }));

const PRESET_ICONS = [
  'Globe', 'Mail', 'Calendar', 'Briefcase', 'Book', 'BookOpen', 'FileText', 'Folder',
  'MessageSquare', 'Phone', 'Video', 'Camera', 'Music', 'Map', 'Navigation', 'Compass',
  'PenTool', 'Edit', 'Scissors', 'Code', 'Terminal', 'Cpu', 'Database', 'HardDrive',
  'Monitor', 'Smartphone', 'Tablet', 'Watch', 'Cloud', 'CloudLightning', 'CloudRain',
  'Sun', 'Moon', 'Star', 'Heart', 'Award', 'Shield', 'Lock', 'Key', 'Settings',
  'Wrench', 'Hammer', 'Tool', 'ShoppingCart', 'CreditCard', 'DollarSign', 'Percent',
  'Activity', 'TrendingUp', 'BarChart', 'PieChart', 'User', 'Users', 'Home', 'Building'
];

const AppModal: React.FC<AppModalProps> = ({ isOpen, onClose, initialData, onSave, onDelete, isReadOnly, categories }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [iconType, setIconType] = useState<'preset' | 'imageUrl'>(initialData?.iconType || 'preset');
  const [iconValue, setIconValue] = useState(initialData?.iconValue || 'Globe');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [colorClass, setColorClass] = useState(mapLegacyColor(initialData?.colorClass) || APP_BG_COLORS[0].class);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setUrl(initialData.url);
      setIconType(initialData.iconType);
      setIconValue(initialData.iconValue);
      setCategoryId(initialData.categoryId || '');
      setColorClass(mapLegacyColor(initialData.colorClass) || APP_BG_COLORS[0].class);
    } else {
      setName('');
      setUrl('');
      setIconType('preset');
      setIconValue('Globe');
      setCategoryId('');
      setColorClass(APP_BG_COLORS[0].class);
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
      categoryId: categoryId || undefined,
      colorClass: colorClass,
      isFavourite: initialData?.isFavourite,
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <LayoutGrid className="text-primary-600 dark:text-primary-400" />
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

          <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Name & URL */}
          <div className="grid grid-cols-1 gap-5">
              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">App Name *</label>
                  <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g. https://drive.google.com"
                  />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">None (Uncategorized)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
          </div>

          {/* Icon Selection */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Icon Choice</label>

              <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${iconType === 'preset' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input type="radio" name="iconType" value="preset" checked={iconType === 'preset'} onChange={() => setIconType('preset')} className="hidden" />
                      <LayoutGrid size={18} />
                      <span className="font-medium text-sm">Preset Icon</span>
                  </label>

                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${iconType === 'imageUrl' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
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
                                      className={`p-2 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-primary-600 text-white shadow-md scale-110' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
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
                          className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="https://example.com/icon.png"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Provide a direct link to an image (PNG, JPG, SVG, etc.). For best results, use a square image.</p>
                  </div>
              )}
          </div>

          {/* App Background Color Selection */}
          <div className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">App Background Color</label>
            <div className="flex flex-wrap gap-2">
              {APP_BG_COLORS.map(color => (
                <button
                  key={color.class}
                  type="button"
                  onClick={(e) => { e.preventDefault(); setColorClass(color.class); }}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 ${colorClass === color.class ? 'ring-2 ring-offset-2 ring-primary-500 border-transparent dark:ring-offset-slate-900' : 'border-transparent opacity-80 hover:opacity-100'}`}
                  style={{ backgroundColor: color.hex }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          </div>

          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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