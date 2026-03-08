import { Task } from '../types';

export const handleTaskRecurrence = (task: Task): Task => {
    if (task.status !== 'Completed') return task;
    if (!task.recurrenceType) return task;

    let nextScheduledDate: Date | null = null;
    let nextDeadlineDate: Date | null = null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calculate dates relative to today, as completed usually means done today
    let baseDate = now;

    if (task.recurrenceType === 'daily') {
        baseDate.setDate(baseDate.getDate() + 1);
        nextScheduledDate = new Date(baseDate);
    } else if (task.recurrenceType === 'weekly' && task.recurrenceDays && task.recurrenceDays.length > 0) {
        // Find the next scheduled day
        let minDays = 7;
        const todayDay = baseDate.getDay();
        for (const day of task.recurrenceDays) {
            let diff = day - todayDay;
            if (diff <= 0) diff += 7; // strictly in the future
            if (diff < minDays) minDays = diff;
        }
        baseDate.setDate(baseDate.getDate() + minDays);
        nextScheduledDate = new Date(baseDate);
    }

    if (!nextScheduledDate) return task;

    // Calculate the gap between original scheduled and deadline dates if both exist
    if (task.scheduledDateStr && task.deadlineDateStr) {
        const origScheduled = new Date(task.scheduledDateStr);
        const origDeadline = new Date(task.deadlineDateStr);
        // Only calculate gap if both dates are valid
        if (!isNaN(origScheduled.getTime()) && !isNaN(origDeadline.getTime())) {
            const gap = origDeadline.getTime() - origScheduled.getTime();
            nextDeadlineDate = new Date(nextScheduledDate.getTime() + gap);
        }
    } else if (task.deadlineDateStr && !task.scheduledDateStr) {
        // If there's only a deadline, bump the deadline instead
         if (task.recurrenceType === 'daily') {
             const d = new Date(task.deadlineDateStr);
             if (!isNaN(d.getTime())) {
                 d.setDate(d.getDate() + 1);
                 nextDeadlineDate = d;
             }
         } else if (task.recurrenceType === 'weekly' && task.recurrenceDays && task.recurrenceDays.length > 0) {
             const d = new Date(task.deadlineDateStr);
             if (!isNaN(d.getTime())) {
                 let minDays = 7;
                 const todayDay = now.getDay(); // Use today to calculate next occurrence relative to now
                 for (const day of task.recurrenceDays) {
                    let diff = day - todayDay;
                    if (diff <= 0) diff += 7;
                    if (diff < minDays) minDays = diff;
                 }
                 d.setDate(d.getDate() + minDays);
                 nextDeadlineDate = d;
             }
         }
    }

    const formatDate = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    return {
        ...task,
        status: 'Uncompleted',
        completedAt: undefined,
        scheduledDateStr: nextScheduledDate ? formatDate(nextScheduledDate) : task.scheduledDateStr,
        deadlineDateStr: nextDeadlineDate ? formatDate(nextDeadlineDate) : task.deadlineDateStr,
    };
};
