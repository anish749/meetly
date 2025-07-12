'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AnimatedPlaceholder } from './animated-placeholder';
import { PreferencesExplainer } from './preferences-explainer';
import { toast } from 'sonner';
import { Loader2, Save, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface PreferencesData {
  content: string;
  wordCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export function PreferencesForm() {
  const [preferences, setPreferences] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing preferences
  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/preferences');
      if (response.ok) {
        const data: PreferencesData = await response.json();
        setPreferences(data.content || '');
        setWordCount(data.wordCount || 0);
        setLastSavedContent(data.content || '');
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newWordCount = countWords(newText);

    if (newWordCount > 5000) {
      toast.error('Your preferences exceed the 5000 word limit');
      return;
    }

    setPreferences(newText);
    setWordCount(newWordCount);
    setHasUnsavedChanges(newText !== lastSavedContent);

    // Trigger auto-save
    triggerAutoSave();
  };

  const savePreferences = useCallback(
    async (showToast = true) => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: preferences }),
        });

        if (response.ok) {
          if (showToast) {
            toast.success('Preferences saved successfully');
          }
          setHasUnsavedChanges(false);
          setLastSavedContent(preferences);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to save preferences');
        }
      } catch (error) {
        console.error('Error saving preferences:', error);
        toast.error('Failed to save preferences');
      } finally {
        setIsSaving(false);
      }
    },
    [preferences]
  );

  // Auto-save functionality
  const triggerAutoSave = useCallback(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set a new timeout for auto-save (3 seconds after user stops typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (hasUnsavedChanges) {
        savePreferences(false); // Don't show toast for auto-save
      }
    }, 3000);
  }, [hasUnsavedChanges, savePreferences]);

  // Keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          savePreferences();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isSaving, savePreferences]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PreferencesExplainer />

      <div className="space-y-4">
        <div className="relative">
          <AnimatedPlaceholder isActive={!preferences} />
          <Textarea
            value={preferences}
            onChange={handleTextChange}
            className="min-h-24 max-h-64 resize-none overflow-y-auto relative bg-transparent"
            aria-label="Meeting preferences"
          />
        </div>

        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            <span className={wordCount > 4500 ? 'text-warning' : ''}>
              {wordCount} / 5000 words
            </span>
            {wordCount > 4500 && (
              <span className="ml-2 text-warning">(approaching limit)</span>
            )}
          </motion.div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && !isSaving && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-muted-foreground"
              >
                Auto-saving...
              </motion.span>
            )}
            {isSaving && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground flex items-center gap-1"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </motion.span>
            )}
            {!hasUnsavedChanges && !isSaving && preferences && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-green-600 flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Saved
              </motion.span>
            )}
            <Button
              onClick={() => savePreferences(true)}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">
                Save{' '}
                {typeof window !== 'undefined' &&
                navigator.platform.includes('Mac')
                  ? '⌘'
                  : 'Ctrl'}
                +S
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
