import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { UserInput, ViralClip } from "../types";

const captionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "The caption text segment (1-3 words max)." },
    start: { type: Type.NUMBER, description: "Start time in seconds." },
    end: { type: Type.NUMBER, description: "End time in seconds." },
    highlight: { type: Type.BOOLEAN, description: "Whether to highlight this word/phrase (True for impactful words)." }
  },
  required: ["text", "start", "end"]
};

const clipSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Clickbait title for the clip." },
    viralScore: { type: Type.NUMBER, description: "Predicted viral score from 0-100." },
    hook: { type: Type.STRING, description: "The first 3 seconds hook script." },
    script: { type: Type.STRING, description: "The full body script." },
    explanation: { type: Type.STRING, description: "Why this clip will go viral." },
    socialDescription: { type: Type.STRING, description: "A ready-to-post engaging social media caption including CTAs and hashtags." },
    category: { type: Type.STRING, description: "e.g. Motivation, Fact, Story, Humor" },
    hashtags: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    captions: {
      type: Type.ARRAY,
      items: captionSchema,
      description: "Word-for-word timestamped captions. TIMING IS CRITICAL. Break sentences into 1-2 word chunks for fast-paced editing."
    }
  },
  required: ["title", "viralScore", "hook", "script", "hashtags", "captions", "explanation", "socialDescription", "category"]
};

const responseSchema: Schema = {
  type: Type.ARRAY,
  items: clipSchema
};

// Retry helper
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      if (i < retries - 1) await new Promise(res => setTimeout(res, delay * (i + 1))); // Exponential backoff
    }
  }
  throw lastError;
}

export const generateViralClips = async (input: UserInput): Promise<ViralClip[]> => {
  return retryOperation(async () => {
    try {
      // Initialize client inside function to ensure API_KEY is picked up from env or window injection
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = 'gemini-3-flash-preview';
      
      const prompt = `
        You are a top-tier Viral Content Strategist.
        
        Task: Generate 3 video concepts optimized for "${input.platform}".
        Topic: "${input.topic}"
        Context URL: "${input.url || 'N/A'}"
        Style: "${input.style}"
        
        CRITICAL INSTRUCTIONS:
        1. **Pacing**: Scripts must be extremely punchy. No fluff.
        2. **Captions**: generate 'captions' with precise timestamps. Break text into very short segments (1-2 words) for "Hormozi" style dynamic captions.
        3. **Hook**: The first 3 seconds must be startling or intriguing.
        4. **Length**: Target 15-25 seconds total.
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          systemInstruction: "You are the engine behind the world's most viral shorts. You value retention above all else."
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return data.map((clip: any, index: number) => ({
          ...clip,
          id: `clip-${Date.now()}-${index}`
        }));
      }
      
      throw new Error("No content generated");

    } catch (error) {
      console.error("Gemini Generation Error:", error);
      throw error;
    }
  });
};

export const generateVoiceover = async (text: string): Promise<string> => {
  return retryOperation(async () => {
    const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: text }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No audio data generated");
    return audioData;
  });
};

export const generateVeoBackground = async (prompt: string): Promise<string> => {
  return retryOperation(async () => {
    const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Optimized prompt for Veo 3.1
    // We explicitly ask for "background" style to avoid distracting foreground elements
    const enhancedPrompt = `A high-quality, 4k, cinematic vertical video (9:16) of: ${prompt}. 
    Style: Ambient, atmospheric, slow motion, photorealistic, no text, shallow depth of field. 
    Lighting: Professional studio or natural golden hour.`;

    let operation = await client.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: enhancedPrompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p', // Highest quality
        aspectRatio: '9:16'
      }
    });

    const startTime = Date.now();
    const TIMEOUT_MS = 300000; // 5 minutes max

    while (!operation.done) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error("Video generation timed out. Please try again.");
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await client.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Veo did not return a video URI.");
    
    // Important: Append key if the client doesn't handle it automatically for raw fetches
    // Check if URI already has params
    const separator = videoUri.includes('?') ? '&' : '?';
    return `${videoUri}${separator}key=${process.env.API_KEY}`;
  }, 2); // Retry twice
};