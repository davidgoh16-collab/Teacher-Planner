import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { fetchCategories, saveCategory, deleteCategory, fetchProjects, saveProject, deleteProject } from '../services/projectService';
import { Project } from '../types';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { getContrastTextColor, CATEGORY_COLORS } from '../utils/colorUtils';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly: boolean;
  onCategoriesUpdated?: () => void;
}

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose, isReadOnly, onCategoriesUpdated }) => {
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

      if (newCatType === 'project') {
        const generalProject: Project = {
          id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${newCategory.name} General Tasks`,
          description: `General tasks for the ${newCategory.name} category.`,
          categoryId: newCategory.id,
          colorClass: newCategory.colorClass,
          links: [],
          tasks: [],
          createdAt: Date.now()
        };
        await saveProject(generalProject);
        if (onCategoriesUpdated) onCategoriesUpdated();
      } else {
        if (onCategoriesUpdated) onCategoriesUpdated();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (isReadOnly) return;

    if (window.confirm("Are you sure you want to delete this category? This will also delete its General Tasks project. (Other existing items will keep the ID but lose the display name/color)")) {
      try {
        const cats = categories.find(c => c.id === id);

        // Delete the category
        await deleteCategory(id);
        setCategories(categories.filter(c => c.id !== id));

        // If it was a project category, find and delete the associated "General Tasks" project
        if (cats && cats.type === 'project') {
          const allProjects = await fetchProjects();
          const generalProject = allProjects.find(p => p.categoryId === id && p.name === `${cats.name} General Tasks`);
          if (generalProject) {
            await deleteProject(generalProject.id);
          }
        }
        if (onCategoriesUpdated) onCategoriesUpdated();
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

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
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="e.g. Extra-curricular"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value as 'project' | 'task')}
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                          className={`w-8 h-8 rounded-full border-2 ${color.class.split(' ')[0]} ${newCatColor === color.class ? 'ring-2 ring-offset-2 ring-primary-500 border-transparent dark:ring-offset-slate-900' : 'border-transparent opacity-80 hover:opacity-100'}`}
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${cat.colorClass} ${getContrastTextColor(cat.colorClass)}`}>
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