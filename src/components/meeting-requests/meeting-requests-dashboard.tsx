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
import { toast } from 'sonner';
import {
  RefreshCw,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Brain,
  Plus,
} from 'lucide-react';
import { MeetingRequest, MeetingRequestStatus } from '@/types/meeting-request';
// Utility function to format time distance without external dependency
const formatDistanceToNow = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return 'just now';
};

interface MeetingRequestsStats {
  total: number;
  byStatus: Record<MeetingRequestStatus, number>;
  recentActivity: number;
}

const statusConfig: Record<
  MeetingRequestStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  context_collection: {
    label: 'Collecting Info',
    variant: 'outline',
    icon: MessageSquare,
    color: 'text-blue-500',
  },
  pending_reply: {
    label: 'Pending Reply',
    variant: 'secondary',
    icon: Clock,
    color: 'text-orange-500',
  },
  scheduled: {
    label: 'Scheduled',
    variant: 'default',
    icon: Calendar,
    color: 'text-green-500',
  },
  rescheduled: {
    label: 'Rescheduled',
    variant: 'secondary',
    icon: RefreshCw,
    color: 'text-yellow-500',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: CheckCircle,
    color: 'text-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: XCircle,
    color: 'text-red-500',
  },
};

export function MeetingRequestsDashboard() {
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [stats, setStats] = useState<MeetingRequestsStats>({
    total: 0,
    byStatus: {
      context_collection: 0,
      pending_reply: 0,
      scheduled: 0,
      rescheduled: 0,
      completed: 0,
      cancelled: 0,
    },
    recentActivity: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    MeetingRequestStatus | 'all'
  >('all');

  useEffect(() => {
    fetchMeetingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMeetingRequests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/meeting-requests');

      if (response.ok) {
        const data = await response.json();
        setMeetingRequests(data.meetingRequests || []);
        calculateStats(data.meetingRequests || []);
      } else {
        toast.error('Failed to fetch meeting requests');
      }
    } catch (error) {
      console.error('Error fetching meeting requests:', error);
      toast.error('Error fetching meeting requests');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (requests: MeetingRequest[]) => {
    const byStatus = requests.reduce(
      (acc, request) => {
        acc[request.status] = (acc[request.status] || 0) + 1;
        return acc;
      },
      {} as Record<MeetingRequestStatus, number>
    );

    // Fill in missing statuses with 0
    Object.keys(statusConfig).forEach((status) => {
      if (!(status in byStatus)) {
        byStatus[status as MeetingRequestStatus] = 0;
      }
    });

    const now = Date.now();
    const recentActivity = requests.filter((request) => {
      const updatedAt = new Date(request.updatedAt).getTime();
      return now - updatedAt < 24 * 60 * 60 * 1000; // Last 24 hours
    }).length;

    setStats({
      total: requests.length,
      byStatus: byStatus as Record<MeetingRequestStatus, number>,
      recentActivity,
    });
  };

  const processWithAI = async (meetingRequestId: string) => {
    try {
      const response = await fetch('/api/meeting-requests/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingRequestId }),
      });

      if (response.ok) {
        toast.success('Meeting request processed with AI');
        fetchMeetingRequests();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to process meeting request');
      }
    } catch (error) {
      console.error('Error processing meeting request:', error);
      toast.error('Error processing meeting request');
    }
  };

  const updateStatus = async (
    meetingRequestId: string,
    newStatus: MeetingRequestStatus
  ) => {
    try {
      const response = await fetch(
        `/api/meeting-requests/${meetingRequestId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        toast.success('Status updated successfully');
        fetchMeetingRequests();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error updating status');
    }
  };

  const filteredRequests =
    selectedStatus === 'all'
      ? meetingRequests
      : meetingRequests.filter((request) => request.status === selectedStatus);

  const formatParticipants = (participants: MeetingRequest['participants']) => {
    if (participants.length === 0) return 'No participants';
    if (participants.length === 1) return participants[0].email;
    return `${participants[0].email} +${participants.length - 1} more`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Meeting Requests
          </h1>
          <p className="text-muted-foreground">
            Track and manage your meeting scheduling lifecycle
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMeetingRequests}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Requests
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byStatus.context_collection + stats.byStatus.pending_reply}
            </div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byStatus.scheduled + stats.byStatus.rescheduled}
            </div>
            <p className="text-xs text-muted-foreground">Confirmed meetings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivity}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('all')}
            >
              All ({stats.total})
            </Button>
            {Object.entries(statusConfig).map(([status, config]) => (
              <Button
                key={status}
                variant={selectedStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setSelectedStatus(status as MeetingRequestStatus)
                }
              >
                <config.icon className="w-3 h-3 mr-1" />
                {config.label} ({stats.byStatus[status as MeetingRequestStatus]}
                )
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meeting Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Meeting Requests
            {selectedStatus !== 'all' && (
              <span className="text-muted-foreground ml-2">
                ({filteredRequests.length})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {selectedStatus === 'all'
              ? 'All your meeting requests across all stages'
              : `Requests with status: ${statusConfig[selectedStatus as MeetingRequestStatus]?.label}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading meeting requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No meeting requests found</p>
              {selectedStatus !== 'all' && (
                <p className="text-sm">
                  Try selecting a different status filter
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const statusInfo = statusConfig[request.status];
                const IconComponent = statusInfo.icon;

                return (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={statusInfo.variant}
                            className="flex items-center gap-1"
                          >
                            <IconComponent className="w-3 h-3" />
                            {statusInfo.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(request.updatedAt))}{' '}
                            ago
                          </span>
                        </div>

                        <div>
                          <h4 className="font-medium">
                            {request.context.summary}
                          </h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {formatParticipants(request.participants)}
                            </div>
                            {request.proposedTimes.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {request.proposedTimes.length} time
                                {request.proposedTimes.length !== 1 ? 's' : ''}{' '}
                                proposed
                              </div>
                            )}
                            {request.communications.length > 0 && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {request.communications.length} message
                                {request.communications.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {request.status === 'context_collection' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => processWithAI(request.id)}
                          >
                            <Brain className="w-3 h-3 mr-1" />
                            Process AI
                          </Button>
                        )}

                        {request.status !== 'completed' &&
                          request.status !== 'cancelled' && (
                            <div className="flex gap-1">
                              {request.status === 'context_collection' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateStatus(request.id, 'pending_reply')
                                  }
                                >
                                  Mark Pending
                                </Button>
                              )}
                              {(request.status === 'pending_reply' ||
                                request.status === 'context_collection') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateStatus(request.id, 'scheduled')
                                  }
                                >
                                  Mark Scheduled
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateStatus(request.id, 'cancelled')
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>

                    {request.metadata.urgency && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Urgency:
                        </span>
                        <Badge
                          variant={
                            request.metadata.urgency === 'high'
                              ? 'destructive'
                              : request.metadata.urgency === 'medium'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {request.metadata.urgency}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
