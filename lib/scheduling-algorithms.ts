import type { Process, SchedulingResult, TimelineEvent } from "./types"

// Helper function to calculate metrics
function calculateMetrics(processes: Process[], timeline: TimelineEvent[]): SchedulingResult {
  let totalWaitingTime = 0
  let totalTurnaroundTime = 0
  let totalResponseTime = 0

  // Calculate completion time for each process
  processes.forEach((process) => {
    const lastEvent = [...timeline].reverse().find((event) => event.processName === process.name)

    if (lastEvent) {
      process.completionTime = lastEvent.endTime
      process.turnaroundTime = process.completionTime - process.arrivalTime
      process.waitingTime = process.turnaroundTime - process.burstTime

      // Find first time the process started executing
      const firstEvent = timeline.find((event) => event.processName === process.name)
      process.responseTime = firstEvent ? firstEvent.startTime - process.arrivalTime : 0

      totalWaitingTime += process.waitingTime
      totalTurnaroundTime += process.turnaroundTime
      totalResponseTime += process.responseTime
    }
  })

  return {
    processes,
    timeline,
    averageWaitingTime: totalWaitingTime / processes.length,
    averageTurnaroundTime: totalTurnaroundTime / processes.length,
    averageResponseTime: totalResponseTime / processes.length,
  }
}

// First Come First Serve (FCFS)
export function runFCFS(processes: Process[]): SchedulingResult {
  // Sort processes by arrival time
  processes.sort((a, b) => a.arrivalTime - b.arrivalTime)

  const timeline: TimelineEvent[] = []
  let currentTime = 0

  processes.forEach((process) => {
    // If there's a gap between the last process and the current one
    if (process.arrivalTime > currentTime) {
      timeline.push({
        processName: "idle",
        startTime: currentTime,
        endTime: process.arrivalTime,
      })
      currentTime = process.arrivalTime
    }

    // Add the process to the timeline
    timeline.push({
      processName: process.name,
      startTime: currentTime,
      endTime: currentTime + process.burstTime,
    })

    process.startTime = currentTime
    currentTime += process.burstTime
  })

  return calculateMetrics(processes, timeline)
}

// Round Robin (RR)
export function runRoundRobin(processes: Process[], timeQuantum: number): SchedulingResult {
  // Create a deep copy of processes to track remaining time
  const processQueue: Process[] = processes.map((p) => ({
    ...p,
    remainingTime: p.burstTime,
    startTime: undefined,
  }))

  // Sort by arrival time initially
  processQueue.sort((a, b) => a.arrivalTime - b.arrivalTime)

  const timeline: TimelineEvent[] = []
  let currentTime = 0
  let readyQueue: Process[] = []
  const completedProcesses: Process[] = []

  while (processQueue.length > 0 || readyQueue.length > 0) {
    // Add newly arrived processes to the ready queue
    const newArrivals = processQueue.filter((p) => p.arrivalTime <= currentTime)
    readyQueue = [...readyQueue, ...newArrivals]
    processQueue.splice(0, newArrivals.length)

    if (readyQueue.length === 0) {
      // If no process is ready, add idle time
      const nextArrival = processQueue[0]
      timeline.push({
        processName: "idle",
        startTime: currentTime,
        endTime: nextArrival.arrivalTime,
      })
      currentTime = nextArrival.arrivalTime
      continue
    }

    // Get the next process
    const currentProcess = readyQueue.shift()!

    // If this is the first time the process is running, record its start time
    if (currentProcess.startTime === undefined) {
      currentProcess.startTime = currentTime
    }

    // Calculate how long this process will run
    const executeTime = Math.min(timeQuantum, currentProcess.remainingTime!)

    // Add to timeline
    timeline.push({
      processName: currentProcess.name,
      startTime: currentTime,
      endTime: currentTime + executeTime,
    })

    // Update remaining time and current time
    currentProcess.remainingTime! -= executeTime
    currentTime += executeTime

    // Check if process is complete
    if (currentProcess.remainingTime! <= 0) {
      completedProcesses.push(currentProcess)
    } else {
      // Add newly arrived processes before re-adding the current process
      const newArrivals = processQueue.filter((p) => p.arrivalTime <= currentTime)
      readyQueue = [...readyQueue, ...newArrivals, currentProcess]
      processQueue.splice(0, newArrivals.length)
    }
  }

  return calculateMetrics(processes, timeline)
}

// Shortest Process Next (SPN)
export function runSPN(processes: Process[]): SchedulingResult {
  // Create a deep copy of processes
  const remainingProcesses = processes.map((p) => ({ ...p }))

  const timeline: TimelineEvent[] = []
  let currentTime = 0
  const completedProcesses: Process[] = []

  while (remainingProcesses.length > 0) {
    // Find processes that have arrived by the current time
    const availableProcesses = remainingProcesses.filter((p) => p.arrivalTime <= currentTime)

    if (availableProcesses.length === 0) {
      // If no process is available, add idle time
      const nextArrival = remainingProcesses.reduce(
        (min, p) => (p.arrivalTime < min.arrivalTime ? p : min),
        remainingProcesses[0],
      )

      timeline.push({
        processName: "idle",
        startTime: currentTime,
        endTime: nextArrival.arrivalTime,
      })

      currentTime = nextArrival.arrivalTime
      continue
    }

    // Find the process with the shortest burst time
    const shortestProcess = availableProcesses.reduce(
      (min, p) => (p.burstTime < min.burstTime ? p : min),
      availableProcesses[0],
    )

    // Add to timeline
    timeline.push({
      processName: shortestProcess.name,
      startTime: currentTime,
      endTime: currentTime + shortestProcess.burstTime,
    })

    shortestProcess.startTime = currentTime
    currentTime += shortestProcess.burstTime

    // Remove the process from remaining processes
    const index = remainingProcesses.findIndex((p) => p.id === shortestProcess.id)
    remainingProcesses.splice(index, 1)
    completedProcesses.push(shortestProcess)
  }

  return calculateMetrics(processes, timeline)
}

// Shortest Remaining Time (SRT)
export function runSRT(processes: Process[]): SchedulingResult {
  // Create a deep copy of processes to track remaining time
  const remainingProcesses = processes.map((p) => ({
    ...p,
    remainingTime: p.burstTime,
    startTime: undefined,
  }))

  const timeline: TimelineEvent[] = []
  let currentTime = 0
  const completedProcesses: Process[] = []
  let currentProcess: Process | null = null
  let lastProcessName: string | null = null

  while (remainingProcesses.length > 0) {
    // Find processes that have arrived by the current time
    const availableProcesses = remainingProcesses.filter((p) => p.arrivalTime <= currentTime)

    if (availableProcesses.length === 0) {
      // If no process is available, add idle time
      const nextArrival = remainingProcesses.reduce(
        (min, p) => (p.arrivalTime < min.arrivalTime ? p : min),
        remainingProcesses[0],
      )

      timeline.push({
        processName: "idle",
        startTime: currentTime,
        endTime: nextArrival.arrivalTime,
      })

      currentTime = nextArrival.arrivalTime
      continue
    }

    // Find the process with the shortest remaining time
    currentProcess = availableProcesses.reduce(
      (min, p) => (p.remainingTime! < min.remainingTime! ? p : min),
      availableProcesses[0],
    )

    // Find the next arrival time or process completion time
    const nextEventTime = remainingProcesses
      .filter((p) => p.arrivalTime > currentTime)
      .reduce((min, p) => (p.arrivalTime < min ? p.arrivalTime : min), currentTime + currentProcess.remainingTime!)

    const executeTime = Math.min(currentProcess.remainingTime!, nextEventTime - currentTime)

    // If the process changes, add a new timeline event
    if (lastProcessName !== currentProcess.name) {
      timeline.push({
        processName: currentProcess.name,
        startTime: currentTime,
        endTime: currentTime + executeTime,
      })

      // If this is the first time the process is running, record its start time
      if (currentProcess.startTime === undefined) {
        currentProcess.startTime = currentTime
      }

      lastProcessName = currentProcess.name
    } else {
      // Extend the last timeline event
      const lastEvent = timeline[timeline.length - 1]
      lastEvent.endTime = currentTime + executeTime
    }

    // Update remaining time and current time
    currentProcess.remainingTime! -= executeTime
    currentTime += executeTime

    // Check if process is complete
    if (currentProcess.remainingTime! <= 0) {
      const index = remainingProcesses.findIndex((p) => p.id === currentProcess!.id)
      remainingProcesses.splice(index, 1)
      completedProcesses.push(currentProcess)
      lastProcessName = null // Reset last process name
    }
  }

  return calculateMetrics(processes, timeline)
}

// Highest Response Ratio Next (HRRN)
export function runHRRN(processes: Process[]): SchedulingResult {
  // Create a deep copy of processes
  const remainingProcesses = processes.map((p) => ({ ...p }))

  const timeline: TimelineEvent[] = []
  let currentTime = 0
  const completedProcesses: Process[] = []

  while (remainingProcesses.length > 0) {
    // Find processes that have arrived by the current time
    const availableProcesses = remainingProcesses.filter((p) => p.arrivalTime <= currentTime)

    if (availableProcesses.length === 0) {
      // If no process is available, add idle time
      const nextArrival = remainingProcesses.reduce(
        (min, p) => (p.arrivalTime < min.arrivalTime ? p : min),
        remainingProcesses[0],
      )

      timeline.push({
        processName: "idle",
        startTime: currentTime,
        endTime: nextArrival.arrivalTime,
      })

      currentTime = nextArrival.arrivalTime
      continue
    }

    // Calculate response ratio for each available process
    availableProcesses.forEach((process) => {
      const waitingTime = currentTime - process.arrivalTime
      process.responseRatio = (waitingTime + process.burstTime) / process.burstTime
    })

    // Find the process with the highest response ratio
    const highestRRProcess = availableProcesses.reduce(
      (max, p) => (p.responseRatio! > max.responseRatio! ? p : max),
      availableProcesses[0],
    )

    // Add to timeline
    timeline.push({
      processName: highestRRProcess.name,
      startTime: currentTime,
      endTime: currentTime + highestRRProcess.burstTime,
    })

    highestRRProcess.startTime = currentTime
    currentTime += highestRRProcess.burstTime

    // Remove the process from remaining processes
    const index = remainingProcesses.findIndex((p) => p.id === highestRRProcess.id)
    remainingProcesses.splice(index, 1)
    completedProcesses.push(highestRRProcess)
  }

  return calculateMetrics(processes, timeline)
}
