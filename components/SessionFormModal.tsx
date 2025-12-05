import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { X, Loader2 } from 'lucide-react';
import { createSession, updateSession, deleteSession, type SessionWithStats } from '@/lib/community-utils';

interface SessionFormModalProps {
  session?: SessionWithStats | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ORGANIZATIONS = [
  'Red Cross',
  'LGUs',
  'Educational Institutions',
  'Disaster Agencies'
];

export function SessionFormModal({ session, onClose, onSuccess }: SessionFormModalProps) {
  const isEditing = !!session;
  
  const [formData, setFormData] = useState({
    title: session?.title || '',
    description: session?.description || '',
    organization: session?.organization || '',
    category: session?.category || 'Medical',
    level: session?.level || 'Beginner',
    date: session?.date || '',
    time: session?.time || '',
    location: session?.location || '',
    instructor: session?.instructor || '',
    capacity: session?.capacity || 10,
    certified: session?.certified || false,
    volunteer: session?.volunteer || false
  });

  // Parse existing time if editing
  const parseExistingTime = (timeStr: string) => {
    if (!timeStr) return { startHour: '', startMin: '', startPeriod: 'AM', endHour: '', endMin: '', endPeriod: 'PM' };
    
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      return {
        startHour: match[1],
        startMin: match[2],
        startPeriod: match[3].toUpperCase(),
        endHour: match[4],
        endMin: match[5],
        endPeriod: match[6].toUpperCase()
      };
    }
    return { startHour: '', startMin: '', startPeriod: 'AM', endHour: '', endMin: '', endPeriod: 'PM' };
  };

  const [timeInputs, setTimeInputs] = useState(parseExistingTime(session?.time || ''));

  // Get tomorrow's date in YYYY-MM-DD format
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sanitizeInput = (value: string): string => {
    // Remove special characters except basic punctuation and spaces
    return value.replace(/[^a-zA-Z0-9\s.,\-():]/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.organization) {
      newErrors.organization = 'Organization is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      // Check if date is not in the past
      const selectedDate = new Date(formData.date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      if (selectedDate < tomorrow) {
        newErrors.date = 'Date must be tomorrow or later';
      }
    }

    if (!formData.time.trim()) {
      newErrors.time = 'Time is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (formData.capacity < 1) {
      newErrors.capacity = 'Capacity must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    const sanitized = sanitizeInput(value);
    setFormData({ ...formData, [field]: sanitized });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleTimeChange = (field: keyof typeof timeInputs, value: string) => {
    const newTimeInputs = { ...timeInputs, [field]: value };
    setTimeInputs(newTimeInputs);
    
    // Build time string if all fields are filled
    if (newTimeInputs.startHour && newTimeInputs.startMin && newTimeInputs.endHour && newTimeInputs.endMin) {
      const timeStr = `${newTimeInputs.startHour}:${newTimeInputs.startMin} ${newTimeInputs.startPeriod} - ${newTimeInputs.endHour}:${newTimeInputs.endMin} ${newTimeInputs.endPeriod}`;
      setFormData({ ...formData, time: timeStr });
      if (errors.time) {
        setErrors({ ...errors, time: '' });
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      if (isEditing && session) {
        await updateSession(session.id, formData);
      } else {
        await createSession(formData as any);
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error saving session');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!session || !confirm('Are you sure you want to delete this session? This will also delete all registrations.')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteSession(session.id);
      onSuccess();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error deleting session');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-white p-4 sm:p-6 my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-white pb-3 border-b">
          <h2 className="text-xl sm:text-2xl font-semibold">
            {isEditing ? 'Edit Session' : 'Create New Session'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm sm:text-base">Session Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`text-sm sm:text-base ${errors.title ? 'border-red-500' : ''}`}
            />
            {errors.title && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="text-sm sm:text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="organization" className="text-sm sm:text-base">Organization *</Label>
              <select
                id="organization"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className={`w-full px-2 sm:px-3 py-2 border rounded-md text-sm sm:text-base ${
                  errors.organization ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Organization</option>
                {ORGANIZATIONS.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
              {errors.organization && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.organization}</p>}
            </div>

            <div>
              <Label htmlFor="category" className="text-sm sm:text-base">Category *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
              >
                <option value="Medical">Medical</option>
                <option value="General Preparedness">General Preparedness</option>
                <option value="Advanced Response">Advanced Response</option>
                <option value="Natural Disaster">Natural Disaster</option>
                <option value="Volunteer Program">Volunteer Program</option>
                <option value="Specialized">Specialized</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="level" className="text-sm sm:text-base">Level *</Label>
              <select
                id="level"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="All Levels">All Levels</option>
              </select>
            </div>

            <div>
              <Label htmlFor="capacity" className="text-sm sm:text-base">Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={formData.capacity === 0 ? '' : formData.capacity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFormData({ ...formData, capacity: 0 });
                  } else {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFormData({ ...formData, capacity: numValue });
                    }
                  }
                }}
                onBlur={() => {
                  if (formData.capacity < 1) {
                    setFormData({ ...formData, capacity: 1 });
                  }
                }}
                className={`text-sm sm:text-base ${errors.capacity ? 'border-red-500' : ''}`}
              />
              {errors.capacity && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.capacity}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="date" className="text-sm sm:text-base">Date *</Label>
              <Input
                id="date"
                type="date"
                min={getTomorrowDate()}
                value={formData.date}
                onChange={(e) => {
                  const selectedDate = new Date(e.target.value);
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(0, 0, 0, 0);
                  selectedDate.setHours(0, 0, 0, 0);
                  
                  if (selectedDate >= tomorrow) {
                    setFormData({ ...formData, date: e.target.value });
                    if (errors.date) {
                      setErrors({ ...errors, date: '' });
                    }
                  } else {
                    setErrors({ ...errors, date: 'Date must be tomorrow or later' });
                  }
                }}
                className={`text-sm sm:text-base ${errors.date ? 'border-red-500' : ''}`}
              />
              {errors.date && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.date}</p>}
              <p className="text-xs text-gray-500 mt-1">Must be tomorrow or later</p>
            </div>

            <div>
              <Label className="text-sm sm:text-base">Time *</Label>
              <div className="space-y-2">
                {/* Start Time */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    placeholder="HH"
                    value={timeInputs.startHour}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                        handleTimeChange('startHour', val);
                      }
                    }}
                    className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                  />
                  <span className="text-gray-500 text-xs sm:text-sm">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="MM"
                    value={timeInputs.startMin}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                        handleTimeChange('startMin', val.padStart(2, '0'));
                      }
                    }}
                    className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                  />
                  <select
                    value={timeInputs.startPeriod}
                    onChange={(e) => handleTimeChange('startPeriod', e.target.value)}
                    className="px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm flex-shrink-0"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>

                {/* Separator */}
                <div className="text-center text-gray-500 text-xs sm:text-sm">to</div>

                {/* End Time */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    placeholder="HH"
                    value={timeInputs.endHour}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                        handleTimeChange('endHour', val);
                      }
                    }}
                    className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                  />
                  <span className="text-gray-500 text-xs sm:text-sm">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="MM"
                    value={timeInputs.endMin}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                        handleTimeChange('endMin', val.padStart(2, '0'));
                      }
                    }}
                    className="w-12 sm:w-16 px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                  />
                  <select
                    value={timeInputs.endPeriod}
                    onChange={(e) => handleTimeChange('endPeriod', e.target.value)}
                    className="px-1 sm:px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm flex-shrink-0"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              {errors.time && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.time}</p>}
              {formData.time && <p className="text-xs text-gray-500 mt-1">Preview: {formData.time}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="location" className="text-sm sm:text-base">Location *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className={`text-sm sm:text-base ${errors.location ? 'border-red-500' : ''}`}
            />
            {errors.location && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.location}</p>}
          </div>

          <div>
            <Label htmlFor="instructor" className="text-sm sm:text-base">Instructor</Label>
            <Input
              id="instructor"
              value={formData.instructor}
              onChange={(e) => handleInputChange('instructor', e.target.value)}
              className="text-sm sm:text-base"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.certified}
                onChange={(e) => setFormData({ ...formData, certified: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs sm:text-sm">Offers Certification</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.volunteer}
                onChange={(e) => setFormData({ ...formData, volunteer: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs sm:text-sm">Volunteer Program</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t sticky bottom-0 bg-white">
            {isEditing && (
              <Button
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
              onClick={onClose}
              variant="outline"
              disabled={loading || deleting}
              className={`w-full sm:w-auto text-sm ${!isEditing ? '' : 'sm:ml-auto'}`}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={loading || deleting}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? 'Update Session' : 'Create Session'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}