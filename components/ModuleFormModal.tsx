import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { X, Loader2 } from 'lucide-react';
import { updateModule, deleteModule } from '@/lib/modules-utils';

interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  points: number;
  difficulty: string;
  lessons: number;
  category: string;
  locked: boolean;
}

interface ModuleFormModalProps {
  module?: Module | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModuleFormModal({ module, onClose, onSuccess }: ModuleFormModalProps) {
  const isEditing = !!module;
  
  const [formData, setFormData] = useState({
    title: module?.title || '',
    description: module?.description || '',
    category: module?.category || 'Emergency Preparedness',
    difficulty: module?.difficulty || 'Beginner',
    duration: module?.duration || '',
    points: module?.points || 0,
    lessons: module?.lessons || 0,
    locked: module?.locked || false
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate and sanitize form data
      const sanitizedData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        difficulty: formData.difficulty,
        duration: formData.duration.trim(),
        points: isNaN(formData.points) || formData.points === null ? 0 : Number(formData.points),
        lessons: isNaN(formData.lessons) || formData.lessons === null ? 0 : Number(formData.lessons),
        locked: formData.locked
      };
      
      if (isEditing && module) {
        await updateModule(module.id, sanitizedData);
      } else {
        throw new Error('Create module is not supported. Only edit and delete are allowed.');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Error saving module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!module || !confirm('Are you sure you want to delete this module? This will also delete all lessons and user progress.')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteModule(module.id);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting module:', error);
      alert('Error deleting module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-white p-6 my-8 relative z-[61]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">
            {isEditing ? 'Edit Module' : 'Module Form'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {!isEditing && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Note: Only editing and deleting modules is supported. To create new modules, please contact the system administrator.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Module Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              disabled={!isEditing}
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
              disabled={!isEditing}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                disabled={!isEditing}
              >
                <option value="Emergency Preparedness">Emergency Preparedness</option>
                <option value="First Aid">First Aid</option>
                <option value="Fire Safety">Fire Safety</option>
                <option value="Natural Disasters">Natural Disasters</option>
                <option value="Community Response">Community Response</option>
                <option value="Risk Assessment">Risk Assessment</option>
              </select>
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty *</Label>
              <select
                id="difficulty"
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                disabled={!isEditing}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration *</Label>
              <Input
                id="duration"
                placeholder="e.g., 45 min"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="lessons">Number of Lessons *</Label>
              <Input
                id="lessons"
                type="number"
                min="0"
                value={formData.lessons || ''}
                onChange={(e) => setFormData({ ...formData, lessons: parseInt(e.target.value) || 0 })}
                required
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="points">Points *</Label>
              <Input
                id="points"
                type="number"
                min="0"
                value={formData.points || ''}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                required
                disabled={!isEditing}
              />
            </div>

            <div className="flex items-center gap-2 pt-7">
              <input
                type="checkbox"
                id="locked"
                checked={formData.locked}
                onChange={(e) => setFormData({ ...formData, locked: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                disabled={!isEditing}
              />
              <Label htmlFor="locked" className="cursor-pointer">
                Lock Module (Users cannot access)
              </Label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {isEditing && (
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting || loading}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
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
              className="ml-auto"
            >
              Cancel
            </Button>
            
            {isEditing && (
              <Button
                onClick={handleSubmit}
                disabled={loading || deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Update Module'
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}