import React, { useState } from 'react';
import AppsHub from '../components/AppsHub';
import { AppItem, AppCategory } from '../types';

// Standalone harness for AppsHub (controlled component) backed by local state.
const TestAppsHub = () => {
    const [apps, setApps] = useState<AppItem[]>([]);
    const [categories] = useState<AppCategory[]>([]);

    const handleSaveApp = (app: AppItem) => {
        setApps(prev => {
            const exists = prev.find(a => a.id === app.id);
            return exists ? prev.map(a => a.id === app.id ? app : a) : [app, ...prev];
        });
    };

    return (
        <AppsHub
            isReadOnly={false}
            apps={apps}
            categories={categories}
            onSaveApp={handleSaveApp}
            onDeleteApp={(id) => setApps(prev => prev.filter(a => a.id !== id))}
            onRefreshCategories={() => {}}
        />
    );
};

export default TestAppsHub;
