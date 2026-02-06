export enum GenerationStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface CaptionSegment {
  text: string;
  start: number;
  end: number;
  highlight?: boolean;
}

export interface ViralClip {
  id: string;
  title: string;
  viralScore: number;
  hook: string;
  script: string;
  hashtags: string[];
  captions: CaptionSegment[];
  explanation: string;
  socialDescription: string; // New field for social media caption
  category: string;
  audioData?: string; // Base64 audio string
}

export interface UserInput {
  url: string;
  topic: string;
  style: string;
  platform: 'TikTok' | 'YouTube Shorts' | 'Instagram Reels';
}

export interface ViralStats {
  score: number;
  retention: number;
  shareability: number;
  pacing: number;
}