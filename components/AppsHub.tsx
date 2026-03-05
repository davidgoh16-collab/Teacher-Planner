import React, { useState, useEffect } from 'react';
import { AppItem, AppCategory } from '../types';
import { fetchApps, saveApp, deleteApp, fetchAppCategories } from '../services/appService';
import AppModal from './AppModal';
import ManageAppCategoriesModal from './ManageAppCategoriesModal';
import { Plus, LayoutGrid, Settings, Search, Folder } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface AppsHubProps {
  isReadOnly: boolean;
}

const AppsHub: React.FC<AppsHubProps> = ({ isReadOnly }) => {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedApps, fetchedCategories] = await Promise.all([
        fetchApps(),
        fetchAppCategories()
      ]);
      setApps(fetchedApps);
      setCategories(fetchedCategories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewAppModal = () => {
    setEditingApp(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, app: AppItem) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleSaveApp = async (app: AppItem) => {
    if (isReadOnly) return;

    // Optimistic Update
    setApps(prev => {
        const exists = prev.find(a => a.id === app.id);
        if (exists) return prev.map(a => a.id === app.id ? app : a);
        return [app, ...prev];
    });

    try {
        await saveApp(app);
    } catch (e) {
        console.error("Failed to save app", e);
        // Re-fetch to correct state on error
        loadData();
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (isReadOnly) return;

    if (window.confirm("Are you sure you want to delete this app?")) {
        // Optimistic update
        setApps(prev => prev.filter(a => a.id !== id));
        try {
            await deleteApp(id);
        } catch (e) {
            console.error("Failed to delete app", e);
            // Re-fetch
            loadData();
        }
    }
  };

  const renderIcon = (app: AppItem) => {
    if (app.iconType === 'imageUrl' && app.iconValue) {
        return (
            <img
                src={app.iconValue}
                alt={`${app.name} icon`}
                className="w-16 h-16 object-cover rounded-xl"
                onError={(e) => {
                    // Fallback to globe if image fails
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
            />
        );
    }

    // Preset Icon
    const IconComponent = (LucideIcons as any)[app.iconValue] || LucideIcons.Globe;
    return (
        <div className={`w-16 h-16 ${app.colorClass || 'bg-white text-slate-800 border-slate-100'} rounded-2xl flex items-center justify-center shadow-sm border`}>
             <IconComponent size={32} className={app.colorClass ? 'opacity-80' : 'text-slate-600 dark:text-slate-300'} />
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 p-4 md:p-8 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <LayoutGrid className="text-green-600 dark:text-green-400" />
                Apps Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your central hub for quick access to other tools.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Search apps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500 w-full md:w-64"
                />
            </div>

            {!isReadOnly && (
                <button
                    onClick={() => setIsCategoriesModalOpen(true)}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
                >
                    <Folder size={16} /> Categories
                </button>
            )}

            <button
                onClick={handleOpenNewAppModal}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
                disabled={isReadOnly}
            >
                <Plus size={16} /> Add App
            </button>
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
      ) : (
          <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
              {apps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-4">
                      <LayoutGrid size={48} className="opacity-20" />
                      <p>No apps added yet.</p>
                      <button
                          onClick={handleOpenNewAppModal}
                          className="text-green-600 hover:underline"
                          disabled={isReadOnly}
                      >
                          Add your first app
                      </button>
                  </div>
              ) : (
                  <div className="space-y-8">
                    {(() => {
                        const filteredApps = apps.filter(app => {
                            const searchLower = searchQuery.toLowerCase();
                            const categoryName = categories.find(c => c.id === app.categoryId)?.name || '';
                            return app.name.toLowerCase().includes(searchLower) ||
                                   app.url.toLowerCase().includes(searchLower) ||
                                   categoryName.toLowerCase().includes(searchLower);
                        });

                        if (filteredApps.length === 0) {
                            return (
                                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                                    No apps found matching "{searchQuery}"
                                </div>
                            );
                        }

                        // Group apps
                        const groups = new Map<string, typeof apps>();
                        groups.set('uncategorized', []);
                        categories.forEach(c => groups.set(c.id, []));

                        filteredApps.forEach(app => {
                            if (app.categoryId && groups.has(app.categoryId)) {
                                groups.get(app.categoryId)!.push(app);
                            } else {
                                groups.get('uncategorized')!.push(app);
                            }
                        });

                        return Array.from(groups.entries()).map(([catId, catApps]) => {
                            if (catApps.length === 0) return null;
                            const category = categories.find(c => c.id === catId);

                            return (
                                <div key={catId} className="space-y-4">
                                    {category && (
                                        <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full border ${category.colorClass.split(' ')[0]} ${category.colorClass.split(' ')[2]}`}></span>
                                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{category.name}</h2>
                                        </div>
                                    )}
                                    {catId === 'uncategorized' && groups.size > 1 && (
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full border bg-slate-200 border-slate-300"></span>
                                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Other</h2>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6 justify-items-center">
                                        {catApps.map(app => (
                                            <a
                                                key={app.id}
                                                href={app.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative flex flex-col items-center gap-3 w-24 hover:-translate-y-1 transition-transform duration-200"
                                                title={app.name}
                                            >
                                                {/* Edit Button overlay */}
                                                <button
                                                    onClick={(e) => handleOpenEditModal(e, app)}
                                                    className={`absolute top-2 right-2 bg-slate-800 dark:bg-slate-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-green-600 shadow-md ${isReadOnly ? 'hidden' : ''}`}
                                                >
                                                    <Settings size={14} />
                                                </button>

                                                {/* App Icon */}
                                                <div className="relative rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-0.5">
                                                    {renderIcon(app)}
                                                    <LucideIcons.Globe size={32} className="hidden absolute inset-0 m-auto text-slate-400" />
                                                </div>

                                                {/* App Name */}
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center line-clamp-2 leading-tight px-1">
                                                    {app.name}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                  </div>
              )}
          </div>
      )}

      {isModalOpen && (
          <AppModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              initialData={editingApp}
              onSave={handleSaveApp}
              onDelete={handleDeleteApp}
              isReadOnly={isReadOnly}
              categories={categories}
          />
      )}

      {isCategoriesModalOpen && (
          <ManageAppCategoriesModal
              isOpen={isCategoriesModalOpen}
              onClose={() => {
                  setIsCategoriesModalOpen(false);
                  loadData(); // reload to get any new categories
              }}
              isReadOnly={isReadOnly}
          />
      )}
    </div>
  );
};

export default AppsHub;