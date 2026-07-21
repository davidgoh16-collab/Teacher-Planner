import React, { useState } from 'react';
import { AppItem, AppCategory } from '../types';
import AppModal from './AppModal';
import ManageAppCategoriesModal from './ManageAppCategoriesModal';
import { Plus, LayoutGrid, Settings, Search, Folder, Star } from 'lucide-react';
import IconRenderer from './ui/IconRenderer';

interface AppsHubProps {
  isReadOnly: boolean;
  apps: AppItem[];
  categories: AppCategory[];
  onSaveApp: (app: AppItem) => void;
  onDeleteApp: (id: string) => void;
  onRefreshCategories: () => void;
}

const AppsHub: React.FC<AppsHubProps> = ({ isReadOnly, apps, categories, onSaveApp, onDeleteApp, onRefreshCategories }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | undefined>(undefined);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

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

  const toggleFavourite = (e: React.MouseEvent, app: AppItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    onSaveApp({ ...app, isFavourite: !app.isFavourite });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-8 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <LayoutGrid className="text-primary-600 dark:text-primary-400" />
                Apps Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your central hub for quick access to other tools. Pin favourites with the star to surface them on Home.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Search apps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-full md:w-64"
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
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isReadOnly}
            >
                <Plus size={16} /> Add App
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
          {apps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-4">
                  <LayoutGrid size={48} className="opacity-20" />
                  <p>No apps added yet.</p>
                  <button
                      onClick={handleOpenNewAppModal}
                      className="text-primary-600 hover:underline disabled:opacity-50 disabled:no-underline"
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
                    const groups = new Map<string, AppItem[]>();
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
                                            {/* Favourite toggle */}
                                            {!isReadOnly && (
                                                <button
                                                    onClick={(e) => toggleFavourite(e, app)}
                                                    className={`absolute top-2 left-2 p-1.5 rounded-full transition-all z-10 shadow-md ${app.isFavourite ? 'opacity-100 bg-amber-100 text-amber-500 dark:bg-amber-900/40' : 'opacity-0 group-hover:opacity-100 bg-slate-800 dark:bg-slate-700 text-white hover:bg-amber-500'}`}
                                                    title={app.isFavourite ? 'Unpin from favourites' : 'Pin to favourites'}
                                                >
                                                    <Star size={14} fill={app.isFavourite ? 'currentColor' : 'none'} />
                                                </button>
                                            )}

                                            {/* Edit Button overlay */}
                                            <button
                                                onClick={(e) => handleOpenEditModal(e, app)}
                                                className={`absolute top-2 right-2 bg-slate-800 dark:bg-slate-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-primary-600 shadow-md ${isReadOnly ? 'hidden' : ''}`}
                                            >
                                                <Settings size={14} />
                                            </button>

                                            {/* App Icon */}
                                            <div className="relative rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-0.5">
                                                <IconRenderer app={app} size={32} className="w-16 h-16" />
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

      {isModalOpen && (
          <AppModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              initialData={editingApp}
              onSave={onSaveApp}
              onDelete={onDeleteApp}
              isReadOnly={isReadOnly}
              categories={categories}
          />
      )}

      {isCategoriesModalOpen && (
          <ManageAppCategoriesModal
              isOpen={isCategoriesModalOpen}
              onClose={() => {
                  setIsCategoriesModalOpen(false);
                  onRefreshCategories(); // reload to get any new categories
              }}
              isReadOnly={isReadOnly}
          />
      )}
    </div>
  );
};

export default AppsHub;
