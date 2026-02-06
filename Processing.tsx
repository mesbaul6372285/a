import React, { useEffect, useState } from 'react';
import { Loader2, Zap, BrainCircuit, Scissors } from 'lucide-react';

const steps = [
  { icon: <Zap className="w-6 h-6 text-yellow-400" />, text: "Connecting to Viral Matrix..." },
  { icon: <BrainCircuit className="w-6 h-6 text-purple-400" />, text: "Analyzing semantic patterns..." },
  { icon: <Scissors className="w-6 h-6 text-pink-400" />, text: "Extracting high-retention moments..." },
  { icon: <Zap className="w-6 h-6 text-brand-400" />, text: "Finalizing viral captions..." },
];

export const Processing: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-brand-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
        <Loader2 className="w-24 h-24 text-brand-400 animate-spin relative z-10" />
      </div>
      
      <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tighter">
        AI IS WORKING
      </h2>

      <div className="flex flex-col space-y-4 w-full max-w-md">
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`flex items-center space-x-4 p-4 rounded-xl border transition-all duration-500 ${
              index <= currentStep 
                ? 'bg-white/5 border-brand-500/50 text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                : 'bg-transparent border-transparent text-gray-600 opacity-50'
            }`}
          >
            <div className={`${index <= currentStep ? 'animate-bounce' : ''}`}>
              {step.icon}
            </div>
            <span className="font-medium font-mono">{step.text}</span>
            {index === currentStep && (
              <span className="ml-auto w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
