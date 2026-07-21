import React, { useState, useEffect, useRef } from 'react';
import { Search, Briefcase, Calendar as CalendarIcon, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { Task, Project, LessonPlan } from '../types';

interface GlobalSearchProps {
  globalTasks: Task[];
  projects: Project[];
  lessonPlans: Record<string, LessonPlan>;
  onTaskSelect: (task: Task) => void;
  onProjectSelect: (project: Project) => void;
  onLessonSelect: (lesson: LessonPlan) => void;
}

type SearchResult =
  | { type: 'task'; item: Task; score: number }
  | { type: 'project'; item: Project; score: number }
  | { type: 'lesson'; item: LessonPlan; score: number };

export default function GlobalSearch({
  globalTasks,
  projects,
  lessonPlans,
  onTaskSelect,
  onProjectSelect,
  onLessonSelect
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search Tasks (including subtasks)
    const allTasksAndSubtasks = globalTasks.flatMap(task => [
        task,
        ...(task.subtasks || []).map(st => ({
            ...st,
            _isSubtaskDisplay: true,
            _parentTaskId: task.id,
            _parentTaskTitle: task.title,
            projectId: task.projectId
        } as Task))
    ]);

    allTasksAndSubtasks.forEach(task => {
      if (task.title.toLowerCase().includes(lowerQuery) || (task.description && task.description.toLowerCase().includes(lowerQuery))) {
          searchResults.push({ type: 'task', item: task, score: 0 });
      }
    });

    // Search Projects
    projects.forEach(project => {
      if (project.name.toLowerCase().includes(lowerQuery) || (project.description && project.description.toLowerCase().includes(lowerQuery))) {
          searchResults.push({ type: 'project', item: project, score: 0 });
      }
    });

    // Search Lesson Plans
    Object.values(lessonPlans).forEach(lesson => {
      if (lesson.title.toLowerCase().includes(lowerQuery) || (lesson.notes && lesson.notes.toLowerCase().includes(lowerQuery))) {
          searchResults.push({ type: 'lesson', item: lesson, score: 0 });
      }
    });

    setResults(searchResults.slice(0, 10)); // Limit to 10 results
  }, [query, globalTasks, projects, lessonPlans]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');

    if (result.type === 'task') {
      onTaskSelect(result.item);
    } else if (result.type === 'project') {
      onProjectSelect(result.item);
    } else if (result.type === 'lesson') {
      onLessonSelect(result.item);
    }
  };

  return (
    <div className="relative group w-full md:w-64 lg:w-80 lg:mx-4 shrink-0" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:outline-none shadow-sm transition-all"
          placeholder="Search everywhere..."
          value={query}
          onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
          }}
          onFocus={() => {
              if (query.trim()) setIsOpen(true);
          }}
        />
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 z-50 max-h-[60vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          ) : (
            <ul className="py-2">
              {results.map((result, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => handleSelect(result)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-start gap-3 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      {result.type === 'task' && <Clock size={16} className="text-amber-500" />}
                      {result.type === 'project' && <Briefcase size={16} className="text-blue-500" />}
                      {result.type === 'lesson' && <BookOpen size={16} className="text-primary-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {result.type === 'task' ? (result.item as Task).title : result.type === 'project' ? (result.item as Project).name : (result.item as LessonPlan).title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                        {result.type}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
