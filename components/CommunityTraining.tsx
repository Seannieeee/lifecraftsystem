import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Users, Clock, Heart, Award, Loader2, Plus, Edit, ClipboardList, XCircle, Search, SlidersHorizontal, RefreshCw, ChevronDown, Trash2, X } from 'lucide-react';
import { AdminRegistrations } from './AdminRegistrations';
import { getSessionsWithStats, registerForSession, createSession, updateSession, deleteSession } from '@/lib/community-utils';

// Types
interface UserRegistration {
  status: 'pending' | 'registered' | 'approved' | 'declined';
}

interface SessionWithStats {
  id: string;
  title: string;
  organization: string;
  category: string;
  date: string;
  time: string;
  location: string;
  instructor?: string;
  capacity: number;
  registered_count: number;
  available_spots: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  certified: boolean;
  volunteer: boolean;
  user_registration?: UserRegistration | null;
}

// In-memory cache
let sessionCache: { data: SessionWithStats[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCache = () => {
  if (!sessionCache) return null;
  
  if (Date.now() - sessionCache.timestamp > CACHE_DURATION) {
    sessionCache = null;
    return null;
  }
  return sessionCache.data;
};

const setCache = (data: SessionWithStats[]) => {
  sessionCache = {
    data,
    timestamp: Date.now()
  };
};

interface CommunityTrainingProps {
  profile: {
    id: string;
    role: string;
  };
}

export function CommunityTraining({ profile }: CommunityTrainingProps) {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [certifiedFilter, setCertifiedFilter] = useState<boolean | null>(null);
  const [volunteerFilter, setVolunteerFilter] = useState<boolean | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'spots' | 'popular'>('date');
  
  // Tab state for admin users
  const [activeTab, setActiveTab] = useState<'training' | 'registrations'>('training');
  
  // Session management states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithStats | null>(null);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    organization: '',
    category: '',
    level: 'Beginner',
    date: '',
    time: '',
    location: '',
    instructor: '',
    capacity: 20,
    certified: false,
    volunteer: false,
    description: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const isAdmin = profile.role === 'admin';

  useEffect(() => {
    if (activeTab === 'training') {
      loadSessions();
    }
  }, [profile.id, activeTab]);

  const loadSessions = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        setLoading(true);
        const cached = getCache();
        if (cached) {
          setSessions(cached);
          setLoading(false);
          return;
        }
      } else {
        setRefreshing(true);
      }

      const data = await getSessionsWithStats(profile.id);
      
      const formattedData: SessionWithStats[] = data.map(session => ({
        id: session.id,
        title: session.title,
        organization: session.organization || '',
        category: session.category || 'General',
        date: session.date,
        time: session.time,
        location: session.location,
        instructor: session.instructor || undefined,
        capacity: session.capacity,
        registered_count: session.registered_count,
        available_spots: session.available_spots,
        level: (session.level as 'Beginner' | 'Intermediate' | 'Advanced') || 'Beginner',
        certified: session.certified,
        volunteer: session.volunteer,
        user_registration: session.user_registration ? {
          status: session.user_registration.status as 'pending' | 'registered' | 'approved' | 'declined'
        } : null
      }));
      
      setSessions(formattedData);
      setCache(formattedData);
    } catch (error) {
      console.error('Error loading sessions:', error);
      alert('Failed to load sessions. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadSessions(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!sessionForm.title.trim()) errors.title = 'Title is required';
    if (!sessionForm.date) errors.date = 'Date is required';
    if (!sessionForm.time.trim()) errors.time = 'Time is required';
    if (!sessionForm.location.trim()) errors.location = 'Location is required';
    if (sessionForm.capacity < 1) errors.capacity = 'Capacity must be at least 1';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSession = async () => {
    if (!validateForm()) return;
    
    try {
      setActionLoading('create');
      await createSession({
        title: sessionForm.title,
        organization: sessionForm.organization,
        category: sessionForm.category,
        level: sessionForm.level,
        date: sessionForm.date,
        time: sessionForm.time,
        location: sessionForm.location,
        instructor: sessionForm.instructor,
        capacity: sessionForm.capacity,
        certified: sessionForm.certified,
        volunteer: sessionForm.volunteer,
        description: sessionForm.description
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
      await loadSessions(true);
      alert('Session created successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to create session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSession = async () => {
    if (!selectedSession || !validateForm()) return;
    
    try {
      setActionLoading('edit');
      await updateSession(selectedSession.id, {
        title: sessionForm.title,
        organization: sessionForm.organization,
        category: sessionForm.category,
        level: sessionForm.level,
        date: sessionForm.date,
        time: sessionForm.time,
        location: sessionForm.location,
        instructor: sessionForm.instructor,
        capacity: sessionForm.capacity,
        certified: sessionForm.certified,
        volunteer: sessionForm.volunteer,
        description: sessionForm.description
      });
      
      setIsEditDialogOpen(false);
      resetForm();
      await loadSessions(true);
      alert('Session updated successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to update session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    
    try {
      setActionLoading('delete');
      await deleteSession(selectedSession.id);
      
      setIsDeleteDialogOpen(false);
      await loadSessions(true);
      alert('Session deleted successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to delete session');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditDialog = (session: SessionWithStats) => {
    setSelectedSession(session);
    setSessionForm({
      title: session.title,
      organization: session.organization,
      category: session.category,
      level: session.level,
      date: session.date,
      time: session.time,
      location: session.location,
      instructor: session.instructor || '',
      capacity: session.capacity,
      certified: session.certified,
      volunteer: session.volunteer,
      description: ''
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (session: SessionWithStats) => {
    setSelectedSession(session);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setSessionForm({
      title: '',
      organization: '',
      category: '',
      level: 'Beginner',
      date: '',
      time: '',
      location: '',
      instructor: '',
      capacity: 20,
      certified: false,
      volunteer: false,
      description: ''
    });
    setFormErrors({});
    setSelectedSession(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.organization.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.location.toLowerCase().includes(query)
      );
    }

    if (certifiedFilter !== null) {
      filtered = filtered.filter(s => s.certified === certifiedFilter);
    }

    if (volunteerFilter !== null) {
      filtered = filtered.filter(s => s.volunteer === volunteerFilter);
    }

    if (levelFilter) {
      filtered = filtered.filter(s => s.level === levelFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter(s => s.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'spots':
          return b.available_spots - a.available_spots;
        case 'popular':
          return b.registered_count - a.registered_count;
        default:
          return 0;
      }
    });

    return filtered;
  }, [sessions, searchQuery, certifiedFilter, volunteerFilter, levelFilter, categoryFilter, sortBy]);

  const stats = useMemo(() => ({
    registered: sessions.filter(s => 
      s.user_registration?.status === 'registered' || s.user_registration?.status === 'approved'
    ).length,
    pending: sessions.filter(s => s.user_registration?.status === 'pending').length,
    declined: sessions.filter(s => s.user_registration?.status === 'declined').length,
    certified: sessions.filter(s => s.certified).length,
    volunteer: sessions.filter(s => s.volunteer).length
  }), [sessions]);

  const categories = useMemo(() => 
    [...new Set(sessions.map(s => s.category))],
    [sessions]
  );

  const activeFiltersCount = [certifiedFilter, volunteerFilter, levelFilter, categoryFilter]
    .filter(f => f !== null).length;

  const handleRegister = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);
      await registerForSession(profile.id, sessionId);
      await loadSessions(true);
      alert('Registration submitted successfully! Your registration is pending approval.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to register';
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setCertifiedFilter(null);
    setVolunteerFilter(null);
    setLevelFilter(null);
    setCategoryFilter(null);
  };

  if (loading && activeTab === 'training') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading training sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header with Actions */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {isAdmin ? 'Community Training Management' : 'Community Training Programs'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                {isAdmin 
                  ? 'Manage training sessions and registrations' 
                  : 'Connect with local training sessions and volunteer opportunities'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'training' && (
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  disabled={refreshing}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              )}
              {isAdmin && activeTab === 'training' && (
                <Button 
                  onClick={openCreateDialog}
                  className="bg-gray-900 hover:bg-gray-800 text-white flex-1 sm:flex-none"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      {isAdmin && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('training')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'training'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Training Sessions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('registrations')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'registrations'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Manage Registrations
                </div>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Show AdminRegistrations if on registrations tab */}
      {isAdmin && activeTab === 'registrations' ? (
        <AdminRegistrations />
      ) : (
        <>
          {/* Quick Stats - Only for non-admins */}
          {!isAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-600">{stats.registered}</p>
                  <p className="text-xs text-gray-600">Registered</p>
                </div>
              </Card>
              
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-gray-600">Pending</p>
                </div>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
                  <p className="text-xs text-gray-600">Declined</p>
                </div>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{stats.certified}</p>
                  <p className="text-xs text-gray-600">Certified</p>
                </div>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Heart className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{stats.volunteer}</p>
                  <p className="text-xs text-gray-600">Volunteer</p>
                </div>
              </Card>
            </div>
          )}

          {/* Search and Filter Bar - Only on training tab */}
          {activeTab === 'training' && (
            <Card className="p-4 mb-6 bg-white">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search sessions, locations, or organizations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="outline"
                    className="relative bg-white"
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </div>

                {showFilters && (
                  <div className="pt-3 border-t space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Certification</label>
                        <select
                          value={certifiedFilter === null ? '' : String(certifiedFilter)}
                          onChange={(e) => setCertifiedFilter(e.target.value === '' ? null : e.target.value === 'true')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">All Sessions</option>
                          <option value="true">Certified Only</option>
                          <option value="false">Non-Certified</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
                        <select
                          value={volunteerFilter === null ? '' : String(volunteerFilter)}
                          onChange={(e) => setVolunteerFilter(e.target.value === '' ? null : e.target.value === 'true')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">All Types</option>
                          <option value="true">Volunteer Programs</option>
                          <option value="false">Training Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Level</label>
                        <select
                          value={levelFilter || ''}
                          onChange={(e) => setLevelFilter(e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">All Levels</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Category</label>
                        <select
                          value={categoryFilter || ''}
                          onChange={(e) => setCategoryFilter(e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {activeFiltersCount > 0 && (
                      <Button
                        onClick={clearAllFilters}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto bg-white"
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={sortBy === 'date' ? 'default' : 'outline'}
                      onClick={() => setSortBy('date')}
                      className={sortBy === 'date' ? 'bg-gray-900 hover:bg-gray-800 text-white' : 'bg-white'}
                    >
                      Date
                    </Button>
                    <Button
                      size="sm"
                      variant={sortBy === 'spots' ? 'default' : 'outline'}
                      onClick={() => setSortBy('spots')}
                      className={sortBy === 'spots' ? 'bg-gray-900 hover:bg-gray-800 text-white' : 'bg-white'}
                    >
                      Availability
                    </Button>
                    <Button
                      size="sm"
                      variant={sortBy === 'popular' ? 'default' : 'outline'}
                      onClick={() => setSortBy('popular')}
                      className={sortBy === 'popular' ? 'bg-gray-900 hover:bg-gray-800 text-white' : 'bg-white'}
                    >
                      Popular
                    </Button>
                  </div>
                  <div className="ml-auto text-sm text-gray-600">
                    {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Sessions Grid - Only on training tab */}
          {activeTab === 'training' && (
            filteredSessions.length === 0 ? (
              <Card className="p-12 text-center bg-white">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No sessions found</h3>
                <p className="text-gray-600 mb-4">
                  {sessions.length === 0 
                    ? 'No training sessions available yet. Check back soon!'
                    : 'Try adjusting your filters or search criteria'
                  }
                </p>
                {sessions.length > 0 && (
                  <Button onClick={clearAllFilters} variant="outline" className="bg-white">
                    Clear Filters
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {filteredSessions.map(session => {
                  const isRegistered = session.user_registration?.status === 'registered' || session.user_registration?.status === 'approved';
                  const isPending = session.user_registration?.status === 'pending';
                  const isFull = session.available_spots <= 0;
                  const canRegister = !isAdmin && !session.user_registration && !isFull;

                  return (
                    <Card key={session.id} className="p-5 hover:shadow-lg transition-shadow bg-white">
                      {/* Header with Admin Actions */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs bg-white">{session.category}</Badge>
                          {session.certified && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              <Award className="w-3 h-3 mr-1" />
                              Certified
                            </Badge>
                          )}
                          {session.volunteer && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                              <Heart className="w-3 h-3 mr-1" />
                              Volunteer
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`text-xs ${
                              session.level === 'Beginner' 
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : session.level === 'Intermediate'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}
                          >
                            {session.level}
                          </Badge>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(session)}
                                className="h-7 w-7 p-0 bg-white"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDeleteDialog(session)}
                                className="h-7 w-7 p-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100 bg-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold mb-1">{session.title}</h3>
                      <p className="text-sm text-gray-600 mb-4">{session.organization}</p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span>{new Date(session.date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span>{session.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="line-clamp-1">{session.location}</span>
                        </div>
                        {session.instructor && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="line-clamp-1">{session.instructor}</span>
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-600">Capacity</span>
                          <span className="text-xs font-medium">
                            {session.registered_count}/{session.capacity}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              isFull ? 'bg-red-600' : session.available_spots < 3 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${(session.registered_count / session.capacity) * 100}%` }}
                          />
                        </div>
                        <p className={`text-xs mt-1 ${
                          isFull ? 'text-red-600' : session.available_spots < 3 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {isFull ? 'Session Full' : `${session.available_spots} spots remaining`}
                        </p>
                      </div>

                      {!isAdmin && session.user_registration && (
                        <div className="mb-3">
                          <Badge className={`${
                            isPending ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            isRegistered ? 'bg-green-100 text-green-700 border-green-200' :
                            'bg-red-100 text-red-700 border-red-200'
                          } text-xs`}>
                            {isPending ? '⏳ Pending Approval' : isRegistered ? '✓ Registered' : '✗ Declined'}
                          </Badge>
                        </div>
                      )}

                      <Button 
                        onClick={() => handleRegister(session.id)}
                        disabled={!canRegister || actionLoading === session.id}
                        className={`w-full ${
                          isRegistered || isPending || isFull
                            ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {actionLoading === session.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : isFull ? (
                          'Session Full'
                        ) : isPending ? (
                          'Pending Approval'
                        ) : isRegistered ? (
                          'Registered ✓'
                        ) : (
                          'Register Now'
                        )}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )
          )}

          {/* CTA Section - Only for non-admins on training tab */}
          {!isAdmin && activeTab === 'training' && (
            <Card className="mt-8 p-8 bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Make a Difference</h2>
                <p className="text-gray-700 mb-6">
                  Join our community of trained volunteers and help make your community safer and more resilient.
                </p>
                <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white">
                  Start Your Volunteer Journey
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Create Session Modal */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">Create New Training Session</h2>
                <p className="text-gray-600 mt-1">Fill in the details for the new community training session.</p>
              </div>
              <button
                onClick={() => setIsCreateDialogOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="title"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      placeholder="CPR & First Aid Certification"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.title && <p className="text-sm text-red-600">{formErrors.title}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="organization" className="text-sm font-medium text-gray-700">
                      Organization
                    </label>
                    <input
                      id="organization"
                      value={sessionForm.organization}
                      onChange={(e) => setSessionForm({...sessionForm, organization: e.target.value})}
                      placeholder="Red Cross Philippines"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="category" className="text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      id="category"
                      value={sessionForm.category}
                      onChange={(e) => setSessionForm({...sessionForm, category: e.target.value})}
                      placeholder="Medical"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="level" className="text-sm font-medium text-gray-700">
                      Level
                    </label>
                    <select
                      id="level"
                      value={sessionForm.level}
                      onChange={(e) => setSessionForm({...sessionForm, level: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium text-gray-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={sessionForm.date}
                      onChange={(e) => setSessionForm({...sessionForm, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.date && <p className="text-sm text-red-600">{formErrors.date}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="time" className="text-sm font-medium text-gray-700">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="time"
                      value={sessionForm.time}
                      onChange={(e) => setSessionForm({...sessionForm, time: e.target.value})}
                      placeholder="9:00 AM - 5:00 PM"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.time && <p className="text-sm text-red-600">{formErrors.time}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="location" className="text-sm font-medium text-gray-700">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="location"
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                      placeholder="Olongapo City Convention Center"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.location && <p className="text-sm text-red-600">{formErrors.location}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="instructor" className="text-sm font-medium text-gray-700">
                      Instructor
                    </label>
                    <input
                      id="instructor"
                      value={sessionForm.instructor}
                      onChange={(e) => setSessionForm({...sessionForm, instructor: e.target.value})}
                      placeholder="Dr. Maria Santos"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="capacity" className="text-sm font-medium text-gray-700">
                      Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="capacity"
                      type="number"
                      min="1"
                      value={sessionForm.capacity}
                      onChange={(e) => setSessionForm({...sessionForm, capacity: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.capacity && <p className="text-sm text-red-600">{formErrors.capacity}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                    placeholder="Brief description of the training session..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  />
                </div>

                <div className="flex flex-col gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="certified" className="text-sm font-medium text-gray-700">
                        Certified Training
                      </label>
                      <p className="text-xs text-gray-500">Participants receive certificates upon completion</p>
                    </div>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="certified"
                        checked={sessionForm.certified}
                        onChange={(e) => setSessionForm({...sessionForm, certified: e.target.checked})}
                        className="sr-only"
                      />
                      <div 
                        className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${sessionForm.certified ? 'bg-gray-900' : 'bg-gray-300'}`}
                        onClick={() => setSessionForm({...sessionForm, certified: !sessionForm.certified})}
                      >
                        <div 
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${sessionForm.certified ? 'transform translate-x-6' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="volunteer" className="text-sm font-medium text-gray-700">
                        Volunteer Program
                      </label>
                      <p className="text-xs text-gray-500">Focuses on community service and volunteering</p>
                    </div>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="volunteer"
                        checked={sessionForm.volunteer}
                        onChange={(e) => setSessionForm({...sessionForm, volunteer: e.target.checked})}
                        className="sr-only"
                      />
                      <div 
                        className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${sessionForm.volunteer ? 'bg-gray-900' : 'bg-gray-300'}`}
                        onClick={() => setSessionForm({...sessionForm, volunteer: !sessionForm.volunteer})}
                      >
                        <div 
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${sessionForm.volunteer ? 'transform translate-x-6' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
                className="border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSession} 
                disabled={actionLoading === 'create'}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                {actionLoading === 'create' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Session'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">Edit Training Session</h2>
                <p className="text-gray-600 mt-1">Update the details for this community training session.</p>
              </div>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="edit-title" className="text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-title"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.title && <p className="text-sm text-red-600">{formErrors.title}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-organization" className="text-sm font-medium text-gray-700">
                      Organization
                    </label>
                    <input
                      id="edit-organization"
                      value={sessionForm.organization}
                      onChange={(e) => setSessionForm({...sessionForm, organization: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-category" className="text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      id="edit-category"
                      value={sessionForm.category}
                      onChange={(e) => setSessionForm({...sessionForm, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-level" className="text-sm font-medium text-gray-700">
                      Level
                    </label>
                    <select
                      id="edit-level"
                      value={sessionForm.level}
                      onChange={(e) => setSessionForm({...sessionForm, level: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-date" className="text-sm font-medium text-gray-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-date"
                      type="date"
                      value={sessionForm.date}
                      onChange={(e) => setSessionForm({...sessionForm, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.date && <p className="text-sm text-red-600">{formErrors.date}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-time" className="text-sm font-medium text-gray-700">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-time"
                      value={sessionForm.time}
                      onChange={(e) => setSessionForm({...sessionForm, time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.time && <p className="text-sm text-red-600">{formErrors.time}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-location" className="text-sm font-medium text-gray-700">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-location"
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.location && <p className="text-sm text-red-600">{formErrors.location}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-instructor" className="text-sm font-medium text-gray-700">
                      Instructor
                    </label>
                    <input
                      id="edit-instructor"
                      value={sessionForm.instructor}
                      onChange={(e) => setSessionForm({...sessionForm, instructor: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-capacity" className="text-sm font-medium text-gray-700">
                      Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-capacity"
                      type="number"
                      min="1"
                      value={sessionForm.capacity}
                      onChange={(e) => setSessionForm({...sessionForm, capacity: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                    />
                    {formErrors.capacity && <p className="text-sm text-red-600">{formErrors.capacity}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="edit-description" className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                  />
                </div>

                <div className="flex flex-col gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="edit-certified" className="text-sm font-medium text-gray-700">
                        Certified Training
                      </label>
                      <p className="text-xs text-gray-500">Participants receive certificates upon completion</p>
                    </div>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="edit-certified"
                        checked={sessionForm.certified}
                        onChange={(e) => setSessionForm({...sessionForm, certified: e.target.checked})}
                        className="sr-only"
                      />
                      <div 
                        className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${sessionForm.certified ? 'bg-gray-900' : 'bg-gray-300'}`}
                        onClick={() => setSessionForm({...sessionForm, certified: !sessionForm.certified})}
                      >
                        <div 
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${sessionForm.certified ? 'transform translate-x-6' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="edit-volunteer" className="text-sm font-medium text-gray-700">
                        Volunteer Program
                      </label>
                      <p className="text-xs text-gray-500">Focuses on community service and volunteering</p>
                    </div>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="edit-volunteer"
                        checked={sessionForm.volunteer}
                        onChange={(e) => setSessionForm({...sessionForm, volunteer: e.target.checked})}
                        className="sr-only"
                      />
                      <div 
                        className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${sessionForm.volunteer ? 'bg-gray-900' : 'bg-gray-300'}`}
                        onClick={() => setSessionForm({...sessionForm, volunteer: !sessionForm.volunteer})}
                      >
                        <div 
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${sessionForm.volunteer ? 'transform translate-x-6' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                className="border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditSession} 
                disabled={actionLoading === 'edit'}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                {actionLoading === 'edit' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Session'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-center mb-2">Delete Session</h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete "{selectedSession?.title}"? This action cannot be undone and will also delete all registrations for this session.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="flex-1 border-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteSession}
                  disabled={actionLoading === 'delete'}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {actionLoading === 'delete' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Session'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}