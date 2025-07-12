'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  RefreshCw,
  Mail,
  Calendar,
  Settings,
  Brain,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  createdAt: string;
}

interface EmailAnalysisState {
  [emailId: string]: {
    isAnalyzing: boolean;
    isProcessingWithStina: boolean;
    analysisComplete: boolean;
    meetingRequestId?: string;
    error?: string;
  };
}

interface StinaPreferences {
  defaultMeetingType?: 'in-person' | 'virtual' | 'hybrid';
  workingHours?: {
    start: string;
    end: string;
    days: string[];
  };
  timeZone?: string;
  meetingBuffer?: number;
}

export function StinaDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [unreadEmails, setUnreadEmails] = useState<EmailSummary[]>([]);
  const [emailAnalysisState, setEmailAnalysisState] =
    useState<EmailAnalysisState>({});
  const [preferences, setPreferences] = useState<StinaPreferences>({});

  useEffect(() => {
    fetchEmailStatus();
    fetchPreferences();
  }, []);

  const fetchEmailStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/stina/process-emails', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadEmails(data.emails || []);
      } else {
        toast.error('Failed to fetch email status');
      }
    } catch {
      toast.error('Error fetching emails');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/stina/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
      }
    } catch {
      // Error fetching preferences - using default empty object
    }
  };

  const analyzeEmail = async (emailId: string) => {
    try {
      // Update state to show analysis in progress
      setEmailAnalysisState((prev) => ({
        ...prev,
        [emailId]: {
          ...prev[emailId],
          isAnalyzing: true,
          error: undefined,
        },
      }));

      const response = await fetch('/api/emails/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailId }),
      });

      if (response.ok) {
        const data = await response.json();
        setEmailAnalysisState((prev) => ({
          ...prev,
          [emailId]: {
            ...prev[emailId],
            isAnalyzing: false,
            analysisComplete: true,
            meetingRequestId: data.meetingRequestId,
          },
        }));

        toast.success(
          'Email analyzed successfully! Ready for Stina processing.'
        );

        // Automatically process with Stina after analysis
        await processWithStina(emailId, data.meetingRequestId);
      } else {
        const errorData = await response.json();
        setEmailAnalysisState((prev) => ({
          ...prev,
          [emailId]: {
            ...prev[emailId],
            isAnalyzing: false,
            error: errorData.error || 'Analysis failed',
          },
        }));
        toast.error(errorData.error || 'Failed to analyze email');
      }
    } catch {
      setEmailAnalysisState((prev) => ({
        ...prev,
        [emailId]: {
          ...prev[emailId],
          isAnalyzing: false,
          error: 'Network error',
        },
      }));
      toast.error('Error analyzing email');
    }
  };

  const processWithStina = async (
    emailId: string,
    meetingRequestId: string
  ) => {
    try {
      setEmailAnalysisState((prev) => ({
        ...prev,
        [emailId]: {
          ...prev[emailId],
          isProcessingWithStina: true,
        },
      }));

      const response = await fetch('/api/meeting-requests/process-with-stina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingRequestId }),
      });

      if (response.ok) {
        await response.json();
        setEmailAnalysisState((prev) => ({
          ...prev,
          [emailId]: {
            ...prev[emailId],
            isProcessingWithStina: false,
          },
        }));

        toast.success('Email processed with Stina successfully!');

        // Remove the email from unread list as it's been processed
        setUnreadEmails((prev) => prev.filter((email) => email.id !== emailId));
      } else {
        const errorData = await response.json();
        setEmailAnalysisState((prev) => ({
          ...prev,
          [emailId]: {
            ...prev[emailId],
            isProcessingWithStina: false,
            error: errorData.error || 'Stina processing failed',
          },
        }));
        toast.error(errorData.error || 'Failed to process with Stina');
      }
    } catch {
      setEmailAnalysisState((prev) => ({
        ...prev,
        [emailId]: {
          ...prev[emailId],
          isProcessingWithStina: false,
          error: 'Network error during Stina processing',
        },
      }));
      toast.error('Error processing with Stina');
    }
  };

  const updatePreferences = async (newPrefs: Partial<StinaPreferences>) => {
    try {
      const response = await fetch('/api/stina/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: { ...preferences, ...newPrefs },
        }),
      });

      if (response.ok) {
        setPreferences((prev) => ({ ...prev, ...newPrefs }));
        toast.success('Preferences updated');
      } else {
        toast.error('Failed to update preferences');
      }
    } catch {
      toast.error('Error updating preferences');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stina AI Agent</h1>
          <p className="text-muted-foreground">
            Your intelligent executive assistant for meeting scheduling
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Brain className="w-4 h-4 mr-2" />
          AI Powered
        </Badge>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Processing
          </CardTitle>
          <CardDescription>
            Process incoming emails for meeting requests and scheduling
            opportunities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {unreadEmails.length} total emails
              </p>
              <p className="text-xs text-muted-foreground">
                Click &quot;Analyze&quot; to process individual emails with AI
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmailStatus}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>

          {unreadEmails.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <div className="space-y-3">
                {unreadEmails.map((email) => {
                  const analysisState = emailAnalysisState[email.id] || {};
                  const isProcessing =
                    analysisState.isAnalyzing ||
                    analysisState.isProcessingWithStina;

                  return (
                    <div
                      key={email.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                    >
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {email.subject || 'No Subject'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          From: {email.from}
                        </p>
                        {analysisState.error && (
                          <p className="text-xs text-red-600 mt-1">
                            {analysisState.error}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {analysisState.isAnalyzing && (
                          <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Analyzing...
                          </Badge>
                        )}
                        {analysisState.isProcessingWithStina && (
                          <Badge variant="secondary" className="text-xs">
                            <Brain className="w-3 h-3 mr-1" />
                            Processing with Stina...
                          </Badge>
                        )}
                        {!isProcessing && !analysisState.analysisComplete && (
                          <Button
                            size="sm"
                            onClick={() => analyzeEmail(email.id)}
                            className="h-8 px-3"
                          >
                            <Brain className="w-3 h-3 mr-1" />
                            Analyze
                          </Button>
                        )}
                        {analysisState.analysisComplete && !isProcessing && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                            Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unreadEmails.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No unread emails</p>
              <p className="text-xs">
                New emails will appear here for analysis
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Meetings Scheduled
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Emails Processed
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Total processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">No data yet</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How Stina Works</CardTitle>
              <CardDescription>
                Understanding your AI executive assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 mt-0.5 text-blue-500" />
                  <div>
                    <h4 className="font-medium">Email Monitoring</h4>
                    <p className="text-sm text-muted-foreground">
                      Stina monitors emails sent to your connected MailSlurp
                      inbox and displays them for individual analysis.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 mt-0.5 text-purple-500" />
                  <div>
                    <h4 className="font-medium">Two-Stage AI Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      First, Email-Analyst extracts structured meeting
                      information. Then, Stina AI processes the enriched data
                      for scheduling.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 text-green-500" />
                  <div>
                    <h4 className="font-medium">Smart Scheduling</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically checks calendar availability and creates
                      optimized meeting slots with enhanced context
                      understanding.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Stina Preferences
              </CardTitle>
              <CardDescription>
                Configure how Stina handles your meeting scheduling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Default Meeting Type
                  </label>
                  <div className="flex gap-2 mt-2">
                    {['virtual', 'in-person', 'hybrid'].map((type) => (
                      <Button
                        key={type}
                        variant={
                          preferences.defaultMeetingType === type
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          updatePreferences({
                            defaultMeetingType: type as
                              | 'in-person'
                              | 'virtual'
                              | 'hybrid',
                          })
                        }
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Working Hours</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Start
                      </label>
                      <input
                        type="time"
                        value={preferences.workingHours?.start || '09:00'}
                        onChange={(e) =>
                          updatePreferences({
                            workingHours: {
                              ...preferences.workingHours,
                              start: e.target.value,
                              end: preferences.workingHours?.end || '17:00',
                              days: preferences.workingHours?.days || [
                                'monday',
                                'tuesday',
                                'wednesday',
                                'thursday',
                                'friday',
                              ],
                            },
                          })
                        }
                        className="w-full p-2 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        End
                      </label>
                      <input
                        type="time"
                        value={preferences.workingHours?.end || '17:00'}
                        onChange={(e) =>
                          updatePreferences({
                            workingHours: {
                              ...preferences.workingHours,
                              start: preferences.workingHours?.start || '09:00',
                              end: e.target.value,
                              days: preferences.workingHours?.days || [
                                'monday',
                                'tuesday',
                                'wednesday',
                                'thursday',
                                'friday',
                              ],
                            },
                          })
                        }
                        className="w-full p-2 border rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Meeting Buffer (minutes)
                  </label>
                  <input
                    type="number"
                    value={preferences.meetingBuffer || 15}
                    onChange={(e) =>
                      updatePreferences({
                        meetingBuffer: parseInt(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded text-sm mt-2"
                    min="0"
                    max="60"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Time buffer between consecutive meetings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Management</CardTitle>
              <CardDescription>
                Stina learns from your interactions to better understand contact
                preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <p>No contact data available yet.</p>
                <p className="text-sm">
                  Contact preferences will appear here after Stina processes
                  emails.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
