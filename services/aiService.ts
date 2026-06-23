import { GoogleGenAI, Type } from "@google/genai";
import { Term, WeeklyTimetable } from "../types";

export const getAiClient = () => {
  const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
      console.warn("API key must be set when using the Gemini API.");
      throw new Error("API key must be set when using the Gemini API.");
  }
  return new GoogleGenAI({ apiKey });
};

// Single source of truth for the text model. Swap here to migrate every text-based AI call.
// The native-audio voice model (LiveAssistant) is intentionally separate.
export const TEXT_MODEL = "gemini-3.5-flash";

const DAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    "Period 1": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Period 2": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Period 3": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Period 4": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Period 5": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Period 6": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Morning Mtg": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
    "Afternoon Mtg": { 
      type: Type.OBJECT, 
      nullable: true, 
      properties: { 
        subject: { type: Type.STRING }, 
        room: { type: Type.STRING }, 
        colorClass: { type: Type.STRING } 
      } 
    },
  }
};

const TIMETABLE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    week1: {
      type: Type.OBJECT,
      description: "Timetable for Week 1",
      properties: {
        Monday: { ...DAY_SCHEMA, nullable: true },
        Tuesday: { ...DAY_SCHEMA, nullable: true },
        Wednesday: { ...DAY_SCHEMA, nullable: true },
        Thursday: { ...DAY_SCHEMA, nullable: true },
        Friday: { ...DAY_SCHEMA, nullable: true },
      },
      nullable: true
    },
    week2: {
      type: Type.OBJECT,
      description: "Timetable for Week 2",
      properties: {
        Monday: { ...DAY_SCHEMA, nullable: true },
        Tuesday: { ...DAY_SCHEMA, nullable: true },
        Wednesday: { ...DAY_SCHEMA, nullable: true },
        Thursday: { ...DAY_SCHEMA, nullable: true },
        Friday: { ...DAY_SCHEMA, nullable: true },
      },
      nullable: true
    },
  },
};

const MASTER_IMPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
     terms: {
        type: Type.ARRAY,
        description: "List of academic terms extracted from the document",
        items: {
           type: Type.OBJECT,
           properties: {
              name: { type: Type.STRING, description: "e.g., Autumn Term 2025" },
              startDate: { type: Type.STRING, description: "ISO Date String YYYY-MM-DD" },
              endDate: { type: Type.STRING, description: "ISO Date String YYYY-MM-DD" },
              halfTermStart: { type: Type.STRING, nullable: true, description: "ISO Date String YYYY-MM-DD" },
              halfTermEnd: { type: Type.STRING, nullable: true, description: "ISO Date String YYYY-MM-DD" }
           }
        }
     },
     timetables: TIMETABLE_SCHEMA
  }
};

export interface AIInsight {
  type: 'info' | 'suggestion' | 'action';
  title: string;
  description: string;
  taskIds?: string[]; // If the insight relates to specific tasks
  actionType?: 'generate_content' | 'delete_tasks' | 'group_tasks' | 'review_tasks' | 'update_tasks';
  actionData?: {
    prompt: string;
  };
}

/**
 * Robustly parses a JSON string, handling potential markdown wrappers
 * or trailing conversational text from the AI response.
 */
function extractAndParseJSON(jsonStr: string): any {
  let text = jsonStr.trim();

  // Try standard parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to fallback
  }

  // Clean markdown formatting if present
  if (text.startsWith('```json')) {
    text = text.substring(7);
  } else if (text.startsWith('```')) {
    text = text.substring(3);
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3);
  }
  text = text.trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to extraction fallback
  }

  // Find the first '[' and last ']' for an array
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  // Find the first '{' and last '}' for an object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  // Determine if the outermost structure is likely an array or an object
  let firstCharIndex = -1;
  let lastCharIndex = -1;

  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    if (firstBrace === -1 || firstBracket < firstBrace) {
      firstCharIndex = firstBracket;
      lastCharIndex = lastBracket;
    }
  }

  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    if (firstBracket === -1 || firstBrace < firstBracket) {
      firstCharIndex = firstBrace;
      lastCharIndex = lastBrace;
    }
  }

  if (firstCharIndex !== -1 && lastCharIndex !== -1 && firstCharIndex < lastCharIndex) {
    try {
      const potentialJson = text.substring(firstCharIndex, lastCharIndex + 1);
      return JSON.parse(potentialJson);
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
    }
  }

  throw new Error("Could not parse JSON from string: " + jsonStr);
}

export const generateInsights = async (
  contextType: 'project' | 'all_tasks',
  tasks: any[],
  project?: any,
  timetable?: any
): Promise<AIInsight[]> => {
  try {
    const ai = getAiClient();

    let contextStr = `Context Type: ${contextType}\n`;
    if (project) {
      contextStr += `Project Name: ${project.name}\n`;
      contextStr += `Project Description: ${project.description || 'None'}\n`;
    }
    contextStr += `Tasks:\n${JSON.stringify(tasks, null, 2)}\n`;

    const prompt = `
      You are an AI assistant for a teacher planner app. Based on the provided context, generate 3-5 helpful insights.

      Insights can be 'info', 'suggestion', or 'action'.

      CRITICAL REQUIREMENT: For EVERY insight, you MUST provide an 'actionType'.

      Valid 'actionType' values and their purpose:
      - "generate_content": For drafting emails, letters, or long text. 'actionData.prompt' should instruct what to generate.
      - "delete_tasks": For suggesting deletion of duplicate, obsolete, or completed tasks. MUST include 'taskIds'. 'actionData.prompt' is optional but should explain why they are deleted.
      - "group_tasks": For combining related tasks or communications. MUST include 'taskIds'. 'actionData.prompt' should describe the grouping logic.
      - "review_tasks": For highlighting high-priority or urgent tasks. MUST include 'taskIds'. 'actionData.prompt' should describe what the user should focus on.
      - "update_tasks": For changing dates, priorities, or statuses of multiple tasks. MUST include 'taskIds'. 'actionData.prompt' should describe the update.

      If the insight specifically targets existing tasks (like grouping them, reviewing high priority, or deleting them), you MUST include an array of their IDs in 'taskIds'.

      Context:
      ${contextStr}

      Respond with a JSON array of insight objects. Do not wrap in markdown tags like \`\`\`json.
      Example format:
      [
        {
          "type": "info",
          "title": "High Priority Workload",
          "description": "You have 12 high-priority tasks requiring attention.",
          "taskIds": ["task_1", "task_5", "task_8"],
          "actionType": "review_tasks",
          "actionData": {
            "prompt": "Review these high priority tasks."
          }
        },
        {
          "type": "suggestion",
          "title": "Clean up test tasks",
          "description": "There are several tasks named 'test' that should be removed.",
          "taskIds": ["task_3", "task_9"],
          "actionType": "delete_tasks",
          "actionData": {
            "prompt": "These tasks look like tests and can be deleted."
          }
        },
        {
          "type": "action",
          "title": "Draft Parent Email",
          "description": "You have a task to contact parents about Bromcom.",
          "taskIds": ["task_10"],
          "actionType": "generate_content",
          "actionData": {
            "prompt": "Draft an email to parents regarding the Bromcom transition."
          }
        }
      ]
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      return extractAndParseJSON(response.text);
    }
    return [];
  } catch (error) {
    console.error("Error generating insights:", error);
    return [];
  }
};

export const generateContentFromAction = async (prompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Error generating content. Please try again.";
  }
};

export interface ExtractedTaskDetails {
    title: string;
    description: string;
    priority: string;
    scheduledDateStr: string;
    deadlineDateStr: string;
    projectId: string;
    categoryId: string;
    confidence: number;
}

const TASK_EXTRACTION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A short, clear title for the task." },
        description: { type: Type.STRING, description: "Any remaining details/notes, or empty string." },
        priority: { type: Type.STRING, enum: ["High", "Medium", "Low"], description: "Default Medium if unspecified." },
        scheduledDateStr: { type: Type.STRING, description: "Start/scheduled date YYYY-MM-DD, or empty string." },
        deadlineDateStr: { type: Type.STRING, description: "Deadline/due date YYYY-MM-DD, or empty string." },
        projectId: { type: Type.STRING, description: "ID of a matching available project, or empty string." },
        categoryId: { type: Type.STRING, description: "ID of a matching available category, or empty string." },
        confidence: { type: Type.NUMBER, description: "0..1 overall confidence in this extraction." },
    },
    required: ["title", "priority", "confidence"],
};

export interface TaskExtractionContext {
    subjects?: string[];
    todayISO?: string;
    weekday?: string;
    termEndISO?: string;
}

export const extractTaskDetails = async (
    naturalLanguageInput: string,
    projects?: { id: string; name: string }[],
    categories?: { id: string; name: string }[],
    context?: TaskExtractionContext
): Promise<ExtractedTaskDetails> => {
    try {
        const ai = getAiClient();

        const projectsStr = projects && projects.length > 0 ? `Available Projects: ${projects.map(p => `"${p.name}" (ID: ${p.id})`).join(', ')}` : "No projects available.";
        const categoriesStr = categories && categories.length > 0 ? `Available Categories: ${categories.map(c => `"${c.name}" (ID: ${c.id})`).join(', ')}` : "No categories available.";

        // Build a concrete date scaffold so relative phrasing ("next Tuesday", "tomorrow") resolves reliably.
        const todayISO = context?.todayISO || new Date().toISOString().split('T')[0];
        const todayDate = new Date(`${todayISO}T00:00:00`);
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekday = context?.weekday || weekdayNames[todayDate.getDay()];
        const upcomingDays: string[] = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() + i);
            upcomingDays.push(`${weekdayNames[d.getDay()]} = ${d.toISOString().split('T')[0]}`);
        }
        const subjectsStr = context?.subjects && context.subjects.length > 0
            ? `The teacher's timetable includes these subjects/classes: ${context.subjects.join(', ')}. Use these to interpret class references (e.g. "10B", "Year 9 Geography") when forming the title or matching a project/category.`
            : "";
        const termEndStr = context?.termEndISO ? `The current term ends on ${context.termEndISO} (use for phrases like "end of term").` : "";

        const prompt = `
            You are extracting a single task from a teacher's natural-language input.
            Input: "${naturalLanguageInput}"

            DATE CONTEXT:
            - Today is ${weekday}, ${todayISO}.
            - Upcoming days: ${upcomingDays.join('; ')}.
            - "tomorrow" = ${upcomingDays[0].split(' = ')[1]}. "next week" = roughly 7 days out. ${termEndStr}
            - When the user names a weekday (e.g. "Friday", "next Tuesday"), resolve it to the nearest upcoming matching date above.

            ${projectsStr}
            ${categoriesStr}
            ${subjectsStr}

            Rules:
            - priority must be exactly "High", "Medium", or "Low" (default "Medium" if not stated).
            - Dates must be "YYYY-MM-DD" or an empty string "" if not specified. Never invent a date that wasn't implied.
            - Only set projectId/categoryId when the input clearly matches one of the available options above; otherwise use "".
            - confidence is a number 0..1 reflecting how sure you are of the overall extraction (lower it when dates or project matches are ambiguous).
        `;

        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: TASK_EXTRACTION_SCHEMA,
            },
        });

        if (response.text) {
            const parsed = extractAndParseJSON(response.text) as Partial<ExtractedTaskDetails>;
            return {
                title: parsed.title || "",
                description: parsed.description || "",
                priority: parsed.priority || "Medium",
                scheduledDateStr: parsed.scheduledDateStr || "",
                deadlineDateStr: parsed.deadlineDateStr || "",
                projectId: parsed.projectId || "",
                categoryId: parsed.categoryId || "",
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
            };
        }
        throw new Error("No response text from Gemini");
    } catch (error) {
        console.error("Error extracting task details:", error);
        return { title: "", description: "", priority: "Medium", scheduledDateStr: "", deadlineDateStr: "", projectId: "", categoryId: "", confidence: 0 };
    }
};

export interface VibeTaskDraft {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    scheduledDateStr: string;
    deadlineDateStr: string;
}

export interface VibeProjectResult {
    projectName: string;
    description: string;
    categorySelection: {
        existingCategoryId: string; // "" if proposing a new category
        newCategoryName: string;    // "" if using an existing category
    };
    tasks: VibeTaskDraft[];
}

const VIBE_PROJECT_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        projectName: { type: Type.STRING, description: "A concise, clear project title." },
        description: { type: Type.STRING, description: "A 1-2 sentence summary of the project's goal." },
        categorySelection: {
            type: Type.OBJECT,
            properties: {
                existingCategoryId: { type: Type.STRING, description: "ID of the best-matching existing project category, or empty string if none fit well." },
                newCategoryName: { type: Type.STRING, description: "A concise new category name to create ONLY if no existing category fits; otherwise empty string." },
            },
        },
        tasks: {
            type: Type.ARRAY,
            description: "The list of actionable tasks needed to complete this project.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING, description: "Optional extra detail, or empty string." },
                    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                    scheduledDateStr: { type: Type.STRING, description: "YYYY-MM-DD or empty string." },
                    deadlineDateStr: { type: Type.STRING, description: "YYYY-MM-DD or empty string." },
                },
                required: ["title", "priority"],
            },
        },
    },
    required: ["projectName", "tasks"],
};

/**
 * Turns a free-text brain-dump into a structured project draft (name, description,
 * a best-fit category selection, and a task list) for the "Vibe Project" generator.
 * Returns null on failure so the caller can surface an error.
 */
export const generateVibeProject = async (
    naturalLanguageInput: string,
    categories?: { id: string; name: string }[],
    todayISO?: string
): Promise<VibeProjectResult | null> => {
    try {
        const ai = getAiClient();

        const today = todayISO || new Date().toISOString().split('T')[0];
        const categoriesStr = categories && categories.length > 0
            ? `Existing project categories: ${categories.map(c => `"${c.name}" (ID: ${c.id})`).join(', ')}`
            : "There are no existing categories yet.";

        const prompt = `
            You are a planning assistant for a teacher. Turn the following brain-dump into a single, well-structured project with a list of actionable tasks.

            User's request: "${naturalLanguageInput}"

            Today's date is ${today}. Use the format YYYY-MM-DD for any dates, and only set a date when the user clearly implies one (otherwise use "").

            ${categoriesStr}

            Category rules:
            - Choose the single best-matching existing category and put its ID in 'categorySelection.existingCategoryId'.
            - If (and only if) none of the existing categories is a good fit, leave 'existingCategoryId' empty and propose a concise new category name in 'categorySelection.newCategoryName' (e.g. "Assessment", "Trips", "Pastoral").
            - Never fill in both fields.

            Task rules:
            - Break the work into clear, concrete tasks (typically 3-10). Each needs a short title.
            - priority must be exactly "High", "Medium", or "Low".
        `;

        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: VIBE_PROJECT_SCHEMA,
            },
        });

        if (response.text) {
            const parsed = extractAndParseJSON(response.text) as Partial<VibeProjectResult>;
            if (!parsed.projectName || !Array.isArray(parsed.tasks)) return null;
            return {
                projectName: parsed.projectName,
                description: parsed.description || "",
                categorySelection: {
                    existingCategoryId: parsed.categorySelection?.existingCategoryId || "",
                    newCategoryName: parsed.categorySelection?.newCategoryName || "",
                },
                tasks: parsed.tasks
                    .map((t): VibeTaskDraft => ({
                        title: t.title || "",
                        description: t.description || "",
                        priority: (t.priority === 'High' || t.priority === 'Low') ? t.priority : 'Medium',
                        scheduledDateStr: t.scheduledDateStr || "",
                        deadlineDateStr: t.deadlineDateStr || "",
                    }))
                    .filter(t => t.title.trim().length > 0),
            };
        }
        return null;
    } catch (error) {
        console.error("Error generating vibe project:", error);
        return null;
    }
};

export interface BriefingItem {
    kind: 'overdue' | 'due_today' | 'lesson' | 'suggestion';
    title: string;
    detail?: string;
    taskId?: string;
}

export interface Briefing {
    greeting: string;
    summary: string;
    items: BriefingItem[];
}

const BRIEFING_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        greeting: { type: Type.STRING, description: "A short, warm greeting referencing the day." },
        summary: { type: Type.STRING, description: "1-2 sentence overview of the day's workload." },
        items: {
            type: Type.ARRAY,
            description: "The most relevant briefing items, ordered by importance.",
            items: {
                type: Type.OBJECT,
                properties: {
                    kind: { type: Type.STRING, enum: ["overdue", "due_today", "lesson", "suggestion"] },
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING, description: "Optional short supporting detail." },
                    taskId: { type: Type.STRING, description: "Related task id when applicable, else empty string." },
                },
                required: ["kind", "title"],
            },
        },
    },
    required: ["greeting", "summary", "items"],
};

export interface BriefingContext {
    todayISO: string;
    weekday: string;
    overdueTasks: { id: string; title: string; deadlineDateStr?: string }[];
    dueTodayTasks: { id: string; title: string }[];
    todaysLessons: { period: string; subject: string; hasPlan: boolean }[];
    upcomingKeyDates: { title: string; dateStr: string }[];
}

/**
 * Generates a proactive daily/weekly briefing for the teacher.
 * Read-only narrative + light suggestions; never mutates data.
 */
export const generateBriefing = async (ctx: BriefingContext): Promise<Briefing> => {
    const empty: Briefing = { greeting: "", summary: "", items: [] };
    try {
        const ai = getAiClient();

        const prompt = `
            You are a teacher's proactive planning assistant. Produce a concise morning briefing.
            Today is ${ctx.weekday}, ${ctx.todayISO}.

            OVERDUE TASKS (deadline passed, still open): ${ctx.overdueTasks.length ? JSON.stringify(ctx.overdueTasks) : "none"}
            DUE TODAY: ${ctx.dueTodayTasks.length ? JSON.stringify(ctx.dueTodayTasks) : "none"}
            TODAY'S LESSONS: ${ctx.todaysLessons.length ? JSON.stringify(ctx.todaysLessons) : "none"}
            UPCOMING KEY DATES (next ~14 days): ${ctx.upcomingKeyDates.length ? JSON.stringify(ctx.upcomingKeyDates) : "none"}

            Guidelines:
            - Surface overdue items first, then due-today, then lessons that still lack a plan (hasPlan = false).
            - Add 2-3 concrete "suggestion" items for what to tackle next. Keep each title short and actionable.
            - When an item refers to a specific task, set its taskId to that task's id.
            - Be encouraging and brief. Return at most 8 items total. If there is genuinely nothing to do, say so warmly with an empty items array.
        `;

        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: BRIEFING_SCHEMA,
            },
        });

        if (response.text) {
            const parsed = extractAndParseJSON(response.text) as Briefing;
            return {
                greeting: parsed.greeting || "",
                summary: parsed.summary || "",
                items: Array.isArray(parsed.items) ? parsed.items : [],
            };
        }
        return empty;
    } catch (error) {
        console.error("Error generating briefing:", error);
        return empty;
    }
};

export const parseTimetableText = async (text: string): Promise<{ week1: WeeklyTimetable, week2: WeeklyTimetable }> => {
  try {
    const prompt = `
      Analyze this text representation of a timetable.
      Extract the schedule for Week 1 and Week 2.

      Look for headers like "Week 1" or "Week 2" to identify which schedule is which.
      If the text only contains one week, populate that week and leave the other empty.

      The timetable typically has rows for periods (P1, P2, P3A, P3B, P3C, P3D, P4, P5A, P5B, P5C, P6) and columns for days (Mon-Fri).

      For each slot, extract the subject/activity.
      If a slot is empty, return null.

      Map the periods to the following keys:
      - "Period 1": P1
      - "Period 2": P2
      - "Period 3": P3A, P3B, P3C, P3D. If ANY of these have a class, use that class. If multiple have classes, use the first one.
      - "Period 4": P4
      - "Period 5": P5A, P5B, P5C. If ANY of these have a class, use that class. If multiple have classes, use the first one.
      - "Period 6": P6

      Ignore "Morning Mtg" and "Afternoon Mtg" unless explicitly stated.

      Return a JSON object with "week1" and "week2" keys.

      IMPORTANT: Do NOT hallucinate. If a slot is empty in the text, it MUST be null in the JSON.
      Do NOT fill in default values.

      Assign a colorClass based on the subject (e.g., Math=blue, English=yellow, Science=green, etc.). Use Tailwind classes like "bg-blue-100 text-blue-800".

      Here is the text to analyze:
      ${text}
    `;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: TIMETABLE_SCHEMA,
      },
    });

    if (response.text) {
      return extractAndParseJSON(response.text);
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error parsing timetable from text:", error);
    throw error;
  }
};

export const parseMasterTimetableAndTerms = async (
  base64Data?: string,
  mimeType?: string,
  textContent?: string
): Promise<{ terms?: Partial<Term>[], timetables?: { week1: WeeklyTimetable, week2: WeeklyTimetable } }> => {
  try {
    const prompt = `
      Analyze the provided document or text.
      Your task is to extract TWO sets of information if present:

      1. ACADEMIC TERMS: Look for term dates (e.g., Autumn Term, Spring Term, Summer Term) including Start Dates, End Dates, and Half-Term break dates. Convert all dates to YYYY-MM-DD format.

      2. MASTER TIMETABLE: Look for a weekly schedule (Week 1 and Week 2).
         - The timetable has rows for periods and columns for days (Mon-Fri).
         - For each slot, extract the subject/activity. If a slot is empty, return null.
         - Map periods to "Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6", "Morning Mtg", "Afternoon Mtg".
         - Assign a visually distinct HEX color code (e.g., #bbf7d0) to the 'colorClass' field based on the subject (e.g., all Geography classes get the same green hex, all Math classes get a blue hex). Do NOT use tailwind class names, ONLY hex codes like #a2f0b3.

      Return a JSON object with 'terms' (array) and 'timetables' (object with week1 and week2).

      If one of these datasets is missing (e.g., you only find term dates but no timetable), return what you find and leave the other empty or null.

      ${textContent ? `TEXT CONTENT TO ANALYZE:\n${textContent}` : ''}
    `;

    const ai = getAiClient();

    let parts: any[] = [{ text: prompt }];

    if (base64Data && mimeType) {
        parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
        });
    }

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: MASTER_IMPORT_SCHEMA,
      },
    });

    if (response.text) {
      return extractAndParseJSON(response.text);
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error parsing master timetable and terms:", error);
    throw error;
  }
};

export const parseTimetableImage = async (base64Data: string, mimeType: string = "image/png"): Promise<{ week1: WeeklyTimetable, week2: WeeklyTimetable }> => {
  try {
    const prompt = `
      Analyze this document (timetable). It may contain one or multiple pages.
      Extract the schedule for Week 1 and Week 2.
      
      Look for headers like "Week 1" or "Week 2" to identify which schedule is which.
      If the document only contains one week, populate that week and leave the other empty.
      
      The timetable has rows for periods (P1, P2, P3A, P3B, P3C, P3D, P4, P5A, P5B, P5C, P6) and columns for days (Mon-Fri).
      
      For each slot, extract the subject/activity.
      If a slot is empty, return null.
      
      Map the periods to the following keys:
      - "Period 1": P1
      - "Period 2": P2
      - "Period 3": P3A, P3B, P3C, P3D. If ANY of these have a class, use that class. If multiple have classes, use the first one.
      - "Period 4": P4
      - "Period 5": P5A, P5B, P5C. If ANY of these have a class, use that class. If multiple have classes, use the first one.
      - "Period 6": P6
      
      Ignore "Morning Mtg" and "Afternoon Mtg" unless explicitly stated.
      
      Return a JSON object with "week1" and "week2" keys.
      
      IMPORTANT: Do NOT hallucinate. If a slot is empty in the image, it MUST be null in the JSON.
      Do NOT fill in default values.
      
      Assign a colorClass based on the subject (e.g., Math=blue, English=yellow, Science=green, etc.). Use Tailwind classes like "bg-blue-100 text-blue-800".
    `;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: TIMETABLE_SCHEMA,
      },
    });

    if (response.text) {
      return extractAndParseJSON(response.text);
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error parsing timetable:", error);
    throw error;
  }
};
