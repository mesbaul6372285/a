import React, { useState, useEffect, useRef } from 'react';
import { ViralClip } from '../types';
import { generateVoiceover, generateVeoBackground } from '../services/geminiService';
import { Play, Pause, Video, Share2, Zap, Loader2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  clips: ViralClip[];
  onReset: () => void;
}

// --- Audio Helpers ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Simple background music placeholder (Upbeat Lo-Fi style)
const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3";

export const Dashboard: React.FC<DashboardProps> = ({ clips, onReset }) => {
  const [selectedClip, setSelectedClip] = useState<ViralClip>(clips[0]);
  
  // Caches
  const [audioCache, setAudioCache] = useState<Record<string, AudioBuffer>>({}); 
  const [bgmBuffer, setBgmBuffer] = useState<AudioBuffer | null>(null);
  const [videoCache, setVideoCache] = useState<Record<string, string>>({}); // ID -> Blob URL
  
  // States
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  
  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(15);
  
  // Refs for Web Audio Graph
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const voiceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Stats
  const data = [
    { subject: 'Retention', A: 90 + (Math.random() * 10), fullMark: 100 },
    { subject: 'Hook', A: 85 + (Math.random() * 15), fullMark: 100 },
    { subject: 'Trend', A: 80 + (Math.random() * 20), fullMark: 100 },
    { subject: 'Pacing', A: 95, fullMark: 100 },
    { subject: 'CTA', A: 70 + (Math.random() * 30), fullMark: 100 },
  ];

  // --- Initialization ---

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate: 48000 });
    audioContextRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 1.0;
    
    const vGain = ctx.createGain();
    vGain.gain.value = 1.0; // Voice Level
    
    const mGain = ctx.createGain();
    mGain.gain.value = 0.12; // Ducked Music Level
    
    vGain.connect(master);
    mGain.connect(master);
    master.connect(ctx.destination);
    
    const streamDest = ctx.createMediaStreamDestination();
    master.connect(streamDest);
    
    masterGainRef.current = master;
    voiceGainRef.current = vGain;
    musicGainRef.current = mGain;
    audioDestRef.current = streamDest;

    // Load BGM
    fetch(BGM_URL)
      .then(res => res.arrayBuffer())
      .then(arr => ctx.decodeAudioData(arr))
      .then(buf => setBgmBuffer(buf))
      .catch(err => console.warn("BGM Load failed", err));

    // Video Element
    const vid = document.createElement('video');
    vid.loop = true;
    vid.muted = true;
    vid.crossOrigin = "anonymous"; // Important for Veo export
    vid.playsInline = true;
    vid.autoplay = false;
    vid.onerror = (e) => console.error("Video Element Error", e);
    videoElementRef.current = vid;

    return () => {
      if (ctx.state !== 'closed') ctx.close();
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `https://picsum.photos/seed/${selectedClip.id}/720/1280`;
    img.onload = () => {
      bgImageRef.current = img;
      if (!isPlaying) drawFrame(0);
    };
  }, [selectedClip.id]);

  useEffect(() => {
    stopPlayback(); 
    setCurrentTime(0);
    pausedAtRef.current = 0;
    setAudioError(null);
    setVideoError(null);
    setDuration(selectedClip.captions[selectedClip.captions.length - 1]?.end || 15);

    // Sync Video
    if (videoElementRef.current) {
        if (videoCache[selectedClip.id]) {
            videoElementRef.current.src = videoCache[selectedClip.id];
            videoElementRef.current.load();
        } else {
            videoElementRef.current.removeAttribute('src');
            videoElementRef.current.load(); 
        }
    }

    const loadVoice = async () => {
      if (audioCache[selectedClip.id]) {
        setDuration(audioCache[selectedClip.id].duration);
        return;
      }
      
      setIsAudioLoading(true);
      try {
        let base64Audio = selectedClip.audioData;
        if (!base64Audio) {
           base64Audio = await generateVoiceover(selectedClip.script);
        }

        if (base64Audio && audioContextRef.current) {
          const audioBytes = decode(base64Audio);
          const decodedBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
          setAudioCache(prev => ({ ...prev, [selectedClip.id]: decodedBuffer }));
          setDuration(decodedBuffer.duration);
        }
      } catch (err) {
        console.error("Audio Error", err);
        setAudioError("Failed to generate audio.");
      } finally {
        setIsAudioLoading(false);
      }
    };

    loadVoice();
  }, [selectedClip.id]);

  const handleGenerateVeo = async () => {
    if (isVideoLoading) return;
    setIsVideoLoading(true);
    setVideoError(null);

    try {
        // Feature detection for AI Studio environment (specific to Project IDX)
        const aistudio = (window as any).aistudio;
        if (aistudio) {
            const hasKey = await aistudio.hasSelectedApiKey();
            if (!hasKey) {
                const success = await aistudio.openSelectKey();
                if (!success) throw new Error("Key selection cancelled");
            }
        }

        // 1. Get Signed URL
        const videoUrl = await generateVeoBackground(selectedClip.hook);
        
        // 2. Fetch Blob
        // Note: If deploying to a domain that is not allowed by Veo's CORS policy, this might fail.
        // We try catch specifically for this.
        let blobUrl = '';
        try {
            const res = await fetch(videoUrl);
            if (!res.ok) throw new Error(`Video fetch failed: ${res.statusText}`);
            const blob = await res.blob();
            if (blob.size === 0) throw new Error("Received empty video file.");
            blobUrl = URL.createObjectURL(blob);
        } catch (fetchErr) {
            console.warn("CORS fetch failed, falling back to direct URL (Export might fail)", fetchErr);
            // Fallback: Use the direct URL. Video will play, but Canvas Export might be tainted.
            blobUrl = videoUrl;
        }
        
        setVideoCache(prev => ({ ...prev, [selectedClip.id]: blobUrl }));
        
        if (videoElementRef.current) {
            videoElementRef.current.src = blobUrl;
            videoElementRef.current.load();
            if (isPlaying) {
                videoElementRef.current.play().catch(console.error);
            }
        }

    } catch (e: any) {
        console.error("Veo Error", e);
        setVideoError("Could not load video. Check your network or API quota.");
    } finally {
        setIsVideoLoading(false);
    }
  };

  // --- Playback Engine ---

  const startPlayback = async () => {
    if (!audioContextRef.current || isAudioLoading || audioError) return;
    const voiceBuffer = audioCache[selectedClip.id];
    if (!voiceBuffer) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (voiceNodeRef.current) try { voiceNodeRef.current.stop(); } catch(e){}
    if (musicNodeRef.current) try { musicNodeRef.current.stop(); } catch(e){}

    const voiceSrc = audioContextRef.current.createBufferSource();
    voiceSrc.buffer = voiceBuffer;
    if (voiceGainRef.current) voiceSrc.connect(voiceGainRef.current);

    let musicSrc: AudioBufferSourceNode | null = null;
    if (bgmBuffer && musicGainRef.current) {
        musicSrc = audioContextRef.current.createBufferSource();
        musicSrc.buffer = bgmBuffer;
        musicSrc.loop = true;
        musicSrc.connect(musicGainRef.current);
    }

    if (pausedAtRef.current >= voiceBuffer.duration) {
      pausedAtRef.current = 0;
    }
    const offset = pausedAtRef.current;
    
    voiceSrc.start(0, offset);
    if (musicSrc) musicSrc.start(0, offset % bgmBuffer!.duration);

    startTimeRef.current = audioContextRef.current.currentTime - offset;
    
    voiceNodeRef.current = voiceSrc;
    musicNodeRef.current = musicSrc;

    // Start Video (Synced)
    if (videoElementRef.current && videoCache[selectedClip.id]) {
        videoElementRef.current.currentTime = offset % videoElementRef.current.duration;
        videoElementRef.current.play().catch(e => console.log("Video play error", e));
    }

    setIsPlaying(true);
    requestAnimationFrame(updateLoop);
  };

  const stopPlayback = () => {
    if (voiceNodeRef.current) { try { voiceNodeRef.current.stop(); } catch(e){}; voiceNodeRef.current = null; }
    if (musicNodeRef.current) { try { musicNodeRef.current.stop(); } catch(e){}; musicNodeRef.current = null; }
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (videoElementRef.current) videoElementRef.current.pause();

    if (audioContextRef.current && isPlaying) {
        pausedAtRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    }
    setIsPlaying(false);
  };

  const updateLoop = () => {
    if (!audioContextRef.current || !isPlaying) return;
    
    const now = audioContextRef.current.currentTime - startTimeRef.current;
    const buffer = audioCache[selectedClip.id];
    const maxDuration = buffer?.duration || duration;

    if (now >= maxDuration) {
      stopPlayback();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRendering(false);
      pausedAtRef.current = 0;
      setCurrentTime(0);
      drawFrame(0);
      return;
    }

    if (videoElementRef.current && videoCache[selectedClip.id] && !videoElementRef.current.paused) {
        const vidDur = videoElementRef.current.duration;
        if (vidDur > 0) {
            const vidTime = videoElementRef.current.currentTime;
            const expectedTime = now % vidDur;
            const diff = Math.abs(vidTime - expectedTime);
            if (diff > 0.3 && diff < (vidDur - 0.3)) {
                videoElementRef.current.currentTime = expectedTime;
            }
        }
    }

    setCurrentTime(now);
    drawFrame(now);

    animationFrameRef.current = requestAnimationFrame(updateLoop);
  };

  // --- Rendering ---
  const drawFrame = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Background
    const video = videoElementRef.current;
    const hasVideo = videoCache[selectedClip.id] && video && video.readyState >= 2;

    if (hasVideo && video) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;
        if (vW && vH) {
             const scale = Math.max(width / vW, height / vH);
            const x = (width - vW * scale) / 2;
            const y = (height - vH * scale) / 2;
            ctx.drawImage(video, x, y, vW * scale, vH * scale);
        }
    } else if (bgImageRef.current) {
        // Ken Burns Effect
        const progress = Math.min(1, time / duration);
        const scale = 1.0 + (progress * 0.15); 
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const offsetX = (width - scaledWidth) / 2;
        const offsetY = (height - scaledHeight) / 2;
        ctx.drawImage(bgImageRef.current, offsetX, offsetY, scaledWidth, scaledHeight);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#111827');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    // 2. Overlay
    const gradient = ctx.createRadialGradient(width/2, height/2, width/3, width/2, height/2, height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 3. Captions (Dynamic "Hormozi" Style)
    const currentSeg = selectedClip.captions.find(
      seg => time >= seg.start && time <= seg.end
    );

    if (currentSeg) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const baseSize = 72; // Larger font
      const isHighlight = currentSeg.highlight;
      
      const wordDuration = currentSeg.end - currentSeg.start;
      const wordProgress = (time - currentSeg.start) / wordDuration;
      const popScale = isHighlight ? 1 + (0.2 * (1 - Math.min(1, wordProgress * 4))) : 1;
      
      const fontSize = baseSize * popScale;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      
      const x = width / 2;
      const y = height * 0.6; 

      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'black';
      ctx.strokeText(currentSeg.text.toUpperCase(), x, y);

      ctx.shadowColor = "transparent";

      ctx.fillStyle = isHighlight ? '#FACC15' : '#FFFFFF'; 
      ctx.fillText(currentSeg.text.toUpperCase(), x, y);
    }
  };

  const handleExport = async () => {
    if (isRendering) return;
    if (!audioCache[selectedClip.id]) return alert("Audio not ready.");
    
    setIsRendering(true);
    stopPlayback();
    pausedAtRef.current = 0;
    setCurrentTime(0);

    const canvas = canvasRef.current;
    const audioDest = audioDestRef.current;
    if (!canvas || !audioDest) {
        setIsRendering(false);
        return;
    }

    drawFrame(0);

    try {
        const canvasStream = canvas.captureStream(30); 
        const audioStream = audioDest.stream; 
        
        const combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ]);

        const mimeTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm;codecs=h264',
            'video/webm'
        ];
        
        let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
        if (!selectedMime) {
            console.warn("No specific WebM codec supported, falling back to default.");
            selectedMime = 'video/webm'; 
        }

        const recorder = new MediaRecorder(combinedStream, { mimeType: selectedMime });
        chunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          if (blob.size < 100) {
              alert("Export Failed: Video file was empty. (Possibly CORS taint if Veo fallback used).");
          } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `viral_clip_${selectedClip.id}.webm`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          }
          setIsRendering(false);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        await new Promise(r => setTimeout(r, 200));
        await startPlayback();
    } catch (e) {
        console.error("Export error", e);
        setIsRendering(false);
        alert("Export failed. Please use Chrome/Edge for best results.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white">Viral Studio</h1>
          <p className="text-gray-400 text-sm">AI Generated Results</p>
        </div>
        <button 
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          Create New
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-4 overflow-y-auto max-h-[80vh] pr-2 custom-scrollbar">
          {clips.map((clip) => (
            <div 
              key={clip.id}
              onClick={() => setSelectedClip(clip)}
              className={`p-4 rounded-xl cursor-pointer border transition-all hover:scale-[1.02] ${
                selectedClip.id === clip.id 
                  ? 'bg-brand-900/20 border-brand-500 ring-1 ring-brand-500' 
                  : 'bg-gray-900/50 border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  clip.viralScore > 90 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  Score: {clip.viralScore}
                </span>
                <span className="text-xs text-gray-500">{clip.category}</span>
              </div>
              <h3 className="font-semibold text-sm line-clamp-2 mb-2 text-gray-100">{clip.title}</h3>
              <p className="text-xs text-gray-400 line-clamp-2">{clip.hook}</p>
            </div>
          ))}
        </div>

        {/* Center: Video Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative aspect-[9/16] h-[600px] bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl shadow-brand-900/20 group w-full max-w-sm">
            <canvas 
              ref={canvasRef}
              width={720}
              height={1280}
              className="w-full h-full object-cover"
            />

            {/* Overlays */}
            {(isAudioLoading || isVideoLoading) && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-2" />
                <span className="text-white font-bold text-sm">
                    {isVideoLoading ? "Generating 4K Veo Video..." : "Synthesizing Voice..."}
                </span>
              </div>
            )}
            
            {isRendering && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-8 text-center">
                <RefreshCw className="w-12 h-12 text-brand-400 animate-spin mb-4" />
                <span className="text-white font-bold text-lg">Rendering & Exporting...</span>
                <span className="text-yellow-400 text-sm mt-4 font-semibold animate-pulse">
                  ⚠ DO NOT SWITCH TABS
                </span>
                <span className="text-gray-400 text-xs mt-1">Browser throttling will break the recording.</span>
              </div>
            )}

             {audioError && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 p-6 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
                <span className="text-white font-bold text-sm mb-2">{audioError}</span>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-auto">
              <div className="flex items-center justify-center space-x-6">
                 <button 
                  onClick={() => isPlaying ? stopPlayback() : startPlayback()}
                  disabled={isAudioLoading || isVideoLoading || isRendering || !!audioError}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-xl"
                >
                  {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                 </button>
              </div>
              <div className="mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-500" 
                  style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 mt-6">
             <button
                onClick={handleGenerateVeo}
                disabled={isVideoLoading || !!videoCache[selectedClip.id] || isRendering}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold transition-all border ${
                    videoCache[selectedClip.id] 
                    ? 'bg-green-900/20 border-green-500 text-green-400 cursor-default'
                    : 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 disabled:opacity-50'
                }`}
             >
                <Sparkles className="w-5 h-5" />
                <span>{videoCache[selectedClip.id] ? "Veo Generated" : "Generate Veo Background"}</span>
             </button>

            <button 
              onClick={handleExport}
              disabled={isAudioLoading || isVideoLoading || isRendering || !audioCache[selectedClip.id]}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold transition-all shadow-lg ${
                 isRendering 
                 ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                 : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-900/50'
              }`}
            >
              {isRendering ? <Loader2 className="w-5 h-5 animate-spin"/> : <Video className="w-5 h-5" />}
              <span>{isRendering ? "Rendering..." : "Export Video"}</span>
            </button>
          </div>
          {videoError && <p className="text-red-400 text-xs mt-2 text-center w-full max-w-sm">{videoError}</p>}
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold flex items-center text-brand-300">
                 <Zap className="w-4 h-4 mr-2" /> Viral Potential
               </h3>
               <span className="text-2xl font-black text-white">{selectedClip.viralScore}/100</span>
             </div>
             <div className="h-48 w-full -ml-4 relative" style={{ minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Viral Stats" dataKey="A" stroke="#14b8a6" strokeWidth={2} fill="#14b8a6" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
             </div>
             <p className="text-xs text-gray-400 mt-2 bg-black/40 p-3 rounded border border-gray-800">
               <span className="text-brand-400 font-bold">AI Insight:</span> {selectedClip.explanation}
             </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col flex-1 min-h-[300px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center text-gray-300">
                <Share2 className="w-4 h-4 mr-2" /> Social Metadata
              </h3>
            </div>
            
            <div className="space-y-4 overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Caption</label>
                 <div className="text-sm text-gray-300 bg-black/20 p-2 rounded mt-1 border border-gray-800 leading-relaxed whitespace-pre-wrap">
                   {selectedClip.socialDescription}
                   <br/>
                   <br/>
                   <span className="text-brand-400">{selectedClip.hashtags.join(" ")}</span>
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Hook (0-3s)</label>
                 <div className="text-sm font-bold text-yellow-400 bg-yellow-900/10 p-2 rounded mt-1 border border-yellow-900/30">{selectedClip.hook}</div>
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Full Script</label>
                 <div className="text-sm text-gray-400 bg-black/20 p-2 rounded mt-1 border border-gray-800 leading-relaxed">{selectedClip.script}</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};