import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Video, 
  Play, 
  Download, 
  History as HistoryIcon, 
  Settings2, 
  Loader2, 
  ChevronRight,
  Monitor,
  Smartphone,
  Info,
  Lock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { enhancePrompt, generateVideo, checkOperationStatus, VideoGenerationConfig } from "@/src/lib/gemini";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface GeneratedVideo {
  id: string;
  prompt: string;
  enhancedPrompt: string;
  videoUrl?: string;
  status: "pending" | "completed" | "failed";
  operationName?: string;
  createdAt: number;
  config: VideoGenerationConfig;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<GeneratedVideo | null>(null);
  const [config, setConfig] = useState<VideoGenerationConfig>({
    resolution: "1080p",
    aspectRatio: "16:9"
  });
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback for local development or if window.aistudio is missing
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per skill instructions
    }
  };

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("vinci_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("vinci_history", JSON.stringify(history));
  }, [history]);

  // Polling for pending videos
  useEffect(() => {
    const pendingVideos = history.filter(v => v.status === "pending" && v.operationName);
    if (pendingVideos.length === 0) return;

    const interval = setInterval(async () => {
      const updatedHistory = [...history];
      let changed = false;

      for (let i = 0; i < updatedHistory.length; i++) {
        const video = updatedHistory[i];
        if (video.status === "pending" && video.operationName) {
          try {
            const op: any = await checkOperationStatus(video.operationName);
            if (op.done) {
              if (op.response?.videos?.[0]?.uri) {
                updatedHistory[i] = {
                  ...video,
                  status: "completed",
                  videoUrl: op.response.videos[0].uri
                };
                toast.success("Video generated successfully!");
              } else {
                updatedHistory[i] = { ...video, status: "failed" };
                toast.error("Video generation failed.");
              }
              changed = true;
            }
          } catch (e) {
            console.error("Polling error", e);
            // If error contains "Requested entity was not found", it might be an API key issue
            if (e instanceof Error && e.message.includes("Requested entity was not found")) {
              setHasApiKey(false);
              toast.error("API Key session expired. Please re-select your key.");
            }
          }
        }
      }

      if (changed) {
        setHistory(updatedHistory);
        // Update active video if it was one of the pending ones
        const currentActive = updatedHistory.find(v => v.id === activeVideo?.id);
        if (currentActive && currentActive.status === "completed") {
          setActiveVideo(currentActive);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [history, activeVideo]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      toast.info("Enhancing prompt for cinematic quality...");
      const enhanced = await enhancePrompt(prompt);
      
      toast.info("Starting video generation... This may take a few minutes.");
      const op = await generateVideo(enhanced, config);

      const newVideo: GeneratedVideo = {
        id: Math.random().toString(36).substring(7),
        prompt,
        enhancedPrompt: enhanced,
        status: "pending",
        operationName: op.name,
        createdAt: Date.now(),
        config
      };

      setHistory(prev => [newVideo, ...prev]);
      setActiveVideo(newVideo);
      setPrompt("");
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("PERMISSION_DENIED") || error.message?.includes("403")) {
        setHasApiKey(false);
        toast.error("Permission denied. Please select a valid paid API key.");
      } else if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        toast.error("API Key session expired. Please re-select your key.");
      } else {
        toast.error(error.message || "Failed to start generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white">
        <div className="atmosphere" />
        <Card className="glass-card p-12 max-w-md w-full text-center space-y-8 border-white/10">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
            <Lock className="w-10 h-10 text-white/40" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">API Key Required</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Veo video generation requires a paid Google Cloud project API key. Please select a key to continue.
            </p>
          </div>
          <div className="space-y-4">
            <Button 
              onClick={handleSelectKey}
              className="w-full h-14 bg-white text-black hover:bg-white/90 font-bold text-lg rounded-2xl"
            >
              Select API Key
            </Button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              Learn about billing <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Card>
      </div>
    );
  }

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden selection:bg-white/20 text-white">
      <div className="atmosphere" />
      <Toaster position="top-center" theme="dark" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center cinematic-glow">
              <Video className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">VINCI AI</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Cinematic Video Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <HistoryIcon className="w-4 h-4 mr-2" />
              History
            </Button>
            <div className="h-4 w-[1px] bg-white/10" />
            <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60">
              VEO 3.1 LITE
            </Badge>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60">Generation Prompt</h2>
              <Sparkles className="w-4 h-4 text-white/40" />
            </div>
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A futuristic city with neon lights, cinematic lighting, 8k resolution..."
                className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 text-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none placeholder:text-white/20 text-white"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !prompt.trim()}
                  className="bg-white text-black hover:bg-white/90 rounded-xl px-6 h-12 font-semibold shadow-xl shadow-white/10 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Video
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60">Engine Settings</h2>
              <Settings2 className="w-4 h-4 text-white/40" />
            </div>
            
            <Card className="glass-card p-6 space-y-8 border-white/5">
              <div className="space-y-4">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant={config.aspectRatio === "16:9" ? "default" : "outline"}
                    onClick={() => setConfig(prev => ({ ...prev, aspectRatio: "16:9" }))}
                    className={`h-20 flex-col gap-2 border-white/10 ${config.aspectRatio === "16:9" ? "bg-white text-black" : "bg-transparent text-white"}`}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="text-[10px] font-bold">16:9 Landscape</span>
                  </Button>
                  <Button 
                    variant={config.aspectRatio === "9:16" ? "default" : "outline"}
                    onClick={() => setConfig(prev => ({ ...prev, aspectRatio: "9:16" }))}
                    className={`h-20 flex-col gap-2 border-white/10 ${config.aspectRatio === "9:16" ? "bg-white text-black" : "bg-transparent text-white"}`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-[10px] font-bold">9:16 Portrait</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Resolution</label>
                <Tabs 
                  value={config.resolution} 
                  onValueChange={(v: any) => setConfig(prev => ({ ...prev, resolution: v }))}
                  className="w-full"
                >
                  <TabsList className="w-full bg-white/5 border border-white/10 h-12">
                    <TabsTrigger value="720p" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black">720p</TabsTrigger>
                    <TabsTrigger value="1080p" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black">1080p</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </Card>
          </section>

          <section className="p-4 bg-white/5 rounded-2xl border border-white/10 flex gap-4 items-start">
            <Info className="w-5 h-5 text-white/40 mt-0.5 shrink-0" />
            <p className="text-xs text-white/40 leading-relaxed">
              Video generation typically takes 2-5 minutes. You can leave this page and check back later; your progress is saved in history.
            </p>
          </section>
        </div>

        {/* Right Column: Preview & History */}
        <div className="lg:col-span-7 space-y-8">
          <AnimatePresence mode="wait">
            {activeVideo ? (
              <motion.div
                key={activeVideo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl group">
                  {activeVideo.status === "completed" && activeVideo.videoUrl ? (
                    <video 
                      src={activeVideo.videoUrl} 
                      controls 
                      autoPlay 
                      loop 
                      className="w-full h-full object-cover"
                    />
                  ) : activeVideo.status === "pending" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <Loader2 className="w-16 h-16 text-white/20 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white/40" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-medium">Generating Masterpiece</h3>
                        <p className="text-sm text-white/40 max-w-xs mx-auto">
                          Our AI engine is rendering your cinematic vision. This will take a few minutes.
                        </p>
                      </div>
                      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-white"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                      <Info className="w-12 h-12 mb-4" />
                      <p>Generation failed. Please try again.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg line-clamp-1">{activeVideo.prompt}</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">
                      Generated {new Date(activeVideo.createdAt).toLocaleString()} • {activeVideo.config.resolution} • {activeVideo.config.aspectRatio}
                    </p>
                  </div>
                  {activeVideo.status === "completed" && (
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>

                <Card className="glass-card p-6 border-white/5">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Enhanced AI Prompt</h4>
                  <p className="text-sm text-white/80 italic leading-relaxed">
                    "{activeVideo.enhancedPrompt}"
                  </p>
                </Card>
              </motion.div>
            ) : (
              <div className="aspect-video rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-white/20 space-y-4">
                <Video className="w-16 h-16 opacity-20" />
                <div className="text-center">
                  <p className="font-medium">No video generated yet</p>
                  <p className="text-sm">Enter a prompt to start your cinematic journey</p>
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* History Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60">Recent Creations</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-white/40"
                onClick={() => {
                  setHistory([]);
                  setActiveVideo(null);
                }}
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {history.map((video) => (
                <motion.div
                  key={video.id}
                  layoutId={video.id}
                  onClick={() => setActiveVideo(video)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border transition-all ${
                    activeVideo?.id === video.id ? "border-white ring-2 ring-white/20" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {video.status === "completed" && video.videoUrl ? (
                    <video src={video.videoUrl} className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      {video.status === "pending" ? (
                        <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                      ) : (
                        <Play className="w-5 h-5 text-white/20" />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                    <p className="text-[10px] font-medium line-clamp-1 text-white/80">{video.prompt}</p>
                  </div>
                </motion.div>
              ))}
              {history.length === 0 && (
                <div className="col-span-full py-12 text-center text-white/20 text-sm italic">
                  Your creation history will appear here
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-40">
            <Video className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest uppercase">Vinci AI © 2026</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Reference</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
