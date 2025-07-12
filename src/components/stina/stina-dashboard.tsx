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
  Users,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { UserDocument } from '@/types/firebase-collections';

interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  createdAt: string;
}

interface AnalysisResult {
  meetingIntent: string;
  duration?: number;
  location?: string;
  invitees: Array<{
    email: string;
    name: string;
    role: 'attendee' | 'coordinator';
    work_context?: string;
    relationship?: string;
    coordinates_for?: string;
  }>;
  confidence: string;
}

interface EmailAnalysisState {
  [emailId: string]: {
    isAnalyzing: boolean;
    isProcessingWithStina: boolean;
    analysisComplete: boolean;
    meetingRequestId?: string;
    analysisResult?: AnalysisResult;
    error?: string;
  };
}

type StinaPreferences = NonNullable<UserDocument['stinaPreferences']>;
type MailSlurpConfig = NonNullable<UserDocument['mailSlurp']>;

export function StinaDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [unreadEmails, setUnreadEmails] = useState<EmailSummary[]>([]);
  const [emailAnalysisState, setEmailAnalysisState] =
    useState<EmailAnalysisState>({});
  const [preferences, setPreferences] = useState<StinaPreferences>({});
  const [mailSlurpConfig, setMailSlurpConfig] = useState<MailSlurpConfig>({
    status: 'not-setup',
    inboxId: '',
    mailslurpEmail: '',
  });
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    fetchEmailStatus();
    fetchPreferences();
    fetchMailSlurpConfig();
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

  const fetchMailSlurpConfig = async () => {
    try {
      const response = await fetch('/api/mailslurp/email-config');
      if (response.ok) {
        const data = await response.json();
        const config = data.mailSlurp || {
          status: 'not-setup',
          inboxId: '',
          mailslurpEmail: '',
        };
        setMailSlurpConfig(config);

        // Set the current custom email input from the existing email
        if (config.mailslurpEmail) {
          const customPart = config.mailslurpEmail.replace('@mailslurp.io', '');
          setCustomEmailInput(customPart);
        }
      }
    } catch {
      // Error fetching MailSlurp config - using default
    }
  };

  const updateMailSlurpEmail = async () => {
    if (!customEmailInput.trim()) {
      toast.error('Please enter a custom email');
      return;
    }

    try {
      setIsUpdatingEmail(true);
      const response = await fetch('/api/mailslurp/email-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customEmail: customEmailInput.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setMailSlurpConfig(data.mailSlurp);
        toast.success('MailSlurp email updated successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update email');
      }
    } catch {
      toast.error('Error updating MailSlurp email');
    } finally {
      setIsUpdatingEmail(false);
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
            analysisResult: data.analysis,
          },
        }));

        toast.success('Email analyzed successfully! Review the results below.');
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

                  const isExpanded = expandedAnalysis.has(email.id);
                  const hasAnalysisResults = analysisState.analysisResult;

                  return (
                    <div
                      key={email.id}
                      className="bg-muted/50 rounded-lg border"
                    >
                      {/* Email Header */}
                      <div className="flex items-center gap-3 p-3">
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
                          {hasAnalysisResults && !isProcessing && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newExpanded = new Set(expandedAnalysis);
                                  if (isExpanded) {
                                    newExpanded.delete(email.id);
                                  } else {
                                    newExpanded.add(email.id);
                                  }
                                  setExpandedAnalysis(newExpanded);
                                }}
                                className="h-8 px-2"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  processWithStina(
                                    email.id,
                                    analysisState.meetingRequestId!
                                  )
                                }
                                className="h-8 px-3"
                              >
                                <Brain className="w-3 h-3 mr-1" />
                                Process with Stina
                              </Button>
                            </>
                          )}
                          {analysisState.analysisComplete &&
                            !hasAnalysisResults &&
                            !isProcessing && (
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

                      {/* Analysis Results */}
                      {hasAnalysisResults && isExpanded && (
                        <div className="border-t bg-white/50 p-4 space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="w-4 h-4 text-purple-600" />
                            <h4 className="font-medium text-sm">
                              Analysis Results
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {analysisState.analysisResult?.confidence}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {/* Meeting Intent */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-3 h-3 text-blue-600" />
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Meeting Purpose
                                </span>
                              </div>
                              <p className="text-sm bg-blue-50 p-2 rounded border-l-2 border-blue-200">
                                {analysisState.analysisResult?.meetingIntent}
                              </p>
                            </div>

                            {/* Duration */}
                            {analysisState.analysisResult?.duration && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="w-3 h-3 text-green-600" />
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Duration
                                  </span>
                                </div>
                                <p className="text-sm text-green-700">
                                  {analysisState.analysisResult?.duration}{' '}
                                  minutes
                                </p>
                              </div>
                            )}

                            {/* Location */}
                            {analysisState.analysisResult?.location && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <MapPin className="w-3 h-3 text-orange-600" />
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Location
                                  </span>
                                </div>
                                <p className="text-sm text-orange-700">
                                  {analysisState.analysisResult?.location}
                                </p>
                              </div>
                            )}

                            {/* Invitees */}
                            {analysisState.analysisResult?.invitees &&
                              analysisState.analysisResult?.invitees.length >
                                0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-3 h-3 text-purple-600" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Invitees (
                                      {
                                        analysisState.analysisResult?.invitees
                                          .length
                                      }
                                      )
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {analysisState.analysisResult?.invitees.map(
                                      (invitee, index) => (
                                        <div
                                          key={index}
                                          className={`text-sm p-2 rounded border-l-2 ${
                                            invitee.role === 'attendee'
                                              ? 'bg-blue-50 border-blue-200'
                                              : 'bg-amber-50 border-amber-200'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="font-medium">
                                              {invitee.name}
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className={`text-xs ${
                                                invitee.role === 'attendee'
                                                  ? 'bg-blue-100 text-blue-700'
                                                  : 'bg-amber-100 text-amber-700'
                                              }`}
                                            >
                                              {invitee.role === 'attendee'
                                                ? 'Attendee'
                                                : 'Coordinator'}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {invitee.email}
                                          </div>
                                          {(invitee.work_context ||
                                            invitee.relationship) && (
                                            <div className="text-xs mt-1 text-gray-600">
                                              {invitee.work_context ||
                                                invitee.relationship}
                                            </div>
                                          )}
                                          {invitee.coordinates_for && (
                                            <div className="text-xs mt-1 text-amber-700">
                                              Coordinates for:{' '}
                                              {invitee.coordinates_for}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                MailSlurp Email Configuration
              </CardTitle>
              <CardDescription>
                Configure your custom MailSlurp email address for receiving
                meeting requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={
                      mailSlurpConfig.status === 'ready'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {mailSlurpConfig.status === 'ready'
                      ? 'Ready'
                      : 'Setup Required'}
                  </Badge>
                  {mailSlurpConfig.status === 'ready' && (
                    <Badge variant="outline" className="text-xs">
                      Inbox ID: {mailSlurpConfig.inboxId.slice(0, 8)}...
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Custom Email Address
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Choose a custom prefix for your MailSlurp email address.
                    Only letters, numbers, dots, underscores, and hyphens are
                    allowed.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 flex">
                      <input
                        type="text"
                        value={customEmailInput}
                        onChange={(e) =>
                          setCustomEmailInput(e.target.value.toLowerCase())
                        }
                        placeholder="my-meetings"
                        className="flex-1 p-2 border rounded-l text-sm"
                        disabled={isUpdatingEmail}
                      />
                      <div className="px-3 py-2 bg-muted border-t border-b border-r rounded-r text-sm text-muted-foreground">
                        @mailslurp.io
                      </div>
                    </div>
                    <Button
                      onClick={updateMailSlurpEmail}
                      disabled={isUpdatingEmail || !customEmailInput.trim()}
                      size="sm"
                    >
                      {isUpdatingEmail ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Update
                    </Button>
                  </div>
                  {mailSlurpConfig.mailslurpEmail && (
                    <p className="text-xs text-green-600 mt-2">
                      Current email: {mailSlurpConfig.mailslurpEmail}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">
                    How it works
                  </h4>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>
                      • Your unique MailSlurp inbox automatically receives
                      emails
                    </p>
                    <p>• The inbox ID is permanent and cannot be changed</p>
                    <p>• You can customize the email prefix anytime</p>
                    <p>
                      • Send meeting requests to your custom email for AI
                      processing
                    </p>
                  </div>
                </div>

                {mailSlurpConfig.status === 'not-setup' && (
                  <div className="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-200">
                    <h4 className="text-sm font-medium text-amber-800 mb-1">
                      Setup in Progress
                    </h4>
                    <p className="text-xs text-amber-700">
                      Your MailSlurp inbox is being created in the background.
                      This usually takes a few moments. Refresh the page if the
                      status doesn&apos;t update automatically.
                    </p>
                  </div>
                )}
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
