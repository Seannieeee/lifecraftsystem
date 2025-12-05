'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  BookOpen,
  Clock,
  Trophy,
  X,
  RotateCcw
} from 'lucide-react';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content: string;
  order_number: number;
  duration: string;
}

interface QuizQuestion {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  order_number: number;
}

interface LessonScore {
  lessonId: string;
  score: number;
  attempts: number;
}

interface LessonViewerProps {
  moduleId: string;
  moduleTitle: string;
  modulePoints: number;
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}

export function LessonViewer({
  moduleId,
  moduleTitle,
  modulePoints,
  userId,
  onComplete,
  onClose
}: LessonViewerProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [lessonScores, setLessonScores] = useState<Map<string, LessonScore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [moduleCompleted, setModuleCompleted] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastActionTime, setLastActionTime] = useState(0);

  const saveCurrentPosition = async () => {
    try {
      if (!userId || !moduleId) return;

      const { data: existing, error: selectError } = await supabase
        .from('user_modules')
        .select('id, completed')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking existing record:', selectError);
        return;
      }

      if (existing) {
        if (!existing.completed) {
          const { error: updateError } = await supabase
            .from('user_modules')
            .update({
              last_lesson_index: currentLessonIndex
            })
            .eq('user_id', userId)
            .eq('module_id', moduleId);

          if (updateError) {
            console.error('Error updating position:', updateError);
          }
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_modules')
          .insert({
            user_id: userId,
            module_id: moduleId,
            last_lesson_index: currentLessonIndex,
            completed: false,
            score: null,
            completed_at: null
          });

        if (insertError) {
          console.error('Error inserting position:', insertError);
        }
      }
    } catch (error) {
      console.error('Error saving position:', error);
    }
  };

  const saveProgress = async () => {
    try {
      for (const [lessonId, score] of lessonScores.entries()) {
        const { data: existing, error: selectError } = await supabase
          .from('user_lesson_progress')
          .select('id')
          .eq('user_id', userId)
          .eq('lesson_id', lessonId)
          .maybeSingle();

        if (selectError) {
          console.error('Error checking lesson progress:', selectError);
          continue;
        }

        const progressData = {
          completed: score.attempts >= 3 || score.score >= 70,
          quiz_score: score.score,
          attempts: score.attempts,
          completed_at: new Date().toISOString()
        };

        if (existing) {
          const { error: updateError } = await supabase
            .from('user_lesson_progress')
            .update(progressData)
            .eq('user_id', userId)
            .eq('lesson_id', lessonId);

          if (updateError) {
            console.error('Error updating lesson progress:', updateError);
          }
        } else {
          const { error: insertError } = await supabase
            .from('user_lesson_progress')
            .insert({
              user_id: userId,
              lesson_id: lessonId,
              ...progressData
            });

          if (insertError) {
            console.error('Error inserting lesson progress:', insertError);
          }
        }
      }

      await saveCurrentPosition();
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  useEffect(() => {
    loadLessons();
    checkModuleCompletion();
  }, [moduleId]);

  useEffect(() => {
    if (currentLessonIndex < lessons.length && initialLoadComplete) {
      loadQuizQuestions(lessons[currentLessonIndex].id);
      const saveTimeout = setTimeout(() => {
        saveCurrentPosition();
      }, 500);
      return () => clearTimeout(saveTimeout);
    }
  }, [currentLessonIndex, lessons, initialLoadComplete]);

  const loadLessons = async () => {
    try {
      if (!moduleId || !userId) {
        console.error('Missing moduleId or userId');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_number', { ascending: true });

      if (error) throw error;
      
      setLessons(data || []);
      await loadProgress(data || []);

      if (data && data.length > 0) {
        await determineStartingLesson(data);
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      alert('Failed to load lessons. Please refresh the page and try again.');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  const loadProgress = async (lessonsData: Lesson[]) => {
    try {
      const { data, error } = await supabase
        .from('user_lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .in('lesson_id', lessonsData.map(l => l.id));

      if (error) throw error;

      const scoresMap = new Map<string, LessonScore>();
      data?.forEach((progress: any) => {
        if (progress.quiz_score !== null && progress.quiz_score !== undefined) {
          scoresMap.set(progress.lesson_id, {
            lessonId: progress.lesson_id,
            score: progress.quiz_score,
            attempts: progress.attempts || 1
          });
        }
      });
      setLessonScores(scoresMap);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const determineStartingLesson = async (lessonsData: Lesson[]) => {
    try {
      const { data: moduleData, error } = await supabase
        .from('user_modules')
        .select('completed, last_lesson_index')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .maybeSingle();

      if (error) {
        console.error('Error loading module data:', error);
      }

      if (moduleData?.completed) {
        setIsReviewMode(true);
        setModuleCompleted(true);
        setCurrentLessonIndex(0);
        return;
      }

      if (moduleData?.last_lesson_index !== null && 
          moduleData?.last_lesson_index !== undefined) {
        const savedIndex = moduleData.last_lesson_index;
        
        if (savedIndex >= 0 && savedIndex < lessonsData.length) {
          setCurrentLessonIndex(savedIndex);
          return;
        }
      }

      const { data: progressData } = await supabase
        .from('user_lesson_progress')
        .select('lesson_id, attempts')
        .eq('user_id', userId)
        .in('lesson_id', lessonsData.map(l => l.id));

      const completedLessonIds = new Set(
        progressData?.filter(p => p.attempts > 0).map(p => p.lesson_id) || []
      );

      const firstIncompleteIndex = lessonsData.findIndex(
        lesson => !completedLessonIds.has(lesson.id)
      );

      setCurrentLessonIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
    } catch (error) {
      console.error('Error determining starting lesson:', error);
      setCurrentLessonIndex(0);
    }
  };

  const checkModuleCompletion = async () => {
    try {
      const { data } = await supabase
        .from('user_modules')
        .select('completed')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .maybeSingle();

      if (data?.completed) {
        setModuleCompleted(true);
        setIsReviewMode(true);
      }
    } catch (error) {
      setModuleCompleted(false);
    }
  };

  const loadQuizQuestions = async (lessonId: string) => {
    try {
      if (!lessonId) return;

      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('order_number', { ascending: true });

      if (error) throw error;
      
      setQuizQuestions(data || []);
      setSelectedAnswers(new Array(data?.length || 0).fill(-1));
      setQuizSubmitted(false);
      setShowQuiz(false);
    } catch (error) {
      console.error('Error loading quiz questions:', error);
    }
  };

  const getCurrentLessonScore = () => {
    if (!lessons[currentLessonIndex]) return null;
    return lessonScores.get(lessons[currentLessonIndex].id);
  };

  const canTakeQuiz = () => {
    const currentScore = getCurrentLessonScore();
    return !currentScore || currentScore.attempts < 3;
  };

  const handleNextLesson = () => {
    const now = Date.now();
    if (now - lastActionTime < 2000) {
      return;
    }
    setLastActionTime(now);

    if (quizQuestions.length > 0 && !quizSubmitted && !isReviewMode) {
      if (!canTakeQuiz()) {
        alert('You have used all 3 attempts for this quiz. Moving to next lesson...');
        moveToNextLesson();
      } else {
        setShowQuiz(true);
      }
    } else {
      moveToNextLesson();
    }
  };

  const moveToNextLesson = async () => {
    if (isProcessing) return;

    const currentScore = getCurrentLessonScore();

    if (lessons[currentLessonIndex]) {
      await markLessonComplete(
        lessons[currentLessonIndex].id,
        currentScore?.score || 0
      );
    }

    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      if (isReviewMode) {
        handleClose();
      } else {
        await completeModule();
      }
    }
  };

  const markLessonComplete = async (lessonId: string, score: number) => {
    try {
      const { data: existing, error: selectError } = await supabase
        .from('user_lesson_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking lesson completion:', selectError);
        return;
      }

      const progressData = {
        completed: true,
        quiz_score: score,
        completed_at: new Date().toISOString()
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_lesson_progress')
          .update(progressData)
          .eq('user_id', userId)
          .eq('lesson_id', lessonId);

        if (updateError) {
          console.error('Error updating lesson completion:', updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_lesson_progress')
          .insert({
            user_id: userId,
            lesson_id: lessonId,
            attempts: 1,
            ...progressData
          });

        if (insertError) {
          console.error('Error inserting lesson completion:', insertError);
        }
      }
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    }
  };

  const calculateOverallScore = () => {
    if (lessonScores.size === 0) return 0;

    let totalScore = 0;
    let countedLessons = 0;

    lessonScores.forEach(score => {
      if (score.attempts > 0) {
        totalScore += score.score;
        countedLessons++;
      }
    });

    return countedLessons === 0 ? 0 : Math.round(totalScore / countedLessons);
  };

  const completeModule = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      const overallScore = calculateOverallScore();

      const { data: existingCompletion, error: checkError } = await supabase
        .from('user_modules')
        .select('completed, score')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking completion:', checkError);
        throw new Error('Failed to check module completion status');
      }

      if (existingCompletion?.completed) {
        alert('✅ This module is already completed! Your progress has been saved.');
        setModuleCompleted(true);
        setIsReviewMode(true);
        setIsProcessing(false);
        onComplete();
        return;
      }

      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('title')
        .eq('id', moduleId)
        .single();

      if (moduleError) {
        console.error('Error fetching module:', moduleError);
        throw new Error('Failed to fetch module information');
      }

      const moduleTitleText = moduleData?.title || 'Module';

      let earnedPoints = 0;
      let badgeMessage = '';
      
      if (overallScore >= 50) {
        const allQuizQuestions: { [lessonId: string]: number } = {};
        for (const lesson of lessons) {
          const { data: questions, error: questionsError } = await supabase
            .from('quiz_questions')
            .select('id')
            .eq('lesson_id', lesson.id);

          if (questionsError) {
            console.error('Error fetching questions:', questionsError);
          }
          allQuizQuestions[lesson.id] = questions?.length || 0;
        }

        let totalCorrect = 0;
        let totalQuestions = 0;

        lessonScores.forEach((score, lessonId) => {
          const questionCount = allQuizQuestions[lessonId] || 0;
          const correctAnswers = Math.round((score.score / 100) * questionCount);
          totalCorrect += correctAnswers;
          totalQuestions += questionCount;
        });

        earnedPoints = totalQuestions > 0
          ? Math.round((totalCorrect / totalQuestions) * modulePoints)
          : 0;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          throw new Error('Failed to fetch user profile');
        }

        const currentPoints = profileData?.points || 0;
        const newPoints = currentPoints + earnedPoints;

        const { error: pointsError } = await supabase
          .from('profiles')
          .update({ points: newPoints })
          .eq('id', userId);

        if (pointsError) {
          console.error('Error updating points:', pointsError);
          throw new Error('Failed to update points');
        }

        const { error: logError } = await supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'Completed Module',
            item: moduleTitleText,
            points: earnedPoints
          });

        if (logError) {
          console.error('Error logging activity:', logError);
        }

        const badgeName = `${moduleTitleText} Master`;
        const { data: existingBadge, error: badgeCheckError } = await supabase
          .from('activity_log')
          .select('id')
          .eq('user_id', userId)
          .eq('action', 'Earned Badge')
          .eq('item', badgeName)
          .maybeSingle();

        if (badgeCheckError) {
          console.error('Error checking badge:', badgeCheckError);
        }

        if (!existingBadge) {
          const { error: badgeError } = await supabase
            .from('activity_log')
            .insert({
              user_id: userId,
              action: 'Earned Badge',
              item: badgeName,
              points: 50
            });

          if (badgeError) {
            console.error('Error awarding badge:', badgeError);
          } else {
            const { error: badgePointsError } = await supabase
              .from('profiles')
              .update({ points: newPoints + 50 })
              .eq('id', userId);

            if (badgePointsError) {
              console.error('Error updating badge points:', badgePointsError);
            } else {
              badgeMessage = ` You also earned the "${badgeName}" badge (+50 bonus points)!`;
            }
          }
        }
      } else {
        const { error: logError } = await supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'Completed Module',
            item: moduleTitleText,
            points: 0
          });

        if (logError) {
          console.error('Error logging activity:', logError);
        }
      }

      if (existingCompletion) {
        const { error: updateError } = await supabase
          .from('user_modules')
          .update({
            completed: true,
            score: overallScore,
            completed_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('module_id', moduleId);

        if (updateError) {
          console.error('Error updating module:', updateError);
          throw new Error('Failed to mark module as completed');
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_modules')
          .insert({
            user_id: userId,
            module_id: moduleId,
            completed: true,
            score: overallScore,
            completed_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting module:', insertError);
          throw new Error('Failed to mark module as completed');
        }
      }

      setModuleCompleted(true);
      
      if (overallScore >= 50) {
        alert(`🎉 Module completed! Overall score: ${overallScore}%. You earned ${earnedPoints} out of ${modulePoints} points!${badgeMessage}`);
      } else {
        alert(`✅ Module completed! Overall score: ${overallScore}%. Since your score is below 50%, no points were awarded. You can review the lessons anytime to improve your understanding.`);
      }
      
      onComplete();
    } catch (error) {
      console.error('Error completing module:', error);
      alert(`Failed to complete module: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuizSubmit = async () => {
    const now = Date.now();
    if (now - lastActionTime < 2000) {
      return;
    }
    setLastActionTime(now);

    let correct = 0;
    quizQuestions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correct_answer) {
        correct++;
      }
    });

    const score = Math.round((correct / quizQuestions.length) * 100);
    const currentLessonId = lessons[currentLessonIndex].id;
    const currentScore = lessonScores.get(currentLessonId);

    const newScore: LessonScore = {
      lessonId: currentLessonId,
      score: score,
      attempts: (currentScore?.attempts || 0) + 1
    };

    if (currentScore && currentScore.score > score) {
      newScore.score = currentScore.score;
    }

    const newScores = new Map(lessonScores);
    newScores.set(currentLessonId, newScore);
    setLessonScores(newScores);

    setQuizSubmitted(true);
    
    await markLessonComplete(currentLessonId, newScore.score);
    
    if (currentLessonIndex === lessons.length - 1 && !isReviewMode) {
      setTimeout(async () => {
        await completeModule();
      }, 1500);
    }
  };

  const handleResetQuiz = () => {
    const currentLessonId = lessons[currentLessonIndex].id;
    const currentScore = lessonScores.get(currentLessonId);

    if (!currentScore || currentScore.attempts < 3) {
      setSelectedAnswers(new Array(quizQuestions.length).fill(-1));
      setQuizSubmitted(false);
    } else {
      alert('You have already used all 3 attempts for this quiz.');
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    if (!quizSubmitted && !isReviewMode) {
      const newAnswers = [...selectedAnswers];
      newAnswers[questionIndex] = answerIndex;
      setSelectedAnswers(newAnswers);
    }
  };

  const handleClose = async () => {
    await saveProgress();
    onClose();
  };

  const formatContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl sm:text-3xl font-bold mt-6 mb-4 text-gray-900">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl sm:text-2xl font-bold mt-5 mb-3 text-gray-900">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg sm:text-xl font-semibold mt-4 mb-2 text-gray-900">{line.slice(4)}</h3>;
      }

      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={index} className="mb-2 text-sm sm:text-base text-gray-800">
            {parts.map((part, i) => i % 2 === 0 ? part : <strong key={i} className="font-bold">{part}</strong>)}
          </p>
        );
      }

      if (line.trim().startsWith('- ')) {
        return <li key={index} className="ml-6 mb-1 text-sm sm:text-base text-gray-800">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\./)) {
        return <li key={index} className="ml-6 mb-1 list-decimal text-sm sm:text-base text-gray-800">{line.replace(/^\d+\.\s*/, '')}</li>;
      }

      if (line.includes('✓') || line.includes('□') || line.includes('❌')) {
        return <p key={index} className="mb-2 ml-4 text-sm sm:text-base text-gray-800">{line}</p>;
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }

      return <p key={index} className="mb-2 text-sm sm:text-base text-gray-800">{line}</p>;
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-4xl mx-4 p-6 sm:p-8 bg-white shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading lessons...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-4xl mx-4 p-6 sm:p-8 bg-white shadow-2xl">
          <div className="text-center">
            <p className="mb-4 text-gray-900">No lessons found for this module.</p>
            <Button onClick={handleClose} className="bg-red-600 hover:bg-red-700 text-white">Close</Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentLesson = lessons[currentLessonIndex];
  const progress = ((currentLessonIndex + 1) / lessons.length) * 100;
  const currentScore = getCurrentLessonScore();
  const attemptsRemaining = 3 - (currentScore?.attempts || 0);
  const completedLessonsCount = Array.from(lessonScores.values()).filter(s => s.attempts > 0).length;
  const progressPercent = lessons.length > 0 ? (completedLessonsCount / lessons.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-5xl my-4 sm:my-8 bg-white shadow-2xl rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 truncate">{moduleTitle}</h2>
              <p className="text-red-100 text-xs sm:text-sm">
                Lesson {currentLessonIndex + 1} of {lessons.length}
                {isReviewMode && <Badge className="ml-2 bg-white text-red-600 text-xs">Review Mode</Badge>}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="text-right flex-1 sm:flex-initial">
                <div className="text-xs sm:text-sm text-red-100">Overall Progress</div>
                <div className="text-xl sm:text-2xl font-bold">{Math.round(progressPercent)}%</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="bg-white text-red-600 hover:bg-red-50 border-0 text-xs sm:text-sm"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            </div>
          </div>

          <Progress value={progress} className="h-2 sm:h-3 bg-red-400" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 bg-white max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
          {!showQuiz ? (
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    <BookOpen className="w-3 h-3" />
                    Lesson {currentLesson.order_number}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1 bg-purple-50 text-purple-700 border-purple-200 text-xs">
                    <Clock className="w-3 h-3" />
                    {currentLesson.duration}
                  </Badge>
                </div>
                {currentScore && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                    Best Score: {currentScore.score}% ({currentScore.attempts}/3 attempts)
                  </Badge>
                )}
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900">{currentLesson.title}</h3>
              <p className="text-gray-600 text-base sm:text-lg mb-6 pb-4 border-b-2 border-gray-200">{currentLesson.description}</p>

              <div className="prose max-w-none">
                {formatContent(currentLesson.content)}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Lesson Quiz</h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    {isReviewMode ? 'Reviewing quiz answers' : 'Test your knowledge before moving forward'}
                  </p>
                </div>
                {!isReviewMode && (
                  <div className="text-right">
                    <Badge className={`text-xs sm:text-sm ${attemptsRemaining > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-4 sm:space-y-6">
                {quizQuestions.map((question, qIndex) => (
                  <Card key={question.id} className="p-4 sm:p-6 bg-gray-50 border-2 border-gray-200">
                    <h4 className="font-semibold mb-4 text-gray-900 text-base sm:text-lg">
                      Question {qIndex + 1}: {question.question}
                    </h4>

                    <div className="space-y-2 sm:space-y-3">
                      {question.options.map((option, oIndex) => {
                        const isSelected = selectedAnswers[qIndex] === oIndex;
                        const isCorrect = oIndex === question.correct_answer;
                        const showResult = quizSubmitted || isReviewMode;

                        let buttonClass = 'w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all ';

                        if (showResult) {
                          if (isCorrect) {
                            buttonClass += 'border-green-500 bg-green-50 shadow-md';
                          } else if (isSelected && !isCorrect) {
                            buttonClass += 'border-red-500 bg-red-50 shadow-md';
                          } else {
                            buttonClass += 'border-gray-300 bg-white';
                          }
                        } else {
                          buttonClass += isSelected
                            ? 'border-red-600 bg-red-50 shadow-md'
                            : 'border-gray-300 bg-white hover:border-red-400 hover:bg-red-50';
                        }

                        return (
                          <button
                            key={oIndex}
                            onClick={() => handleAnswerSelect(qIndex, oIndex)}
                            disabled={quizSubmitted || isReviewMode}
                            className={buttonClass}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-red-600 bg-red-100' : 'border-gray-400'
                                }`}>
                                {showResult && isCorrect && (
                                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                                )}
                                {showResult && isSelected && !isCorrect && (
                                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                                )}
                                {!showResult && isSelected && (
                                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-600"></div>
                                )}
                              </div>
                              <span className="text-sm sm:text-base text-gray-900 font-medium">{option}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {(quizSubmitted || isReviewMode) && (
                      <div className="mt-4 p-3 sm:p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                        <p className="text-xs sm:text-sm text-blue-900">
                          <strong className="font-bold">Explanation:</strong> {question.explanation}
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {quizSubmitted && !isReviewMode && (
                <Card className="p-4 sm:p-6 mt-4 sm:mt-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg sm:text-xl mb-1 text-gray-900">Quiz Complete!</h4>
                      <p className="text-sm sm:text-base text-gray-700">
                        You scored <strong className="text-red-600">{currentScore?.score}%</strong> on this lesson
                        ({currentScore?.attempts}/3 attempts used)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 mx-auto mb-1" />
                        <div className="text-2xl sm:text-3xl font-bold text-red-600">{currentScore?.score}%</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="border-t-2 border-gray-200 p-4 sm:p-6 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (showQuiz) {
                setShowQuiz(false);
              } else if (currentLessonIndex > 0) {
                setCurrentLessonIndex(currentLessonIndex - 1);
              }
            }}
            disabled={currentLessonIndex === 0 && !showQuiz || showQuiz && !quizSubmitted}
            className="flex items-center gap-2 border-2 w-full sm:w-auto text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {showQuiz ? 'Back to Lesson' : 'Previous'}
          </Button>

          <div className="text-center order-first sm:order-none">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Module Reward</div>
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm sm:text-base">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              {modulePoints} points
            </div>
          </div>

          {!showQuiz ? (
            <Button
              onClick={handleNextLesson}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 shadow-md w-full sm:w-auto text-sm"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' :
                quizQuestions.length > 0 && !isReviewMode && canTakeQuiz() ? 'Take Quiz' :
                quizQuestions.length > 0 && !isReviewMode && !canTakeQuiz() ? 'Next Lesson' :
                  currentLessonIndex < lessons.length - 1 ? 'Next Lesson' :
                    isReviewMode ? 'Close Review' : 'Complete Module'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto">
              {!quizSubmitted && !isReviewMode ? (
                <>
                  <Button
                    onClick={handleResetQuiz}
                    variant="outline"
                    className="flex items-center gap-2 border-2 flex-1 sm:flex-initial text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                  <Button
                    onClick={handleQuizSubmit}
                    disabled={selectedAnswers.includes(-1) || isProcessing}
                    className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 shadow-md flex-1 sm:flex-initial text-sm"
                  >
                    {isProcessing ? 'Processing...' :
                      currentLessonIndex === lessons.length - 1 ? 'Submit & Complete' : 'Submit Quiz'}
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  {attemptsRemaining > 0 && !isReviewMode && (
                    <Button
                      onClick={handleResetQuiz}
                      variant="outline"
                      className="flex items-center gap-2 border-2 flex-1 sm:flex-initial text-sm"
                      disabled={isProcessing}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="hidden sm:inline">Retake ({attemptsRemaining})</span>
                      <span className="sm:hidden">Retake</span>
                    </Button>
                  )}
                  {!isProcessing && (
                    <Button
                      onClick={moveToNextLesson}
                      className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 shadow-md flex-1 sm:flex-initial text-sm"
                    >
                      {currentLessonIndex < lessons.length - 1 ? 'Next Lesson' :
                        isReviewMode ? 'Close Review' : 'Complete Module'}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}