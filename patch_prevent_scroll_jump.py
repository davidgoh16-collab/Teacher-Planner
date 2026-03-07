with open('components/ProjectView.tsx', 'r') as f:
    content = f.read()

content = content.replace("onTaskUpdate: () => void;", "onTaskUpdate?: () => void;\n    onTaskDeleted?: (taskId: string) => void;\n    onTaskUpdated?: (task: Task) => void;")
content = content.replace("export default function ProjectView({ project, allCategories, allTasks, isReadOnly, onBack, onUpdateProject, onTaskUpdate }: ProjectViewProps) {", "export default function ProjectView({ project, allCategories, allTasks, isReadOnly, onBack, onUpdateProject, onTaskUpdate, onTaskDeleted, onTaskUpdated }: ProjectViewProps) {")

# For individual actions
content = content.replace("await deleteTask(taskId);", "await deleteTask(taskId);\n                if (onTaskDeleted) onTaskDeleted(taskId);")
content = content.replace("await saveTask(updatedTask);", "await saveTask(updatedTask);\n            if (onTaskUpdated) onTaskUpdated(updatedTask);")

# For bulk delete, instead of calling onTaskUpdate(), call onTaskDeleted for each
old_bulk_del = """        for (const id of idsToDelete) {
            try { await deleteTask(id); } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }
        onTaskUpdate();"""
new_bulk_del = """        for (const id of idsToDelete) {
            try {
                await deleteTask(id);
                if (onTaskDeleted) onTaskDeleted(id);
            } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }"""
content = content.replace(old_bulk_del, new_bulk_del)

# For bulk complete, call onTaskUpdated for each
old_bulk_comp = """        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try { await saveTask({ ...task, status: 'Completed' as const }); } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }
        onTaskUpdate();"""
new_bulk_comp = """        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try {
                    const updatedTask = { ...task, status: 'Completed' as const };
                    await saveTask(updatedTask);
                    if (onTaskUpdated) onTaskUpdated(updatedTask);
                } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }"""
content = content.replace(old_bulk_comp, new_bulk_comp)

# Also replace handleToggleTaskStatus to call onTaskUpdated instead of onTaskUpdate() (which it doesn't even call now)
content = content.replace("""        try {
            await saveTask(updated);
        }""", """        try {
            await saveTask(updated);
            if (onTaskUpdated) onTaskUpdated(updated);
        }""")

with open('components/ProjectView.tsx', 'w') as f:
    f.write(content)

with open('components/GlobalTasksView.tsx', 'r') as f:
    content = f.read()

content = content.replace("onTaskUpdate: () => void;", "onTaskUpdate?: () => void;\n    onTaskDeleted?: (taskId: string) => void;\n    onTaskUpdated?: (task: Task) => void;")
content = content.replace("export default function GlobalTasksView({ allTasks, projects, categories, isReadOnly, onTaskUpdate }: GlobalTasksViewProps) {", "export default function GlobalTasksView({ allTasks, projects, categories, isReadOnly, onTaskUpdate, onTaskDeleted, onTaskUpdated }: GlobalTasksViewProps) {")

old_bulk_del = """        for (const id of idsToDelete) {
            try { await deleteTask(id); } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }
        onTaskUpdate();"""
new_bulk_del = """        for (const id of idsToDelete) {
            try {
                await deleteTask(id);
                if (onTaskDeleted) onTaskDeleted(id);
            } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }"""
content = content.replace(old_bulk_del, new_bulk_del)

old_bulk_comp = """        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try { await saveTask({ ...task, status: 'Completed' as const }); } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }
        onTaskUpdate();"""
new_bulk_comp = """        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try {
                    const updatedTask = { ...task, status: 'Completed' as const };
                    await saveTask(updatedTask);
                    if (onTaskUpdated) onTaskUpdated(updatedTask);
                } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }"""
content = content.replace(old_bulk_comp, new_bulk_comp)

content = content.replace("onTaskUpdate();", "// onTaskUpdate(); replaced by specific updates below if any")
content = content.replace("""                await deleteTask(taskId);
                // onTaskUpdate(); replaced by specific updates below if any""", """                await deleteTask(taskId);
                if (onTaskDeleted) onTaskDeleted(taskId);""")

content = content.replace("""            await saveTask(updated);
            // onTaskUpdate(); replaced by specific updates below if any""", """            await saveTask(updated);
            if (onTaskUpdated) onTaskUpdated(updated);""")
content = content.replace("""            await saveTask(updatedTask);
            // onTaskUpdate(); replaced by specific updates below if any""", """            await saveTask(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);""")

with open('components/GlobalTasksView.tsx', 'w') as f:
    f.write(content)

with open('components/ProjectPlanner.tsx', 'r') as f:
    content = f.read()

content = content.replace("""                onTaskUpdate={() => { loadData(); }}""", """                onTaskDeleted={(taskId) => {
                    setAllTasks(prev => prev.filter(t => t.id !== taskId));
                }}
                onTaskUpdated={(updatedTask) => {
                    setAllTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                }}""")

content = content.replace("""            onTaskUpdate={() => {
        loadData();
    }}""", """            onTaskDeleted={(taskId) => {
                setAllTasks(prev => prev.filter(t => t.id !== taskId));
            }}
            onTaskUpdated={(updatedTask) => {
                setAllTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            }}""")

with open('components/ProjectPlanner.tsx', 'w') as f:
    f.write(content)
