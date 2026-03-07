import re

with open('components/ProjectView.tsx', 'r') as f:
    content = f.read()

# Fix the toggleTaskSelection function so it doesn't preventDefault
old_toggle = """    const toggleTaskSelection = (taskId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newSelection = new Set(selectedTaskIds);"""

new_toggle = """    const toggleTaskSelection = (taskId: string, e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation();
        const newSelection = new Set(selectedTaskIds);"""

content = content.replace(old_toggle, new_toggle)

with open('components/ProjectView.tsx', 'w') as f:
    f.write(content)

with open('components/GlobalTasksView.tsx', 'r') as f:
    content = f.read()

content = content.replace(old_toggle, new_toggle)

with open('components/GlobalTasksView.tsx', 'w') as f:
    f.write(content)
