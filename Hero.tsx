import React, { useState } from 'react';
import { UserInput } from '../types';
import { Youtube, Wand2, Sparkles, Video, Instagram } from 'lucide-react';

interface HeroProps {
  onSubmit: (input: UserInput) => void;
}

export const Hero: React.FC<HeroProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<UserInput['platform']>('TikTok');
  const [style, setStyle] = useState('Alex Hormozi (Fast Paced)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic && !url) return;
    onSubmit({ url, topic, style, platform });
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] text-center px-4 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-purple-600/20 rounded-full blur-[100px] animate-float"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-600/20 rounded-full blur-[100px] animate-float delay-1000"></div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-brand-300 text-xs font-medium backdrop-blur-sm mb-4">
            <Sparkles className="w-3 h-3 mr-2" />
            #1 AI Video Repurposing Tool
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-tight">
            One Click. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-purple-400">
              Instant Viral Shorts.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Turn any YouTube link or text idea into scroll-stopping TikToks, Reels, and Shorts using advanced AI. No editing skills required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto bg-gray-900/80 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl shadow-brand-900/20">
          <div className="flex flex-col space-y-4 p-4">
            
            <div className="flex flex-col md:flex-row gap-4">
               <div className="flex-1">
                 <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">YouTube URL (Optional)</label>
                 <div className="relative group">
                   <Youtube className="absolute left-3 top-3 w-5 h-5 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                   <input
                     type="text"
                     value={url}
                     onChange={(e) => setUrl(e.target.value)}
                     placeholder="Paste YouTube Link..."
                     className="w-full bg-black/40 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all placeholder-gray-600"
                   />
                 </div>
               </div>
               
               <div className="flex-1">
                 <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Topic / Niche</label>
                 <div className="relative group">
                   <Wand2 className="absolute left-3 top-3 w-5 h-5 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
                   <input
                     type="text"
                     value={topic}
                     onChange={(e) => setTopic(e.target.value)}
                     placeholder="e.g. Finance, Motivation..."
                     className="w-full bg-black/40 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all placeholder-gray-600"
                   />
                 </div>
               </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
               <select 
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="bg-gray-800 text-sm text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-brand-500 outline-none cursor-pointer hover:bg-gray-700"
               >
                 <option>Alex Hormozi (Fast Paced)</option>
                 <option>MrBeast (High Energy)</option>
                 <option>Cinematic Storytelling</option>
                 <option>Minimalist & Clean</option>
                 <option>Reddit Story Style</option>
               </select>

               <select 
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="bg-gray-800 text-sm text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-brand-500 outline-none cursor-pointer hover:bg-gray-700"
               >
                 <option value="TikTok">TikTok</option>
                 <option value="Instagram Reels">Instagram Reels</option>
                 <option value="YouTube Shorts">YouTube Shorts</option>
               </select>

               <button 
                type="submit" 
                disabled={!topic && !url}
                className="ml-auto bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-all transform active:scale-95 shadow-lg shadow-brand-500/25 flex items-center"
               >
                 <Sparkles className="w-4 h-4 mr-2" />
                 Generate Clips
               </button>
            </div>
          </div>
        </form>

        <div className="flex justify-center gap-8 pt-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-semibold">Auto-Crop</span>
          </div>
          <div className="flex items-center space-x-2">
            <Instagram className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-semibold">Viral Captions</span>
          </div>
          <div className="flex items-center space-x-2">
            <Wand2 className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-semibold">AI Scripting</span>
          </div>
        </div>
      </div>
    </div>
  );
};
