import fs from 'fs';
let content = fs.readFileSync('components/AppsHub.tsx', 'utf-8');

// Imports
content = content.replace(
  "import { AppItem } from '../types';",
  "import { AppItem, AppCategory } from '../types';"
);
content = content.replace(
  "import { fetchApps, saveApp, deleteApp } from '../services/appService';",
  "import { fetchApps, saveApp, deleteApp, fetchAppCategories } from '../services/appService';"
);
content = content.replace(
  "import AppModal from './AppModal';",
  "import AppModal from './AppModal';\nimport ManageAppCategoriesModal from './ManageAppCategoriesModal';"
);
content = content.replace(
  "import { Plus, LayoutGrid, Settings } from 'lucide-react';",
  "import { Plus, LayoutGrid, Settings, Search, Folder } from 'lucide-react';"
);

// State
content = content.replace(
  "  const [loading, setLoading] = useState(true);",
  "  const [loading, setLoading] = useState(true);\n  const [categories, setCategories] = useState<AppCategory[]>([]);\n  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);\n  const [searchQuery, setSearchQuery] = useState('');"
);

// Load Data
content = content.replace(
  "      const fetchedApps = await fetchApps();\n      setApps(fetchedApps);",
  "      const [fetchedApps, fetchedCategories] = await Promise.all([\n        fetchApps(),\n        fetchAppCategories()\n      ]);\n      setApps(fetchedApps);\n      setCategories(fetchedCategories);"
);

// Render Icon
content = content.replace(
  "    const IconComponent = (LucideIcons as any)[app.iconValue] || LucideIcons.Globe;\n    return (\n        <div className=\"w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700\">\n             <IconComponent size={32} className=\"text-slate-600 dark:text-slate-300\" />\n        </div>\n    );",
  "    const IconComponent = (LucideIcons as any)[app.iconValue] || LucideIcons.Globe;\n    return (\n        <div className={`w-16 h-16 ${app.colorClass || 'bg-white text-slate-800 border-slate-100'} rounded-2xl flex items-center justify-center shadow-sm border`}>\n             <IconComponent size={32} className={app.colorClass ? 'opacity-80' : 'text-slate-600 dark:text-slate-300'} />\n        </div>\n    );"
);

fs.writeFileSync('components/AppsHub.tsx', content);
