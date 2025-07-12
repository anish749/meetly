'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Save, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Calendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
}

interface SelectedCalendar extends Calendar {
  enabled: boolean;
  label?: string;
}

export function CalendarManagement() {
  const [availableCalendars, setAvailableCalendars] = useState<Calendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<SelectedCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    setIsLoading(true);
    try {
      // Load available calendars
      const availableResponse = await fetch('/api/calendar/list');
      if (!availableResponse.ok) throw new Error('Failed to fetch calendars');
      const availableData = await availableResponse.json();

      // Load selected calendars
      const selectedResponse = await fetch('/api/calendar/selected');
      if (!selectedResponse.ok) throw new Error('Failed to fetch selected calendars');
      const selectedData = await selectedResponse.json();

      setAvailableCalendars(availableData.calendars || []);

      // If user has no configuration, create default with primary calendar
      if (!selectedData.hasConfiguration && availableData.calendars.length > 0) {
        const primaryCalendar = availableData.calendars.find((cal: Calendar) => cal.primary);
        const defaultCalendar = primaryCalendar || availableData.calendars[0];
        
        setSelectedCalendars([{
          ...defaultCalendar,
          enabled: true,
          label: defaultCalendar.primary ? 'Primary' : 'Main Calendar',
        }]);
        setHasUnsavedChanges(true);
      } else {
        setSelectedCalendars(selectedData.calendars || []);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      toast.error('Failed to load calendars');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCalendars = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/calendar/list');
      if (!response.ok) throw new Error('Failed to refresh calendars');
      const data = await response.json();
      setAvailableCalendars(data.calendars || []);
      toast.success('Calendars refreshed');
    } catch (error) {
      console.error('Error refreshing calendars:', error);
      toast.error('Failed to refresh calendars');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendars(prev => {
      const existing = prev.find(cal => cal.id === calendarId);
      
      if (existing) {
        // Toggle existing calendar
        const updated = prev.map(cal => 
          cal.id === calendarId ? { ...cal, enabled: !cal.enabled } : cal
        );
        
        // Ensure at least one calendar is enabled
        const enabledCount = updated.filter(cal => cal.enabled).length;
        if (enabledCount === 0) {
          toast.error('At least one calendar must be enabled');
          return prev;
        }
        
        setHasUnsavedChanges(true);
        return updated;
      } else {
        // Add new calendar
        const calendar = availableCalendars.find(cal => cal.id === calendarId);
        if (!calendar) return prev;
        
        const newCalendar: SelectedCalendar = {
          ...calendar,
          enabled: true,
          label: calendar.primary ? 'Primary' : calendar.summary,
        };
        
        setHasUnsavedChanges(true);
        return [...prev, newCalendar];
      }
    });
  };

  const updateCalendarLabel = (calendarId: string, label: string) => {
    setSelectedCalendars(prev => 
      prev.map(cal => 
        cal.id === calendarId ? { ...cal, label } : cal
      )
    );
    setHasUnsavedChanges(true);
  };

  const saveCalendars = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/calendar/selected', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendars: selectedCalendars }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save calendars');
      }

      const result = await response.json();
      toast.success(`Saved ${result.enabledCount} calendar(s)`);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving calendars:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save calendars');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading calendars...</span>
        </div>
      </Card>
    );
  }

  const enabledCount = selectedCalendars.filter(cal => cal.enabled).length;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendar Management
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select which calendars to use for scheduling meetings. At least one calendar is required.
            </p>
          </div>
          <Button
            onClick={refreshCalendars}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {availableCalendars.map((calendar) => {
            const selected = selectedCalendars.find(cal => cal.id === calendar.id);
            const isEnabled = selected?.enabled || false;

            return (
              <motion.div
                key={calendar.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-lg p-4 transition-all ${
                  isEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleCalendar(calendar.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{calendar.summary}</h4>
                          {calendar.primary && (
                            <Badge variant="secondary" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {calendar.description && (
                          <p className="text-sm text-muted-foreground">
                            {calendar.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="ml-8 space-y-2"
                      >
                        <Label htmlFor={`label-${calendar.id}`} className="text-sm">
                          Display Label
                        </Label>
                        <Input
                          id={`label-${calendar.id}`}
                          value={selected?.label || ''}
                          onChange={(e) => updateCalendarLabel(calendar.id, e.target.value)}
                          placeholder="e.g., Work, Personal, etc."
                          className="max-w-xs"
                        />
                      </motion.div>
                    )}
                  </div>

                  {calendar.backgroundColor && (
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: calendar.backgroundColor }}
                      title="Calendar color"
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {enabledCount} calendar{enabledCount !== 1 ? 's' : ''} enabled
            {hasUnsavedChanges && (
              <span className="ml-2 text-orange-600">• Unsaved changes</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!hasUnsavedChanges && enabledCount > 0 && (
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
              onClick={saveCalendars}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}