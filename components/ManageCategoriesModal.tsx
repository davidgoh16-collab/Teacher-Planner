import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { fetchCategories, saveCategory, deleteCategory } from '../services/projectService';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly: boolean;
}

const CATEGORY_COLORS = [
  { label: 'Gray', class: 'bg-gray-100 text-gray-800 border-gray-300' },
  { label: 'Red', class: 'bg-red-100 text-red-800 border-red-300' },
  { label: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-300' },
  { label: 'Amber', class: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { label: 'Lime', class: 'bg-lime-100 text-lime-800 border-lime-300' },
  { label: 'Green', class: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'Emerald', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: 'Teal', class: 'bg-teal-100 text-teal-800 border-teal-300' },
  { label: 'Cyan', class: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { label: 'Sky', class: 'bg-sky-100 text-sky-800 border-sky-300' },
  { label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { label: 'Indigo', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { label: 'Violet', class: 'bg-violet-100 text-violet-800 border-violet-300' },
  { label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { label: 'Fuchsia', class: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { label: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-300' },
  { label: 'Rose', class: 'bg-rose-100 text-rose-800 border-rose-300' }
];

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose, isReadOnly }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0].class);
  const [newCatType, setNewCatType] = useState<'project' | 'task'>('project');

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await fetchCategories();
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

    const newCategory: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newCatName.trim(),
      colorClass: newCatColor,
      type: newCatType
    };

    try {
      await saveCategory(newCategory);
      setCategories([...categories, newCategory]);
      setNewCatName('');
      setNewCatColor(CATEGORY_COLORS[0].class);
    } catch (e) {
      console.error(e);
      alert("Failed to save category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (isReadOnly) return;

    if (window.confirm("Are you sure you want to delete this category? (Existing items will keep the ID but lose the display name/color)")) {
      try {
        await deleteCategory(id);
        setCategories(categories.filter(c => c.id !== id));
      } catch (e) {
        console.error(e);
        alert("Failed to delete category.");
      }
    }
  };

  if (!isOpen) return null;

  const projectCats = categories.filter(c => c.type === 'project');
  const taskCats = categories.filter(c => c.type === 'task');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Manage Categories</h2>
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
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : (
            <div className="space-y-8">

              {!isReadOnly && (
                <form onSubmit={handleAddCategory} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Add New Category</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                      <input
                        type="text"
                        required
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        placeholder="e.g. Extra-curricular"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value as 'project' | 'task')}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      >
                        <option value="project">Project Category</option>
                        <option value="task">Task Category</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_COLORS.map(color => (
                        <button
                          key={color.class}
                          type="button"
                          onClick={() => setNewCatColor(color.class)}
                          className={`w-8 h-8 rounded-full border-2 ${color.class.split(' ')[0]} ${newCatColor === color.class ? 'ring-2 ring-offset-2 ring-green-500 border-transparent dark:ring-offset-slate-900' : 'border-transparent opacity-80 hover:opacity-100'}`}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Plus size={16} /> Add Category
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Project Categories */}
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Project Categories</h3>
                  {projectCats.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No project categories defined.</p>
                  ) : (
                    <ul className="space-y-2">
                      {projectCats.map(cat => (
                        <li key={cat.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${cat.colorClass}`}>
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

                {/* Task Categories */}
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Task Categories</h3>
                  {taskCats.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No task categories defined.</p>
                  ) : (
                    <ul className="space-y-2">
                      {taskCats.map(cat => (
                        <li key={cat.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${cat.colorClass}`}>
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

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ManageCategoriesModal;