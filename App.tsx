import React, { useState } from 'react';
import { Hero } from './components/Hero';
import { Processing } from './components/Processing';
import { Dashboard } from './components/Dashboard';
import { generateViralClips } from './services/geminiService';
import { UserInput, ViralClip, GenerationStatus } from './types';
import { Film } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [generatedClips, setGeneratedClips] = useState<ViralClip[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async (input: UserInput) => {
    setStatus(GenerationStatus.ANALYZING);
    setErrorMsg(null);
    
    // Simulate phases of processing before actual call for better UX
    setTimeout(async () => {
      setStatus(GenerationStatus.GENERATING);
      try {
        const clips = await generateViralClips(input);
        setGeneratedClips(clips);
        setStatus(GenerationStatus.COMPLETE);
      } catch (error) {
        console.error(error);
        setErrorMsg("Failed to generate content. Please check the API Key or try a different topic.");
        setStatus(GenerationStatus.ERROR);
      }
    }, 2000);
  };

  const handleReset = () => {
    setStatus(GenerationStatus.IDLE);
    setGeneratedClips([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-500 selection:text-white">
      {/* Global Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
          <div className="w-8 h-8 bg-gradient-to-tr from-brand-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">ViralEngine<span className="text-brand-400">.ai</span></span>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Showcase</a>
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-brand-300 border border-brand-500/30">
            Pro Plan (Free)
          </span>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="pt-24 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
        
        {status === GenerationStatus.IDLE && (
          <Hero onSubmit={handleGenerate} />
        )}

        {(status === GenerationStatus.ANALYZING || status === GenerationStatus.GENERATING) && (
          <Processing />
        )}

        {status === GenerationStatus.COMPLETE && (
          <Dashboard clips={generatedClips} onReset={handleReset} />
        )}

        {status === GenerationStatus.ERROR && (
          <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4 animate-in fade-in">
             <div className="text-red-500 text-6xl mb-4">⚠️</div>
             <h2 className="text-2xl font-bold">Generation Failed</h2>
             <p className="text-gray-400 max-w-md">{errorMsg}</p>
             <button 
               onClick={handleReset}
               className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
             >
               Try Again
             </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-600 text-xs border-t border-white/5 mt-auto">
        <p>© 2024 ViralEngine AI. Powered by Google Gemini 3.</p>
      </footer>
    </div>
  );
};

export default App;
