import { GoogleGenAI, Type } from "@google/genai";
import { WeeklyTimetable } from "../types";

const getAiClient = () => {
  const apiKey = window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
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
      model: "gemini-3.1-pro-preview",
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
