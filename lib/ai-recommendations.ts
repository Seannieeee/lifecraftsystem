export interface AIRecommendation {
  moduleId?: string;
  title?: string;
  reason?: string;
  difficulty?: string;
  points?: number;
  category?: string;
  [key: string]: any; // Allow additional properties from API
}

/**
 * Fetch AI-powered module recommendations for a user
 */
export async function fetchAIRecommendations(userId: string): Promise<AIRecommendation[]> {
  try {
    const response = await fetch('/api/ai-recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error('Error fetching AI recommendations:', error);
    return [];
  }
}