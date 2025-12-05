// FirstAidPage.tsx - Part 1: Imports, Types, and Helper Data
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Profile } from '@/lib/supabase';
import { 
  markTutorialComplete, 
  fetchAllTutorials, 
  getUserTutorialProgress,
  getTutorialStats,
  type Tutorial 
} from '@/lib/first-aid-utils';
import { CertificateManagement } from './first-aid/CertificateManagement';
import { 
  Heart, Search, BookOpen, Video, FileText, Clock, X, CheckCircle, 
  Award, Droplet, Flame, Tent, Compass, AlertTriangle, Wind, 
  Filter, Grid, List, ArrowUp, Loader2, Target, RefreshCw
} from 'lucide-react';

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Types
interface FirstAidPageProps {
  profile: Profile;
}

interface SurvivalSkill {
  icon: any;
  title: string;
  shortDesc: string;
  fullDesc: string;
}

// Quick Reference Data
const quickReference = [
  {
    emergency: 'Heart Attack',
    signs: ['Chest pain/pressure', 'Shortness of breath', 'Nausea', 'Cold sweats'],
    action: 'Call 911, give aspirin if available, keep person calm and seated'
  },
  {
    emergency: 'Stroke',
    signs: ['Face drooping', 'Arm weakness', 'Speech difficulty', 'Time to call 911'],
    action: 'Use FAST test, call 911 immediately, note time symptoms started'
  },
  {
    emergency: 'Severe Bleeding',
    signs: ['Blood spurting or flowing', 'Blood soaking through bandages', 'Wound > 1 inch deep'],
    action: 'Apply direct pressure, elevate if possible, call 911'
  }
];

// Survival Skills Data
const survivalSkills: SurvivalSkill[] = [
  {
    icon: Droplet,
    title: 'Water Purification',
    shortDesc: 'Safe drinking water methods',
    fullDesc: 'Learn essential techniques for purifying water in emergency situations. Methods include boiling (most effective - boil for 1 minute at sea level, 3 minutes at high altitude), water purification tablets, portable filters, UV light purifiers, and improvised solar disinfection (SODIS method).'
  },
  {
    icon: Flame,
    title: 'Fire Starting',
    shortDesc: 'Building fires without matches',
    fullDesc: 'Master multiple fire-starting techniques including friction methods (bow drill, hand drill), flint and steel, magnifying glass, battery and steel wool, and fire piston. Learn the fire triangle (heat, fuel, oxygen) and proper fire structures.'
  },
  {
    icon: Tent,
    title: 'Emergency Shelter',
    shortDesc: 'Creating temporary shelter',
    fullDesc: 'Construct life-saving emergency shelters using available materials. Learn to build lean-to shelters, debris huts, snow caves, and improvised tarps. Key principles: insulation from ground, protection from wind and rain, proper ventilation.'
  },
  {
    icon: Compass,
    title: 'Navigation',
    shortDesc: 'Finding your way without GPS',
    fullDesc: 'Navigate using natural indicators and basic tools. Learn to use the sun, stars (North Star/Polaris), shadow stick method, moss patterns, and improvised compass using magnetized needle. Always mark your trail and stay visible to rescuers.'
  },
  {
    icon: AlertTriangle,
    title: 'Emergency Signals',
    shortDesc: 'Calling for help effectively',
    fullDesc: 'Master various signaling techniques to attract rescuers. Use the universal distress signal: 3 of anything (3 whistle blasts, 3 fires, 3 smoke columns). Create ground-to-air signals (SOS, X for medical help). Use mirrors, bright materials, and noise makers.'
  },
  {
    icon: Wind,
    title: 'Weather Reading',
    shortDesc: 'Predicting weather changes',
    fullDesc: 'Identify weather patterns and prepare for changes. Learn to read clouds (cumulus = fair weather, cumulonimbus = storms, cirrus = weather change in 24 hrs), wind direction changes, animal behavior, and barometric pressure indicators.'
  }
];

// Helper function to extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^&?\/\s]{11})/,
    /^([^&?\/\s]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Continue to Part 2...
// FirstAidPage.tsx - Part 2: Main Component Logic and State Management

export function FirstAidPage({ profile }: FirstAidPageProps) {
  // State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ 
    total: 0, 
    completed: 0, 
    inProgress: 0, 
    completionRate: 0 
  });
  const [expandedSkill, setExpandedSkill] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeSection, setActiveSection] = useState('tutorials');
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [isYTReady, setIsYTReady] = useState(false);

  const categories = ['All', 'Life-Saving', 'Basic First Aid', 'Environmental', 
                      'Medical Emergencies', 'Survival Skills', 'Trauma Care'];
  const isAdmin = profile.role === 'admin' || profile.role === 'instructor';

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYTReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsYTReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    if (!selectedTutorial || !selectedTutorial.video_url || !isYTReady) {
      return;
    }

    const videoId = extractYouTubeVideoId(selectedTutorial.video_url);
    if (!videoId) return;

    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {
        console.log('Error destroying player');
      }
      setYtPlayer(null);
    }

    setTimeout(() => {
      const containerId = `youtube-player-${selectedTutorial.id}`;
      const container = document.getElementById(containerId);
      
      if (!container) return;

      try {
        const player = new window.YT.Player(containerId, {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === 0) {
                handleVideoComplete();
              }
            }
          }
        });

        setYtPlayer(player);
      } catch (error) {
        console.error('Error creating YouTube player:', error);
      }
    }, 100);

    return () => {
      if (ytPlayer) {
        try {
          ytPlayer.destroy();
        } catch (e) {
          console.log('Cleanup error');
        }
      }
    };
  }, [selectedTutorial?.id, isYTReady]);

  // Event Handlers
  const handleVideoComplete = async () => {
    if (!selectedTutorial || isAdmin) return;

    const success = await markTutorialComplete(profile.id, selectedTutorial.id);
    
    if (success) {
      setCompletedTutorials(prev => new Set([...prev, selectedTutorial.id]));
      const statsData = await getTutorialStats(profile.id);
      setStats(statsData);
    }
  };

  const handleManualComplete = async () => {
    if (!selectedTutorial || isAdmin) return;

    const success = await markTutorialComplete(profile.id, selectedTutorial.id);
    
    if (success) {
      setCompletedTutorials(prev => new Set([...prev, selectedTutorial.id]));
      const statsData = await getTutorialStats(profile.id);
      setStats(statsData);
    }
  };

  const loadData = async () => {
    setLoading(true);
    
    try {
      const tutorialsData = await fetchAllTutorials();
      setTutorials(tutorialsData);
      
      if (!isAdmin) {
        const progressData = await getUserTutorialProgress(profile.id);
        const completedIds = new Set(
          progressData.filter(p => p.completed).map(p => p.tutorial_id)
        );
        setCompletedTutorials(completedIds);
        
        const statsData = await getTutorialStats(profile.id);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const closeTutorialModal = () => {
    setSelectedTutorial(null);
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {
        console.log('Error destroying player');
      }
      setYtPlayer(null);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
    
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter tutorials
  const filteredTutorials = tutorials.filter(tutorial => {
    const matchesSearch = tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tutorial.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || tutorial.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isCompleted = selectedTutorial ? completedTutorials.has(selectedTutorial.id) : false;

  // Continue to Part 3 for the JSX render...
  // FirstAidPage.tsx - Part 3: JSX Render (continues from Part 2)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tutorial Detail Modal */}
        {selectedTutorial && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-3xl font-bold">{selectedTutorial.title}</h2>
                      {isCompleted && (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    {selectedTutorial.description && (
                      <p className="text-gray-600 text-lg">{selectedTutorial.description}</p>
                    )}
                  </div>
                  <button
                    onClick={closeTutorialModal}
                    className="p-2 hover:bg-gray-100 rounded-lg ml-4 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {selectedTutorial.video_url && (
                  <div className="mb-6">
                    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden" 
                         style={{ paddingBottom: '56.25%' }}>
                      <div 
                        id={`youtube-player-${selectedTutorial.id}`}
                        className="absolute top-0 left-0 w-full h-full"
                      />
                    </div>
                    {!isAdmin && !isCompleted && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 flex items-center gap-2">
                          <Video className="w-4 h-4 flex-shrink-0" />
                          <span>Watch the complete video to automatically mark this tutorial as completed!</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedTutorial.content && (
                  <div className="mb-6 prose max-w-none">
                    <style dangerouslySetInnerHTML={{ __html: `
                      .prose h2 {
                        font-size: 1.5rem;
                        font-weight: 700;
                        margin-top: 1.5rem;
                        margin-bottom: 0.75rem;
                        color: #1f2937;
                        border-bottom: 2px solid #ef4444;
                        padding-bottom: 0.5rem;
                      }
                      .prose h2:first-child { margin-top: 0; }
                      .prose h3 {
                        font-size: 1.25rem;
                        font-weight: 600;
                        margin-top: 1.25rem;
                        margin-bottom: 0.5rem;
                        color: #374151;
                      }
                      .prose p {
                        margin-bottom: 1rem;
                        line-height: 1.75;
                        color: #4b5563;
                      }
                      .prose ul, .prose ol {
                        margin-bottom: 1rem;
                        padding-left: 1.5rem;
                        line-height: 1.75;
                      }
                      .prose ul { list-style-type: disc; }
                      .prose ol { list-style-type: decimal; }
                      .prose li {
                        margin-bottom: 0.5rem;
                        color: #4b5563;
                      }
                    `}} />
                    <div dangerouslySetInnerHTML={{ __html: selectedTutorial.content }} />
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                  {!isCompleted && !isAdmin && !selectedTutorial.video_url && (
                    <Button 
                      onClick={handleManualComplete}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Complete
                    </Button>
                  )}
                  <Button
                    onClick={closeTutorialModal}
                    variant="outline"
                    className={!isCompleted && !isAdmin && !selectedTutorial.video_url ? "flex-1" : "w-full"}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
              <h1 className="text-4xl font-bold mb-2 text-gray-900">
                First Aid & Survival Training
              </h1>
              <p className="text-gray-600 text-lg mb-6">
                Master life-saving techniques with visual and text-based guides
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => scrollToSection('tutorials')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Tutorials
                </Button>
                <Button 
                  onClick={() => scrollToSection('emergency')}
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Quick Reference
                </Button>
                <Button 
                  onClick={() => scrollToSection('survival')}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Survival Skills
                </Button>
                {isAdmin && (
                  <Button 
                    onClick={() => scrollToSection('certificates')}
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    Certificates
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="ml-auto"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </Card>

            {/* Progress Stats */}
            {!isAdmin && (
              <Card className="p-6 bg-gradient-to-br from-green-50 to-white border-green-100">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-6 h-6 text-green-600" />
                  <h3 className="font-semibold text-lg">Your Progress</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Completion Rate</span>
                      <span className="font-bold text-gray-900">{stats.completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-green-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                    <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                      <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                      <div className="text-xs text-gray-600">Completed</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                      <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                      <div className="text-xs text-gray-600">In Progress</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Emergency Quick Reference */}
        <section id="emergency" className="mb-12 scroll-mt-20">
          <Card className="p-6 bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-amber-600" />
                <h2 className="text-2xl font-bold">Emergency Quick Reference</h2>
                <Badge className="bg-amber-600 text-white">Critical</Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickReference.map((item, index) => (
                <div key={index} className="p-5 bg-white rounded-lg border-2 border-amber-200 hover:border-amber-400 transition-all hover:shadow-md">
                  <h3 className="mb-3 font-bold text-lg text-amber-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {item.emergency}
                  </h3>
                  
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Signs:</p>
                    <ul className="text-sm space-y-2">
                      {item.signs.map((sign, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold mt-0.5">•</span>
                          <span className="text-gray-700">{sign}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="pt-3 border-t-2 border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Action:</p>
                    <p className="text-sm font-medium text-gray-900">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Continue to Part 4 for Tutorials Section... */}
        

        {/* Tutorials Section */}
        <section id="tutorials" className="mb-12 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Tutorial Library</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-gray-100' : ''}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-gray-100' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="p-4 mb-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search tutorials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-md scale-105'
                          : 'bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Tutorials Grid/List */}
          {loading ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p>Loading tutorials...</p>
              </div>
            </Card>
          ) : filteredTutorials.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-lg">No tutorials found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </Card>
          ) : (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
            }>
              {filteredTutorials.map(tutorial => {
                const tutorialCompleted = completedTutorials.has(tutorial.id);
                
                return (
                  <Card 
                    key={tutorial.id} 
                    className={`p-6 hover:shadow-xl transition-all duration-300 cursor-pointer ${
                      tutorialCompleted && !isAdmin 
                        ? 'border-green-300 bg-gradient-to-br from-green-50 to-white' 
                        : 'hover:border-indigo-200'
                    }`}
                    onClick={() => setSelectedTutorial(tutorial)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant="outline" className="font-semibold">
                        {tutorial.category}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                          {tutorial.difficulty}
                        </Badge>
                        {tutorialCompleted && !isAdmin && (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle className="w-3 h-3" />
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h3 className="mb-2 font-bold text-xl hover:text-indigo-600 transition-colors">
                      {tutorial.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {tutorial.description}
                    </p>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span>{tutorial.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-purple-600" />
                          <span>{tutorial.steps} steps</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        {tutorial.type?.includes('Visual') && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-md">
                            <Video className="w-4 h-4 text-purple-600" />
                            <span className="text-purple-700 font-medium">Visual</span>
                          </div>
                        )}
                        {tutorial.type?.includes('Text') && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-blue-700 font-medium">Text</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      className={`w-full ${
                        tutorialCompleted 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      } text-white`}
                    >
                      {tutorialCompleted ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Review Tutorial
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4 mr-2" />
                          Start Learning
                        </>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Admin Certificate Management */}
        {isAdmin && (
          <section id="certificates" className="mb-12 scroll-mt-20">
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <div className="flex items-center gap-3 mb-6">
                <Award className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold">Certificate Management</h2>
                <Badge className="bg-purple-600 text-white ml-auto">Admin</Badge>
              </div>
              
              <CertificateManagement tutorials={tutorials} />
            </Card>
          </section>
        )}

        {/* Survival Skills Section */}
        <section id="survival" className="scroll-mt-20">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Compass className="w-6 h-6 text-orange-600" />
              <h2 className="text-2xl font-bold">Essential Survival Skills</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {survivalSkills.map((skill, index) => {
                const Icon = skill.icon;
                const isExpanded = expandedSkill === index;
                
                return (
                  <div 
                    key={index} 
                    onClick={() => setExpandedSkill(isExpanded ? null : index)}
                    className={`p-5 rounded-lg border-2 transition-all cursor-pointer ${
                      isExpanded 
                        ? 'bg-gradient-to-br from-orange-50 to-white border-orange-400 shadow-lg' 
                        : 'bg-gray-50 border-gray-200 hover:border-orange-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${isExpanded ? 'bg-orange-100' : 'bg-white'}`}>
                        <Icon className={`w-6 h-6 ${isExpanded ? 'text-orange-600' : 'text-gray-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold mb-1">{skill.title}</h3>
                        <p className="text-sm text-gray-600">{skill.shortDesc}</p>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t-2 border-orange-200">
                        <p className="text-sm text-gray-700 leading-relaxed">{skill.fullDesc}</p>
                      </div>
                    )}
                    
                    <div className="mt-3 text-xs font-semibold flex items-center gap-1">
                      <span className={isExpanded ? 'text-orange-600' : 'text-gray-500'}>
                        {isExpanded ? '▲ Collapse' : '▼ Learn more'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </div>

      {/* Back to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// END OF FirstAidPage.tsx
// Remember to also create:
// - components/first-aid/CertificateManagement.tsx
// - components/first-aid/CertificatePDF.ts
// As shown in the clean structure artifact