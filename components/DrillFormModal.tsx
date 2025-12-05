import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { X, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { createDrill, updateDrill, deleteDrill, getDrillContent } from '@/lib/drills-utils';
import type { DrillWithUserStatus } from '@/lib/drills-utils';

interface DrillFormModalProps {
  drill?: DrillWithUserStatus | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface DrillPage {
  id: string;
  type: 'info' | 'question';
  title: string;
  content: string;
  question?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  points?: number;
}

const CATEGORIES = ['Life-Saving', 'Basic First Aid', 'Environmental', 'Medical Emergencies', 'Survival Skills', 'Trauma Care'];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export function DrillFormModal({ drill, onClose, onSuccess }: DrillFormModalProps) {
  const isEditing = !!drill;
  
  const [formData, setFormData] = useState({
    title: drill?.title || '',
    description: drill?.description || '',
    type: drill?.type || 'Virtual',
    difficulty: drill?.difficulty || 'Beginner',
    duration: '',
    participants: '',
    points: drill?.points || 0,
    location: drill?.location || '',
    date: drill?.date || '',
    time: '',
    capacity: drill?.capacity ?? 20,
    requireCompletion: false
  });

  const [pages, setPages] = useState<DrillPage[]>([]);
  const [editingPage, setEditingPage] = useState<DrillPage | null>(null);
  const [showPageEditor, setShowPageEditor] = useState(false);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Parse duration and time on mount
  useEffect(() => {
    if (drill) {
      // Parse duration back to minutes
      let durationMinutes = '';
      if (drill.duration) {
        const match = drill.duration.match(/(\d+)/g);
        if (match) {
          if (drill.duration.includes('hour')) {
            const hours = parseInt(match[0] || '0');
            const minutes = parseInt(match[1] || '0');
            durationMinutes = String(hours * 60 + minutes);
          } else {
            durationMinutes = match[0];
          }
        }
      }

      // Parse time back to minutes
      let timeMinutes = '';
      if (drill.time) {
        const match = drill.time.match(/(\d+)/g);
        if (match) {
          if (drill.time.includes('hour')) {
            const hours = parseInt(match[0] || '0');
            const minutes = parseInt(match[1] || '0');
            timeMinutes = String(hours * 60 + minutes);
          } else {
            timeMinutes = match[0];
          }
        }
      }

      // Parse participants to get just the number
      let participantsNum = '';
      if (drill.participants) {
        const match = drill.participants.match(/\d+/);
        if (match) {
          participantsNum = match[0];
        }
      }

      setFormData(prev => ({
        ...prev,
        duration: durationMinutes,
        time: timeMinutes,
        participants: participantsNum
      }));

      // Load drill content if it's a virtual drill
      if (drill.type === 'Virtual') {
        loadDrillContent();
      }
    }
  }, [drill]);

  const loadDrillContent = async () => {
    if (!drill) return;
    
    try {
      const content = await getDrillContent(drill.id);
      const loadedPages = content.map((item: any) => ({
        id: item.id,
        type: item.step_type,
        title: item.step_title,
        content: item.step_description,
        question: item.content?.question || '',
        options: item.content?.options || [],
        correctAnswer: typeof item.content?.correctAnswer === 'number' ? item.content.correctAnswer : undefined,
        explanation: item.content?.explanation || '',
        points: item.points || 0
      }));
      setPages(loadedPages);
    } catch (error) {
      console.error('Error loading drill content:', error);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hour ${mins} min` : `${hours} hour`;
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hour ${mins} min` : `${hours} hour`;
  };

  const sanitizeText = (value: string): string => {
    // Remove potential SQL injection patterns and special HTML characters
    return value
      .replace(/[<>'"`;()]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .trim();
  };

  const sanitizeLocation = (value: string): string => {
    // Allow alphanumeric, spaces, commas, periods, and hyphens
    return value
      .replace(/[^a-zA-Z0-9\s,.-]/g, '')
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      // Format duration
      const durationNum = parseInt(formData.duration) || 0;
      const formattedDuration = formatDuration(durationNum);

      // Format time
      const timeNum = parseInt(formData.time) || 0;
      const formattedTime = formatTime(timeNum);

      // Format participants
      const participantsNum = parseInt(formData.participants) || 0;
      const formattedParticipants = `Max ${participantsNum}`;
      
      // Build base data object with common fields
      const sanitizedData: any = {
        title: sanitizeText(formData.title),
        description: sanitizeText(formData.description),
        type: formData.type,
        difficulty: formData.difficulty,
        duration: formattedDuration,
        participants: formattedParticipants
      };

      // Add type-specific fields
      if (formData.type === 'Virtual') {
        sanitizedData.points = isNaN(formData.points) ? 0 : Number(formData.points);
        // Clear physical drill fields
        sanitizedData.location = null;
        sanitizedData.date = null;
        sanitizedData.time = null;
        sanitizedData.capacity = null;
      } else if (formData.type === 'Physical') {
        sanitizedData.location = sanitizeLocation(formData.location) || '';
        sanitizedData.date = formData.date || '';
        sanitizedData.time = formattedTime || '';
        sanitizedData.capacity = isNaN(formData.capacity) ? 20 : Number(formData.capacity);
        // Clear virtual drill fields
        sanitizedData.points = 0;
      }
      
      if (isEditing && drill) {
        await updateDrill(drill.id, sanitizedData, pages);
      } else {
        await createDrill(sanitizedData, pages);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving drill:', error);
      alert('Error saving drill: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!drill || !confirm('Are you sure you want to delete this drill? This will also delete all registrations.')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteDrill(drill.id);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting drill:', error);
      alert('Error deleting drill: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPage = () => {
    setEditingPage({
      id: Date.now().toString(),
      type: 'info',
      title: '',
      content: ''
    });
    setShowPageEditor(true);
  };

  const handleEditPage = (page: DrillPage) => {
    setEditingPage(page);
    setShowPageEditor(true);
  };

  const handleDeletePage = (pageId: string) => {
    if (confirm('Delete this page?')) {
      setPages(pages.filter(p => p.id !== pageId));
    }
  };

  const handleSavePage = (page: DrillPage) => {
    console.log('=== SAVING PAGE ===');
    console.log('Page data:', page);
    console.log('Correct answer:', page.correctAnswer);
    console.log('Correct answer type:', typeof page.correctAnswer);
    console.log('Options:', page.options);
    console.log('==================');
    
    const existingIndex = pages.findIndex(p => p.id === page.id);
    if (existingIndex >= 0) {
      const updated = [...pages];
      updated[existingIndex] = page;
      setPages(updated);
    } else {
      setPages([...pages, page]);
    }
    setShowPageEditor(false);
    setEditingPage(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl bg-white p-4 sm:p-6 my-4 sm:my-8 relative z-[61] max-h-[98vh] sm:max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-2">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold flex-1 min-w-0">
            {isEditing ? 'Edit Drill' : 'Create New Drill'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Basic Info */}
          <div>
            <Label htmlFor="title" className="text-sm sm:text-base">Drill Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Emergency CPR Training"
              className="text-sm sm:text-base"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Brief description of the drill"
              className="text-sm sm:text-base"
            />
          </div>

          {/* Type and Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="type" className="text-sm sm:text-base">Type *</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                <option value="Virtual">Virtual</option>
                <option value="Physical">Physical</option>
              </select>
            </div>

            <div>
              <Label htmlFor="difficulty" className="text-sm sm:text-base">Difficulty *</Label>
              <select
                id="difficulty"
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                {DIFFICULTIES.map(diff => (
                  <option key={diff} value={diff}>{diff}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration and Participants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="duration" className="text-sm sm:text-base">Duration (in minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value.replace(/\D/g, '') })}
                placeholder="e.g., 45"
                className="text-sm sm:text-base"
                required
              />
              {formData.duration && (
                <p className="text-xs text-gray-500 mt-1">
                  Will show as: {formatDuration(parseInt(formData.duration) || 0)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="participants" className="text-sm sm:text-base">Max Participants *</Label>
              <Input
                id="participants"
                type="number"
                min="1"
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value.replace(/\D/g, '') })}
                placeholder="e.g., 12"
                className="text-sm sm:text-base"
                required
              />
              {formData.participants && (
                <p className="text-xs text-gray-500 mt-1">
                  Will show as: Max {formData.participants}
                </p>
              )}
            </div>
          </div>

          {/* Virtual Drill Specific */}
          {formData.type === 'Virtual' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="points" className="text-sm sm:text-base">Points *</Label>
                  <Input
                    id="points"
                    type="number"
                    min="0"
                    value={formData.points === 0 ? '' : formData.points}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setFormData({ ...formData, points: 0 });
                      } else {
                        const num = parseInt(val);
                        setFormData({ ...formData, points: num >= 0 ? num : 0 });
                      }
                    }}
                    placeholder="0"
                    className="text-sm sm:text-base"
                    required
                  />
                </div>

                <div className="flex items-center pt-0 sm:pt-6">
                  <input
                    type="checkbox"
                    id="requireCompletion"
                    checked={formData.requireCompletion}
                    onChange={(e) => setFormData({ ...formData, requireCompletion: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded flex-shrink-0"
                  />
                  <Label htmlFor="requireCompletion" className="ml-2 cursor-pointer text-xs sm:text-sm">
                    Require 100% completion for points
                  </Label>
                </div>
              </div>

              {/* Pages Section */}
              <div className="border-t pt-3 sm:pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold">Drill Content Pages</h3>
                  <Button
                    type="button"
                    onClick={handleAddPage}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-sm"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Add Page
                  </Button>
                </div>

                {pages.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg border-2 border-dashed">
                    <p className="text-gray-500 text-xs sm:text-sm px-4">No pages added yet. Click "Add Page" to create drill content.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pages.map((page, index) => (
                      <div key={page.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg border gap-2">
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-medium text-gray-700">Page {index + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                              page.type === 'question' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {page.type === 'question' ? '❓ Quiz' : 'ℹ️ Info'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">{page.title || 'Untitled'}</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPage(page)}
                            className="flex-1 sm:flex-none text-xs sm:text-sm"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-0" />
                            <span className="sm:hidden">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePage(page.id)}
                            className="flex-1 sm:flex-none text-red-600 hover:text-red-700 text-xs sm:text-sm"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-0" />
                            <span className="sm:hidden">Delete</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Physical Drill Specific */}
          {formData.type === 'Physical' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs sm:text-sm text-blue-800">
                ℹ️ Physical drills do not award points. Points are only for virtual drills.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="date" className="text-sm sm:text-base">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cannot select past dates
                  </p>
                </div>

                <div>
                  <Label htmlFor="time" className="text-sm sm:text-base">Time (in minutes) *</Label>
                  <Input
                    id="time"
                    type="number"
                    min="1"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g., 90"
                    className="text-sm sm:text-base"
                    required
                  />
                  {formData.time && (
                    <p className="text-xs text-gray-500 mt-1">
                      Will show as: {formatTime(parseInt(formData.time) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="location" className="text-sm sm:text-base">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: sanitizeLocation(e.target.value) })}
                    placeholder="e.g., Community Center, Room 201"
                    className="text-sm sm:text-base"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Only letters, numbers, spaces, commas, periods, and hyphens allowed
                  </p>
                </div>

                <div>
                  <Label htmlFor="capacity" className="text-sm sm:text-base">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setFormData({ ...formData, capacity: 20 });
                      } else {
                        const num = parseInt(val);
                        setFormData({ ...formData, capacity: num >= 1 ? num : 1 });
                      }
                    }}
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
            {isEditing && (
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting || loading}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 w-full sm:w-auto text-sm"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            )}
            
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={loading || deleting}
              className="sm:ml-auto w-full sm:w-auto text-sm order-last sm:order-none"
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={loading || deleting || !formData.title}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? 'Update Drill' : 'Create Drill'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Page Editor Modal */}
      {showPageEditor && editingPage && (
        <PageEditor
          page={editingPage}
          onSave={handleSavePage}
          onClose={() => {
            setShowPageEditor(false);
            setEditingPage(null);
          }}
        />
      )}
    </div>
  );
}

// Page Editor Component
function PageEditor({ 
  page, 
  onSave, 
  onClose 
}: { 
  page: DrillPage; 
  onSave: (page: DrillPage) => void; 
  onClose: () => void;
}) {
  const [pageData, setPageData] = useState<DrillPage>(page);

  const handleAddOption = () => {
    setPageData({
      ...pageData,
      options: [...(pageData.options || []), '']
    });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...(pageData.options || [])];
    newOptions[index] = value;
    setPageData({ ...pageData, options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    setPageData({
      ...pageData,
      options: (pageData.options || []).filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    if (!pageData.title || !pageData.content) {
      alert('Please fill in title and content');
      return;
    }

    if (pageData.type === 'question') {
      if (!pageData.question || !pageData.options || pageData.options.length < 2) {
        alert('Questions must have a question text and at least 2 options');
        return;
      }
      if (typeof pageData.correctAnswer !== 'number') {
        alert('Please select the correct answer');
        return;
      }
      // Validate that all options are filled
      if (pageData.options.some(opt => !opt || opt.trim() === '')) {
        alert('All answer options must be filled in');
        return;
      }
    }

    console.log('Saving page with data:', pageData);
    onSave(pageData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl bg-white p-4 sm:p-6 my-4 sm:my-8 max-h-[98vh] sm:max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 gap-2">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold flex-1">Edit Page</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <Label className="text-sm sm:text-base">Page Type</Label>
            <select
              value={pageData.type}
              onChange={(e) => setPageData({ ...pageData, type: e.target.value as 'info' | 'question' })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="info">Information Page</option>
              <option value="question">Quiz Question</option>
            </select>
          </div>

          <div>
            <Label className="text-sm sm:text-base">Page Title *</Label>
            <Input
              value={pageData.title}
              onChange={(e) => setPageData({ ...pageData, title: e.target.value })}
              placeholder="e.g., Understanding CPR Basics"
              className="text-sm sm:text-base"
            />
          </div>

          <div>
            <Label className="text-sm sm:text-base">Content *</Label>
            <Textarea
              value={pageData.content}
              onChange={(e) => setPageData({ ...pageData, content: e.target.value })}
              rows={5}
              placeholder="Enter the main content for this page..."
              className="text-sm sm:text-base"
            />
          </div>

          {pageData.type === 'question' && (
            <>
              <div>
                <Label className="text-sm sm:text-base">Question *</Label>
                <Textarea
                  value={pageData.question || ''}
                  onChange={(e) => setPageData({ ...pageData, question: e.target.value })}
                  rows={2}
                  placeholder="Enter your question here..."
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <Label className="text-sm sm:text-base">Answer Options * (minimum 2)</Label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddOption}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Option
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {(pageData.options || []).map((option, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <div className="flex gap-2 flex-1">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={pageData.correctAnswer === index}
                          onChange={() => setPageData({ ...pageData, correctAnswer: index })}
                          className="mt-3 flex-shrink-0"
                        />
                        <Input
                          value={option}
                          onChange={(e) => handleUpdateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1 text-sm sm:text-base"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveOption(index)}
                        className="text-red-600 w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-0" />
                        <span className="sm:hidden">Remove</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select the radio button next to the correct answer
                </p>
              </div>

              <div>
                <Label className="text-sm sm:text-base">Explanation</Label>
                <Textarea
                  value={pageData.explanation || ''}
                  onChange={(e) => setPageData({ ...pageData, explanation: e.target.value })}
                  rows={3}
                  placeholder="Explain why this is the correct answer..."
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <Label className="text-sm sm:text-base">Points for Correct Answer</Label>
                <Input
                  type="number"
                  min="0"
                  value={pageData.points || 0}
                  onChange={(e) => setPageData({ ...pageData, points: parseInt(e.target.value) || 0 })}
                  className="text-sm sm:text-base"
                />
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 text-sm order-last sm:order-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Save Page
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}