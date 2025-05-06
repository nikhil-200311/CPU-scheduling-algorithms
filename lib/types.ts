export interface Process {
  id: number
  name: string
  arrivalTime: number
  burstTime: number
  priority: number
  completionTime?: number
  turnaroundTime?: number
  waitingTime?: number
  responseTime?: number
  remainingTime?: number
  startTime?: number
}

export interface TimelineEvent {
  processName: string
  startTime: number
  endTime: number
}

export interface SchedulingResult {
  processes: Process[]
  timeline: TimelineEvent[]
  averageWaitingTime: number
  averageTurnaroundTime: number
  averageResponseTime: number
}
