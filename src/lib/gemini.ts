import { GoogleGenAI } from "@google/genai";

function getAI() {
  // Use process.env.API_KEY if available (from selection dialog), 
  // otherwise fallback to GEMINI_API_KEY
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please configure your API key.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface VideoGenerationConfig {
  resolution?: "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16";
}

export async function enhancePrompt(prompt: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Enhance this video generation prompt to be more cinematic, detailed, and visually descriptive. Keep it under 100 words.
    Original prompt: ${prompt}`,
    config: {
      systemInstruction: "You are a world-class cinematographer and AI prompt engineer.",
    },
  });
  return response.text || prompt;
}

export async function generateVideo(prompt: string, config: VideoGenerationConfig = {}) {
  const ai = getAI();
  try {
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: config.resolution || '1080p',
        aspectRatio: config.aspectRatio || '16:9'
      }
    });
    return operation;
  } catch (error) {
    console.error("Error starting video generation:", error);
    throw error;
  }
}

export async function checkOperationStatus(operationName: string) {
  const ai = getAI();
  try {
    const operation = await (ai.operations as any).get(operationName);
    return operation;
  } catch (error) {
    console.error("Error checking operation status:", error);
    throw error;
  }
}
