import { GoogleGenAI } from "@google/genai";
import { LanguageCode } from '../types';

const getGeminiClient = () => {
    // Check if API key exists to avoid crash, though Env is expected
    if(!process.env.API_KEY) {
        console.error("API KEY MISSING");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getSafetyAdvice = async (language: LanguageCode, situation?: string): Promise<string> => {
  const ai = getGeminiClient();
  if (!ai) return "AI Service Unavailable (Missing Key)";

  const langName = language === 'ms' ? 'Bahasa Malaysia' : language === 'th' ? 'Thai' : 'English';
  
  const prompt = `Provide 3 short, crucial safety tips for a flood victim. 
  Language: ${langName}. 
  Context: ${situation || 'General flood emergency'}.
  Format: Bullet points, plain text, no markdown styling like bold/italic. Keep it under 50 words.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Stay on high ground. Avoid electrical wires. Wait for rescue.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Stay safe. Keep phone dry. Signal for help.";
  }
};