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
  taskId?: string; // If the insight relates to a specific task
  actionData?: {
    prompt: string;
  };
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

      Insights can be:
      1. 'info': General information or summary about the workload or project status.
      2. 'suggestion': A suggestion on what to prioritize or how to organize tasks.
      3. 'action': A proactive offer to complete a task, draft content, consolidate communication, or restructure a process.
         If you suggest an 'action', you MUST provide 'actionData.prompt' which is a prompt that the AI can run to generate the actual content or draft. For example, if you suggest "Consolidate Oasis Communications", the prompt should be "Draft a consolidated email to Oasis addressing both the English literature setups and the Bromcom communication issues."

      Context:
      ${contextStr}

      Respond with a JSON array of insight objects. Do not wrap in markdown tags like \`\`\`json.
      Example format:
      [
        {
          "type": "info",
          "title": "Project on track",
          "description": "You have completed 50% of the tasks in this project."
        },
        {
          "type": "action",
          "title": "Draft Parent Email",
          "description": "I can draft the email to parents for you.",
          "taskId": "task_123",
          "actionData": {
            "prompt": "Draft an email to parents about the upcoming science fair..."
          }
        }
      ]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [prompt],
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
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
      model: "gemini-3.1-flash-lite-preview",
      contents: [prompt],
    });
    return response.text || "";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Error generating content. Please try again.";
  }
};

export const extractTaskDetails = async (naturalLanguageInput: string): Promise<{ title: string, priority: string, scheduledDateStr: string, deadlineDateStr: string }> => {
    try {
        const ai = getAiClient();
        const prompt = `
            Extract task details from the following natural language input:
            "${naturalLanguageInput}"

            Return a JSON object with the following keys:
            - title (string): A short, clear title for the task.
            - priority (string): Must be exactly "High", "Medium", or "Low". Default to "Medium" if not specified.
            - scheduledDateStr (string): The start or scheduled date in "YYYY-MM-DD" format. If words like "tomorrow", "next week" are used, calculate the date relative to today (${new Date().toISOString().split('T')[0]}). If not specified, return an empty string "".
            - deadlineDateStr (string): The due date or deadline in "YYYY-MM-DD" format. Calculate relative to today if needed. If not specified, return an empty string "".

            Do not wrap in markdown tags like \`\`\`json.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [prompt],
            config: {
                responseMimeType: "application/json",
            },
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("No response text from Gemini");
    } catch (error) {
        console.error("Error extracting task details:", error);
        return { title: "", priority: "Medium", scheduledDateStr: "", deadlineDateStr: "" };
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
      model: "gemini-3.1-flash-lite-preview",
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
      return JSON.parse(response.text);
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error parsing timetable:", error);
    throw error;
  }
};
