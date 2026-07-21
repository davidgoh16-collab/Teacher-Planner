import React, { useState, useEffect } from 'react';
import { AppCategory } from '../types';
import { fetchAppCategories, saveAppCategory, deleteAppCategory } from '../services/appService';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { TIMETABLE_PALETTE, mapLegacyColor } from '../utils/timetablePalette';

interface ManageAppCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly: boolean;
}

// Category colours use the same curated earth-tone palette as the timetable,
// so Apps Hub stays on-theme (see utils/timetablePalette.ts).
const CATEGORY_COLORS = TIMETABLE_PALETTE.map(c => ({ label: c.name, class: c.chipClass, hex: c.hex }));

const ManageAppCategoriesModal: React.FC<ManageAppCategoriesModalProps> = ({ isOpen, onClose, isReadOnly }) => {
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0].class);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await fetchAppCategories();
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newCatName.trim()) return;

    const newCategory: AppCategory = {
      id: `appcat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newCatName.trim(),
      colorClass: newCatColor
    };

    try {
      await saveAppCategory(newCategory);
      setCategories([...categories, newCategory]);
      setNewCatName('');
      setNewCatColor(CATEGORY_COLORS[0].class);
    } catch (e) {
      console.error(e);
      alert("Failed to save app category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (isReadOnly) return;

    if (window.confirm("Are you sure you want to delete this category? (Apps will keep their references to the deleted category but it will no longer show up)")) {
      try {
        await deleteAppCategory(id);
        setCategories(categories.filter(c => c.id !== id));
      } catch (e) {
        console.error(e);
        alert("Failed to delete app category.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Manage App Categories</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-8">

              {!isReadOnly && (
                <form onSubmit={handleAddCategory} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Add New Category</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g. Planning Tools"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_COLORS.map(color => (
                        <button
                          key={color.class}
                          type="button"
                          onClick={() => setNewCatColor(color.class)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 ${newCatColor === color.class ? 'ring-2 ring-offset-2 ring-primary-500 border-transparent dark:ring-offset-slate-900' : 'border-transparent opacity-80 hover:opacity-100'}`}
                          style={{ backgroundColor: color.hex }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Plus size={16} /> Add Category
                    </button>
                  </div>
                </form>
              )}

              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">App Categories</h3>
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No app categories defined.</p>
                ) : (
                  <ul className="space-y-2">
                    {categories.map(cat => (
                      <li key={cat.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${mapLegacyColor(cat.colorClass)}`}>
                          {cat.name}
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ManageAppCategoriesModal;
