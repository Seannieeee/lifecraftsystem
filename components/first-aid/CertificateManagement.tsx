import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { getCompletedUsersByTutorial, type Tutorial } from '@/lib/first-aid-utils';
import { generateFirstAidCertificate } from './CertificatePDF';

interface CertificateManagementProps {
  tutorials: Tutorial[];
}

export function CertificateManagement({ tutorials }: CertificateManagementProps) {
  const [completedUsers, setCompletedUsers] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedTutorials, setExpandedTutorials] = useState<Set<string>>(new Set());
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedUsers();
  }, [tutorials]);

  const loadCompletedUsers = async () => {
    setLoading(true);
    try {
      const completedMap = new Map<string, any[]>();
      
      for (const tutorial of tutorials) {
        const users = await getCompletedUsersByTutorial(tutorial.id);
        if (users.length > 0) {
          completedMap.set(tutorial.id, users);
        }
      }
      
      setCompletedUsers(completedMap);
      setExpandedTutorials(new Set(Array.from(completedMap.keys())));
    } catch (error) {
      console.error('Error loading completed users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTutorial = (tutorialId: string) => {
    setExpandedTutorials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tutorialId)) {
        newSet.delete(tutorialId);
      } else {
        newSet.add(tutorialId);
      }
      return newSet;
    });
  };

  const handleGenerateCertificate = async (user: any, tutorial: Tutorial) => {
    const certKey = `${user.user_id}-${tutorial.id}`;
    setGeneratingCert(certKey);

    try {
      await generateFirstAidCertificate(user, tutorial);
      alert('Certificate generated successfully!');
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Failed to generate certificate.');
    } finally {
      setGeneratingCert(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
        <span className="text-gray-600">Loading completed users...</span>
      </div>
    );
  }

  const tutorialsWithCompletions = tutorials.filter(t => 
    completedUsers.get(t.id)?.length || 0 > 0
  );

  if (tutorialsWithCompletions.length === 0) {
    return (
      <div className="text-center p-8">
        <Award className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-600 mb-2">No completed tutorials yet</p>
        <p className="text-sm text-gray-500">Users who complete tutorials will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {tutorialsWithCompletions.map(tutorial => {
        const users = completedUsers.get(tutorial.id) || [];
        const isExpanded = expandedTutorials.has(tutorial.id);

        return (
          <div key={tutorial.id} className="border rounded-lg overflow-hidden">
            <div 
              className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 cursor-pointer hover:from-purple-100 hover:to-pink-100 transition-colors"
              onClick={() => toggleTutorial(tutorial.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{tutorial.title}</h3>
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                      {users.length} Completed
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>📚 {tutorial.category}</span>
                    <span>⭐ {tutorial.difficulty}</span>
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="p-4 border-t bg-white">
                <h4 className="font-semibold mb-3 text-purple-700 text-sm">
                  Completed Users ({users.length})
                </h4>
                <div className="space-y-2">
                  {users.map((user: any) => {
                    const certKey = `${user.user_id}-${tutorial.id}`;
                    const isGenerating = generatingCert === certKey;

                    return (
                      <div key={user.user_id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {user.profiles?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {user.profiles?.email || 'No email'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Completed: {new Date(user.completion_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleGenerateCertificate(user, tutorial)}
                          disabled={isGenerating}
                          className="bg-purple-600 hover:bg-purple-700 text-white ml-3"
                          size="sm"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              <span className="text-xs">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-1" />
                              <span className="text-xs">Generate</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}