import { Type, FunctionDeclaration } from "@google/genai";
import { DAYS } from "../constants";

/**
 * Single source of truth for the planner's mutating tools.
 *
 * These declarations were previously defined inline inside `handleAiSendMessage` in App.tsx.
 * They are shared by two consumers:
 *   - the v1 Gemini chat (`ai.chats.create`), which expects the Gemini `Type.*` enum format, and
 *   - the Antigravity managed agent (REST Interactions API), which expects lowercase JSON Schema
 *     (`{ type: "object", ... }`) wrapped as `{ type: "function", name, description, parameters }`.
 *
 * Keep the two in sync by only editing the Gemini declarations below; the agent format is derived
 * automatically via `geminiDeclToJsonSchema`.
 */

export const updateLessonTool: FunctionDeclaration = {
  name: 'updateLesson',
  description: 'Add or update a single lesson plan or meeting for a specific date.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dateStr: { type: Type.STRING, description: 'YYYY-MM-DD format.' },
      periodLabel: { type: Type.STRING, description: 'Exact period label, e.g., "Period 2".' },
      type: { type: Type.STRING, enum: ['lesson', 'meeting'], description: 'Defaults to lesson.' },
      title: { type: Type.STRING },
      notes: { type: Type.STRING },
      links: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['dateStr', 'periodLabel', 'title'],
  },
};

export const addRecurringLessonTool: FunctionDeclaration = {
  name: 'addRecurringLesson',
  description: 'Add a lesson or meeting repeatedly (e.g., every Monday, every Week 1 Friday) for the entire academic year (all terms).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dayOfWeek: { type: Type.STRING, enum: DAYS, description: 'Monday, Tuesday, Wednesday, Thursday, or Friday' },
      periodLabel: { type: Type.STRING, description: 'Exact period label, e.g., "Period 1"' },
      title: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['lesson', 'meeting'] },
      weekCycle: { type: Type.STRING, enum: ['all', 'week1', 'week2'], description: 'Apply to all weeks, only Week 1s, or only Week 2s. Default is all.' },
      notes: { type: Type.STRING },
    },
    required: ['dayOfWeek', 'periodLabel', 'title']
  }
};

export const addTasksToProjectTool: FunctionDeclaration = {
  name: 'addTasksToProject',
  description: 'Create one OR MORE tasks in a single call. ALWAYS use this for task creation: pass an array with a single item for one task, or multiple items when the user asks for several tasks at once. Never call this more than once per request — include every requested task in the `tasks` array.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        description: 'The list of tasks to create.',
        items: {
          type: Type.OBJECT,
          properties: {
            projectId: { type: Type.STRING, description: 'The ID of the project to add the task to. Pick the most relevant existing project from the context.' },
            title: { type: Type.STRING, description: 'Task title.' },
            description: { type: Type.STRING, description: 'Optional task notes or description.' },
            priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'], description: 'Default is Medium.' },
            deadlineDateStr: { type: Type.STRING, description: 'Optional deadline in YYYY-MM-DD format.' },
            scheduledDateStr: { type: Type.STRING, description: 'Optional scheduled/start date in YYYY-MM-DD format.' },
          },
          required: ['projectId', 'title'],
        },
      },
    },
    required: ['tasks'],
  },
};

export const updateTasksTool: FunctionDeclaration = {
  name: 'updateTasks',
  description: "Update, reschedule, re-prioritise, rename, move, or COMPLETE one or more EXISTING tasks. Use this (NOT addTasksToProject) whenever the user refers to a task that already exists in the Tasks context. To mark a task done, set status to 'Completed'. To reschedule, set scheduledDateStr and/or deadlineDateStr.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      updates: {
        type: Type.ARRAY,
        description: 'Each item MUST contain the exact id of an existing task plus only the fields to change.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The exact id of the existing task (from the Tasks context).' },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
            status: { type: Type.STRING, enum: ['Uncompleted', 'In Progress', 'Completed'] },
            projectId: { type: Type.STRING, description: 'Move the task to a different project (use a project id from context).' },
            scheduledDateStr: { type: Type.STRING, description: 'Scheduled/start date in YYYY-MM-DD format.' },
            deadlineDateStr: { type: Type.STRING, description: 'Deadline in YYYY-MM-DD format.' },
          },
          required: ['id'],
        },
      },
    },
    required: ['updates'],
  },
};

export const deleteTasksTool: FunctionDeclaration = {
  name: 'deleteTasks',
  description: 'Delete one or more EXISTING tasks by their ids (from the Tasks context).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskIds: { type: Type.ARRAY, description: 'The ids of the tasks to delete.', items: { type: Type.STRING } },
    },
    required: ['taskIds'],
  },
};

export const addKeyDateTool: FunctionDeclaration = {
  name: 'addKeyDate',
  description: 'Add a new key date to the calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title or name of the key date event.' },
      dateStr: { type: Type.STRING, description: 'The date in YYYY-MM-DD format.' },
      time: { type: Type.STRING, description: 'Optional time for the event (e.g. 14:00).' },
      isAllDay: { type: Type.BOOLEAN, description: 'Whether the event is an all day event.' },
      notes: { type: Type.STRING, description: 'Optional notes for the event.' }
    },
    required: ['title', 'dateStr']
  }
};

export const editKeyDateTool: FunctionDeclaration = {
  name: 'editKeyDate',
  description: 'Edit an existing key date on the calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'The ID of the key date to edit.' },
      title: { type: Type.STRING, description: 'Title or name of the key date event.' },
      dateStr: { type: Type.STRING, description: 'The date in YYYY-MM-DD format.' },
      time: { type: Type.STRING, description: 'Optional time for the event (e.g. 14:00).' },
      isAllDay: { type: Type.BOOLEAN, description: 'Whether the event is an all day event.' },
      notes: { type: Type.STRING, description: 'Optional notes for the event.' }
    },
    required: ['id']
  }
};

export const deleteKeyDateTool: FunctionDeclaration = {
  name: 'deleteKeyDate',
  description: 'Delete an existing key date from the calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'The ID of the key date to delete.' }
    },
    required: ['id']
  }
};

/** All planner tool declarations, in Gemini SDK format, consumed by the v1 chat. */
export const PLANNER_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  updateLessonTool,
  addRecurringLessonTool,
  addTasksToProjectTool,
  updateTasksTool,
  deleteTasksTool,
  addKeyDateTool,
  editKeyDateTool,
  deleteKeyDateTool,
];

/**
 * Convert a Gemini `Type.*` schema node to a lowercase JSON Schema node.
 * Gemini's `Type` enum members are uppercase strings ("OBJECT", "STRING", ...); the Antigravity
 * REST API expects standard JSON Schema ("object", "string", ...). Other keywords (properties,
 * items, enum, required, description) carry over unchanged.
 */
const toJsonSchemaNode = (node: any): any => {
  if (!node || typeof node !== 'object') return node;
  const out: any = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' && typeof value === 'string') {
      out.type = value.toLowerCase();
    } else if (key === 'properties' && value && typeof value === 'object') {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, any>).map(([k, v]) => [k, toJsonSchemaNode(v)])
      );
    } else if (key === 'items') {
      out.items = toJsonSchemaNode(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

/** A custom-function tool entry for the Antigravity Interactions API. */
export interface AgentFunctionTool {
  type: 'function';
  name: string;
  description?: string;
  parameters: any;
}

/** Convert a Gemini `FunctionDeclaration` to the Antigravity agent `function` tool shape. */
export const geminiDeclToJsonSchema = (decl: FunctionDeclaration): AgentFunctionTool => ({
  type: 'function',
  name: decl.name as string,
  description: decl.description,
  parameters: toJsonSchemaNode(decl.parameters),
});

/** All planner tools in Antigravity agent (`function`) format. */
export const PLANNER_AGENT_TOOLS: AgentFunctionTool[] = PLANNER_TOOL_DECLARATIONS.map(geminiDeclToJsonSchema);
