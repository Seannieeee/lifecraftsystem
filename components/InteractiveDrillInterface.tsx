import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, XCircle, Clock, Award, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DrillContent {
  id: string;
  drill_id: string;
  step_number: number;
  step_title: string;
  step_description: string;
  step_type: string;
  content: any;
  points: number;
  time_limit: number | null;
}

interface InteractiveDrillProps {
  drillId: string;
  drillTitle: string;
  userId: string;
  userDrillId: string;
  isRetry: boolean;
  onComplete: (score: number, timeSpent: string) => void;
  onExit: () => void;
}

export function InteractiveDrillInterface({ 
  drillId, 
  drillTitle, 
  userId, 
  userDrillId,
  isRetry,
  onComplete,
  onExit 
}: InteractiveDrillProps) {
  const [steps, setSteps] = useState<DrillContent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<any[]>([]);

  // Prevent page close/refresh during drill
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load drill content
  useEffect(() => {
    loadDrillContent();
  }, [drillId]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Time's up - auto submit
          if (!showResult) {
            handleSubmitAnswer();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, showResult]);

  const loadDrillContent = async () => {
    try {
      const { data, error } = await supabase
        .from('drill_content')
        .select('*')
        .eq('drill_id', drillId)
        .order('step_number', { ascending: true });

      if (error) throw error;

      console.log('Loaded drill content:', data);

      setSteps(data || []);
      
      // Calculate total possible points
      const total = data?.reduce((sum, step) => sum + (step.points || 0), 0) || 0;
      setTotalPoints(total);

      // Set timer for first step if applicable
      if (data && data[0]?.time_limit) {
        setTimeRemaining(data[0].time_limit);
      }
    } catch (error) {
      console.error('Error loading drill content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const step = steps[currentStep];
    
    if (step.step_type === 'info' || step.step_type === 'action') {
      // Info steps don't require answers
      handleNext();
      return;
    }

    const content = step.content;
    
    // Handle both camelCase and snake_case for compatibility
    const correctAnswerIndex = content.correctAnswer !== undefined 
      ? content.correctAnswer 
      : content.correct_answer;
    
    console.log('=== ANSWER VALIDATION ===');
    console.log('Content:', content);
    console.log('Correct answer index:', correctAnswerIndex);
    console.log('Selected answer:', selectedAnswer);
    console.log('Correct answer type:', typeof correctAnswerIndex);
    console.log('Selected answer type:', typeof selectedAnswer);
    
    const correct = selectedAnswer === correctAnswerIndex;
    console.log('Is correct?', correct);
    console.log('========================');
    
    setIsCorrect(correct);
    setShowResult(true);

    // Award points if correct (only for tracking, actual points awarded on completion)
    const pointsEarned = correct ? step.points : 0;
    setEarnedPoints(prev => prev + pointsEarned);

    // Log attempt
    try {
      const attempt = {
        user_drill_id: userDrillId,
        step_number: step.step_number,
        user_answer: { selected: selectedAnswer },
        is_correct: correct,
        points_earned: pointsEarned,
        time_spent: step.time_limit ? (step.time_limit - (timeRemaining || 0)) : null
      };

      const { error } = await supabase
        .from('drill_attempts')
        .insert(attempt);

      if (error) throw error;

      setAttempts(prev => [...prev, attempt]);
    } catch (error) {
      console.error('Error logging attempt:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      
      // Set timer for next step
      const nextStep = steps[currentStep + 1];
      if (nextStep?.time_limit) {
        setTimeRemaining(nextStep.time_limit);
      } else {
        setTimeRemaining(null);
      }
    } else {
      // Drill complete
      finishDrill();
    }
  };

  const finishDrill = () => {
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeSpent = `${minutes}m ${seconds}s`;
    
    // Calculate percentage score
    const scorePercentage = totalPoints > 0 
      ? Math.round((earnedPoints / totalPoints) * 100) 
      : 0;

    onComplete(scorePercentage, timeSpent);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading drill...</p>
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-center mb-2">Drill Content Not Available</h2>
          <p className="text-gray-600 text-center mb-4">
            This drill does not have content configured yet.
          </p>
          <Button onClick={onExit} className="w-full">
            Exit
          </Button>
        </Card>
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  
  // Handle both camelCase and snake_case
  const correctAnswerIndex = currentStepData.content?.correctAnswer !== undefined
    ? currentStepData.content.correctAnswer
    : currentStepData.content?.correct_answer;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-red-50">
          {isRetry && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                You're retrying this drill. No points will be awarded, but you can improve your score!
              </p>
            </div>
          )}
          
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {drillTitle}
              </h1>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                  Step {currentStep + 1} of {steps.length}
                </Badge>
                {isRetry && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                    Practice Mode
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-gray-700">
                  <Award className="w-4 h-4" />
                  <span>
                    {earnedPoints} / {totalPoints} pts
                    {isRetry && <span className="text-xs ml-1">(Not awarded)</span>}
                  </span>
                </div>
              </div>
            </div>
            
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                timeRemaining <= 10 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold">{timeRemaining}s</span>
              </div>
            )}
          </div>
          
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 bg-white">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">
              {currentStepData.step_title}
            </h2>
            <p className="text-gray-700">
              {currentStepData.step_description}
            </p>
          </div>

          {/* Question/Decision Type */}
          {(currentStepData.step_type === 'question' || currentStepData.step_type === 'decision') && (
            <div className="space-y-3">
              <p className="font-medium text-gray-900 mb-4">
                {currentStepData.content.question}
              </p>
              
              <div className="space-y-2">
                {currentStepData.content.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => !showResult && setSelectedAnswer(index)}
                    disabled={showResult}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      showResult
                        ? index === correctAnswerIndex
                          ? 'border-green-500 bg-green-50 text-gray-900'
                          : index === selectedAnswer
                          ? 'border-red-500 bg-red-50 text-gray-900'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                        : selectedAnswer === index
                        ? 'border-red-600 bg-red-50 text-gray-900'
                        : 'border-gray-300 bg-white hover:border-red-300 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {showResult && index === correctAnswerIndex && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {showResult && index === selectedAnswer && index !== correctAnswerIndex && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {showResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-semibold ${isCorrect ? 'text-green-900' : 'text-red-900'}`}>
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                      </p>
                      <p className="text-sm text-gray-800 mt-1">
                        {currentStepData.content.explanation}
                      </p>
                      {isCorrect && !isRetry && (
                        <p className="text-sm font-medium text-green-700 mt-2">
                          +{currentStepData.points} points
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Type */}
          {currentStepData.step_type === 'info' && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="space-y-2">
                {currentStepData.content.instructions?.map((instruction: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-gray-800">{instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Type */}
          {currentStepData.step_type === 'action' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                <p className="font-medium text-amber-900 mb-3">
                  {currentStepData.content.instruction}
                </p>
                <div className="space-y-2">
                  {currentStepData.content.actions?.map((action: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-800">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={onExit}
              disabled={!showResult && (currentStepData.step_type === 'question' || currentStepData.step_type === 'decision')}
              className="px-6"
            >
              Exit Drill
            </Button>
            
            {!showResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={
                  (currentStepData.step_type === 'question' || currentStepData.step_type === 'decision') && 
                  selectedAnswer === null
                }
                className="bg-red-600 hover:bg-red-700 text-white px-6"
              >
                {currentStepData.step_type === 'info' || currentStepData.step_type === 'action' 
                  ? 'Continue' 
                  : 'Submit Answer'
                }
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="bg-red-600 hover:bg-red-700 text-white px-6"
              >
                {currentStep < steps.length - 1 ? 'Next Step' : 'Complete Drill'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}