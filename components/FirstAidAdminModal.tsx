import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X } from 'lucide-react';

interface TutorialFormData {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: string;
  steps: number;
  type: string;
  content: string;
  video_url: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  duration: string | null;
  steps: number;
  type: string | null;
  content?: string | null;
  video_url?: string | null;
}

interface FirstAidAdminModalProps {
  editingTutorial: Tutorial | null;
  onClose: () => void;
  onSave: (data: TutorialFormData) => Promise<void>;
}

const CATEGORIES = [
  'Life-Saving',
  'Basic First Aid',
  'Environmental',
  'Medical Emergencies',
  'Survival Skills',
  'Trauma Care'
];

const DIFFICULTIES = ['Essential', 'Intermediate', 'Advanced'];

const TYPES = ['Visual + Text', 'Visual Only', 'Text Only'];

// Rich text editor with block-based approach
function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [blocks, setBlocks] = useState<Array<{ type: string; content: string; id: string }>>([]);
  const [activeView, setActiveView] = useState<'visual' | 'html'>('visual');
  
  // Parse HTML to blocks on mount and when switching to visual mode
  useEffect(() => {
    if (activeView === 'visual' && value) {
      parseHtmlToBlocks(value);
    }
  }, [activeView]);

  const parseHtmlToBlocks = (html: string) => {
    if (!html) {
      setBlocks([{ type: 'p', content: '', id: Date.now().toString() }]);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const parsedBlocks: Array<{ type: string; content: string; id: string }> = [];
    
    Array.from(tempDiv.children).forEach((child, index) => {
      const tagName = child.tagName.toLowerCase();
      if (['h2', 'h3', 'p', 'ul', 'ol'].includes(tagName)) {
        if (tagName === 'ul' || tagName === 'ol') {
          // Parse list items
          Array.from(child.children).forEach((li, liIndex) => {
            parsedBlocks.push({
              type: tagName === 'ul' ? 'li-bullet' : 'li-number',
              content: li.textContent || '',
              id: `${Date.now()}-${index}-${liIndex}`
            });
          });
        } else {
          parsedBlocks.push({
            type: tagName,
            content: child.innerHTML,
            id: `${Date.now()}-${index}`
          });
        }
      }
    });

    if (parsedBlocks.length === 0) {
      setBlocks([{ type: 'p', content: '', id: Date.now().toString() }]);
    } else {
      setBlocks(parsedBlocks);
    }
  };

  const blocksToHtml = (blockList: Array<{ type: string; content: string; id: string }>) => {
    let html = '';
    let currentList: { type: 'ul' | 'ol' | null; items: string[] } = { type: null, items: [] };

    const flushList = () => {
      if (currentList.type && currentList.items.length > 0) {
        html += `<${currentList.type}>\n`;
        currentList.items.forEach(item => {
          html += `  <li>${item}</li>\n`;
        });
        html += `</${currentList.type}>\n`;
        currentList = { type: null, items: [] };
      }
    };

    blockList.forEach(block => {
      if (block.type === 'li-bullet') {
        if (currentList.type !== 'ul') {
          flushList();
          currentList.type = 'ul';
        }
        currentList.items.push(block.content);
      } else if (block.type === 'li-number') {
        if (currentList.type !== 'ol') {
          flushList();
          currentList.type = 'ol';
        }
        currentList.items.push(block.content);
      } else {
        flushList();
        html += `<${block.type}>${block.content}</${block.type}>\n`;
      }
    });

    flushList();
    return html;
  };

  const updateBlocks = (newBlocks: Array<{ type: string; content: string; id: string }>) => {
    setBlocks(newBlocks);
    onChange(blocksToHtml(newBlocks));
  };

  const addBlock = (type: string) => {
    const newBlock = { type, content: '', id: Date.now().toString() };
    updateBlocks([...blocks, newBlock]);
  };

  const updateBlockContent = (id: string, content: string) => {
    const newBlocks = blocks.map(block =>
      block.id === id ? { ...block, content: content.replace(/<[^>]*>/g, '') } : block // Strip HTML tags
    );
    updateBlocks(newBlocks);
  };

  const changeBlockType = (id: string, newType: string) => {
    const newBlocks = blocks.map(block =>
      block.id === id ? { ...block, type: newType } : block
    );
    updateBlocks(newBlocks);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length === 1) {
      updateBlocks([{ type: 'p', content: '', id: Date.now().toString() }]);
    } else {
      updateBlocks(blocks.filter(block => block.id !== id));
    }
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(block => block.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === blocks.length - 1)) {
      return;
    }
    
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    updateBlocks(newBlocks);
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'h2': return 'H2';
      case 'h3': return 'H3';
      case 'p': return 'P';
      case 'li-bullet': return '•';
      case 'li-number': return '1.';
      default: return 'T';
    }
  };

  return (
    <div className="space-y-2">
      {activeView === 'visual' ? (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => addBlock('h2')}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white border rounded hover:bg-gray-50"
                title="Add Heading 2"
              >
                + H2
              </button>
              <button
                type="button"
                onClick={() => addBlock('h3')}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white border rounded hover:bg-gray-50"
                title="Add Heading 3"
              >
                + H3
              </button>
              <button
                type="button"
                onClick={() => addBlock('p')}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white border rounded hover:bg-gray-50"
                title="Add Paragraph"
              >
                + P
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <button
                type="button"
                onClick={() => addBlock('li-bullet')}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white border rounded hover:bg-gray-50"
                title="Add Bullet Point"
              >
                + • Bullet
              </button>
              <button
                type="button"
                onClick={() => addBlock('li-number')}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white border rounded hover:bg-gray-50"
                title="Add Numbered Item"
              >
                + 1. Number
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setActiveView('html')}
              className="px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded whitespace-nowrap"
            >
              View HTML
            </button>
          </div>
          
          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
            💡 <strong>How to use:</strong> Click the buttons above to add content blocks. Type your content in each block. Use the controls on the right to change type, move, or delete blocks.
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto p-2 border rounded-lg bg-white">
            {blocks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Click a button above to add your first content block
              </div>
            )}
            
            {blocks.map((block, index) => (
              <div key={block.id} className="group border rounded-lg p-2 sm:p-3 hover:border-blue-400 transition-colors bg-gray-50">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm">
                      {getBlockIcon(block.type)}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={block.content}
                      onChange={(e) => updateBlockContent(block.id, e.target.value)}
                      placeholder={`Enter ${block.type === 'h2' ? 'heading' : block.type === 'h3' ? 'subheading' : block.type.includes('li') ? 'list item' : 'paragraph'} text...`}
                      rows={block.type === 'p' ? 3 : 1}
                      className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      style={{
                        fontSize: block.type === 'h2' ? '1.1rem' : block.type === 'h3' ? '1rem' : '0.95rem',
                        fontWeight: block.type.startsWith('h') ? '600' : '400'
                      }}
                    />
                  </div>
                  
                  <div className="flex-shrink-0 flex flex-col gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <select
                      value={block.type}
                      onChange={(e) => changeBlockType(block.id, e.target.value)}
                      className="text-xs border rounded px-1 py-1"
                      title="Change block type"
                    >
                      <option value="h2">H2</option>
                      <option value="h3">H3</option>
                      <option value="p">P</option>
                      <option value="li-bullet">• Bullet</option>
                      <option value="li-number">1. Number</option>
                    </select>
                    
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, 'up')}
                      disabled={index === 0}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, 'down')}
                      disabled={index === blocks.length - 1}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => deleteBlock(block.id)}
                      className="text-xs px-2 py-1 border rounded hover:bg-red-100 text-red-600"
                      title="Delete block"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-700 mb-2">Preview:</p>
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
              <style dangerouslySetInnerHTML={{ __html: `
                .preview-content h2 {
                  font-size: 1.5rem;
                  font-weight: 700;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                  color: #1f2937;
                  border-bottom: 2px solid #ef4444;
                  padding-bottom: 0.5rem;
                }
                .preview-content h2:first-child { margin-top: 0; }
                .preview-content h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.5rem;
                  color: #374151;
                }
                .preview-content p {
                  margin-bottom: 1rem;
                  line-height: 1.75;
                  color: #4b5563;
                }
                .preview-content ul, .preview-content ol {
                  margin-bottom: 1rem;
                  padding-left: 1.5rem;
                  line-height: 1.75;
                }
                .preview-content ul { list-style-type: disc; }
                .preview-content ol { list-style-type: decimal; }
                .preview-content li {
                  margin-bottom: 0.5rem;
                  color: #4b5563;
                }
                .preview-content strong {
                  font-weight: 600;
                  color: #1f2937;
                }
              `}} />
              <div 
                className="preview-content text-sm sm:text-base"
                dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) || '<p class="text-gray-400">Preview will appear here...</p>' }}
              />
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">HTML Code View</p>
            <button
              type="button"
              onClick={() => {
                setActiveView('visual');
                parseHtmlToBlocks(value);
              }}
              className="px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded"
            >
              Back to Visual
            </button>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={20}
            className="w-full p-3 border rounded-lg font-mono text-xs sm:text-sm bg-gray-900 text-green-400"
            placeholder="<h2>Section Title</h2><p>Content...</p>"
          />
        </div>
      )}
    </div>
  );
}

export function FirstAidAdminModal({ editingTutorial, onClose, onSave }: FirstAidAdminModalProps) {
  const [formData, setFormData] = useState<TutorialFormData>(() => {
    if (editingTutorial) {
      // Convert duration back to minutes for editing
      let durationMinutes = '';
      if (editingTutorial.duration) {
        const match = editingTutorial.duration.match(/(\d+)/g);
        if (match) {
          if (editingTutorial.duration.includes('hour')) {
            const hours = parseInt(match[0] || '0');
            const minutes = parseInt(match[1] || '0');
            durationMinutes = String(hours * 60 + minutes);
          } else {
            durationMinutes = match[0];
          }
        }
      }
      
      return {
        title: editingTutorial.title,
        description: editingTutorial.description || '',
        category: editingTutorial.category || 'Life-Saving',
        difficulty: editingTutorial.difficulty || 'Essential',
        duration: durationMinutes,
        steps: editingTutorial.steps,
        type: editingTutorial.type || 'Visual + Text',
        content: editingTutorial.content || '',
        video_url: editingTutorial.video_url || ''
      };
    }
    
    return {
      title: '',
      description: '',
      category: 'Life-Saving',
      difficulty: 'Essential',
      duration: '',
      steps: 5,
      type: 'Visual + Text',
      content: '',
      video_url: ''
    };
  });
  
  const [saving, setSaving] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');

  // Convert YouTube URL to embed format (pure function, no side effects)
  const convertYouTubeUrl = (url: string): { embedUrl: string; error: string } => {
    if (!url) return { embedUrl: '', error: '' };
    
    // Already an embed URL
    if (url.includes('youtube.com/embed/')) {
      return { embedUrl: url, error: '' };
    }
    
    // Extract video ID from various YouTube URL formats
    let videoId = '';
    
    // https://www.youtube.com/watch?v=VIDEO_ID
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      videoId = urlParams.get('v') || '';
    }
    // https://youtu.be/VIDEO_ID
    else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    }
    // https://www.youtube.com/v/VIDEO_ID
    else if (url.includes('youtube.com/v/')) {
      videoId = url.split('youtube.com/v/')[1]?.split('?')[0] || '';
    }
    
    if (videoId) {
      return { embedUrl: `https://www.youtube.com/embed/${videoId}`, error: '' };
    }
    
    return { embedUrl: url, error: 'Invalid YouTube URL. Please use a valid YouTube link.' };
  };

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min read`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hour ${mins} min read` : `${hours} hour read`;
  };

  // Sanitize input to remove special characters
  const sanitizeInput = (value: string): string => {
    return value.replace(/[<>]/g, '');
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      // Convert YouTube URL if provided
      const { embedUrl, error } = formData.video_url ? convertYouTubeUrl(formData.video_url) : { embedUrl: '', error: '' };
      
      if (formData.video_url && error) {
        setYoutubeError(error);
        setSaving(false);
        return;
      }

      // Format duration
      const durationNum = parseInt(formData.duration) || 0;
      const formattedDuration = formatDuration(durationNum);

      await onSave({
        ...formData,
        video_url: embedUrl,
        duration: formattedDuration
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving tutorial:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-5xl max-h-[95vh] overflow-y-auto bg-white">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">
              {editingTutorial ? 'Edit Tutorial' : 'Create New Tutorial'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Title <span className="text-red-600">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: sanitizeInput(e.target.value) })}
                required
                placeholder="e.g., CPR for Adults"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: sanitizeInput(e.target.value) })}
                rows={3}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="Brief description of the tutorial"
              />
            </div>

            {/* Category, Difficulty, Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  {DIFFICULTIES.map(diff => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  {TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration and Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Duration (in minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g., 10"
                />
                {formData.duration && (
                  <p className="text-xs text-gray-500 mt-1">
                    Will show as: {formatDuration(parseInt(formData.duration) || 0)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Steps</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.steps || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setFormData({ ...formData, steps: 1 });
                    } else {
                      const num = parseInt(val);
                      setFormData({ ...formData, steps: num > 0 ? num : 1 });
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value || parseInt(e.target.value) < 1) {
                      setFormData({ ...formData, steps: 1 });
                    }
                  }}
                />
              </div>
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium mb-1">
                YouTube Video URL (Optional)
              </label>
              <Input
                type="url"
                value={formData.video_url}
                onChange={(e) => {
                  setFormData({ ...formData, video_url: e.target.value });
                  setYoutubeError('');
                }}
                placeholder="Paste any YouTube video URL here"
              />
              <p className="text-xs text-gray-500 mt-1">
                📹 Paste any YouTube link (watch, youtu.be, etc.) - it will be automatically converted to embed format
              </p>
              {youtubeError && (
                <p className="text-xs text-red-600 mt-1">{youtubeError}</p>
              )}
              {formData.video_url && !youtubeError && (() => {
                const result = convertYouTubeUrl(formData.video_url);
                if (result.error) return null;
                return (
                  <p className="text-xs text-green-600 mt-1 break-all">
                    ✓ Will embed as: {result.embedUrl}
                  </p>
                );
              })()}
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tutorial Content
              </label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                onClick={handleSubmit}
                disabled={saving || !formData.title}
                className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {saving ? 'Saving...' : (editingTutorial ? 'Update Tutorial' : 'Create Tutorial')}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}