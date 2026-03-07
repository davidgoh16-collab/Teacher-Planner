import { GoogleGenAI, Type } from "@google/genai";
import { WeeklyTimetable } from "../types";

export const getAiClient = () => {
  const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
};

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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Error generating content. Please try again.";
  }
};

export const extractTaskDetails = async (
    naturalLanguageInput: string,
    projects?: { id: string; name: string }[],
    categories?: { id: string; name: string }[]
): Promise<{ title: string, description: string, priority: string, scheduledDateStr: string, deadlineDateStr: string, projectId: string, categoryId: string }> => {
    try {
        const ai = getAiClient();

        const projectsStr = projects && projects.length > 0 ? `Available Projects: ${projects.map(p => `"${p.name}" (ID: ${p.id})`).join(', ')}` : "No projects available.";
        const categoriesStr = categories && categories.length > 0 ? `Available Categories: ${categories.map(c => `"${c.name}" (ID: ${c.id})`).join(', ')}` : "No categories available.";

        const prompt = `
            Extract task details from the following natural language input:
            "${naturalLanguageInput}"

            ${projectsStr}
            ${categoriesStr}

            Return a JSON object with the following keys:
            - title (string): A short, clear title for the task.
            - description (string): Any remaining details, notes, or steps. If none, return an empty string "".
            - priority (string): Must be exactly "High", "Medium", or "Low". Default to "Medium" if not specified.
            - scheduledDateStr (string): The start or scheduled date in "YYYY-MM-DD" format. If words like "tomorrow", "next week" are used, calculate the date relative to today (${new Date().toISOString().split('T')[0]}). If not specified, return an empty string "".
            - deadlineDateStr (string): The due date or deadline in "YYYY-MM-DD" format. Calculate relative to today if needed. If not specified, return an empty string "".
            - projectId (string): The ID of the project if the user mentions one of the Available Projects. Otherwise, return an empty string "".
            - categoryId (string): The ID of the category if the user mentions one of the Available Categories. Otherwise, return an empty string "".

            Do not wrap in markdown tags like \`\`\`json.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            },
        });

        if (response.text) {
            return extractAndParseJSON(response.text);
        }
        throw new Error("No response text from Gemini");
    } catch (error) {
        console.error("Error extracting task details:", error);
        return { title: "", description: "", priority: "Medium", scheduledDateStr: "", deadlineDateStr: "", projectId: "", categoryId: "" };
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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
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
