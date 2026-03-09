import re
with open("App.tsx", "r") as f:
    content = f.read()

mock_data = """        setCategories(cats);

        // FORCE ADD MOCK ROUTINES & TASKS FOR VERIFICATION
        const mockRoutines = [
            {
                id: 'mock_routine_1',
                title: 'Check emails',
                type: 'daily',
                priority: 'High',
                createdAt: Date.now()
            },
            {
                id: 'mock_routine_2',
                title: 'Drink water',
                type: 'daily',
                priority: 'Low',
                createdAt: Date.now(),
                lastCompletedDateStr: new Date().toISOString().split('T')[0]
            }
        ];

        const mockTasks = [
            {
                id: 'mock_task_1',
                title: 'Prepare presentation',
                status: 'Not Started',
                priority: 'High',
                scheduledDateStr: new Date().toISOString().split('T')[0]
            },
            {
                id: 'mock_task_2',
                title: 'Grade homework',
                status: 'Completed',
                priority: 'Medium',
                scheduledDateStr: new Date().toISOString().split('T')[0]
            }
        ];

        setRoutineTasks(mockRoutines as RoutineTask[]);
        setGlobalTasks(prev => [...prev, ...mockTasks] as Task[]);"""

content = re.sub(
    r"        setCategories\(cats\);\n        setRoutineTasks\(routines\);",
    mock_data,
    content,
    flags=re.DOTALL
)

with open("App.tsx", "w") as f:
    f.write(content)
