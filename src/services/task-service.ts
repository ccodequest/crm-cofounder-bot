import { getDb } from './db.js';
import { Task, TaskReport } from '../types/index.js';

export async function createTask(params: {
  teamId: string;
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  assigneeId: string;
  creatorId: string;
}): Promise<Task> {
  const prisma = getDb();
  const data = await prisma.task.create({
    data: {
      team_id: params.teamId,
      title: params.title,
      description: params.description || null,
      priority: params.priority || 'medium',
      due_date: params.dueDate ? new Date(params.dueDate) : null,
      assignee_id: params.assigneeId,
      creator_id: params.creatorId,
    },
  });
  return data as unknown as Task;
}

export async function getTasksForMember(memberId: string, status?: string): Promise<Task[]> {
  const prisma = getDb();
  const where: any = { assignee_id: memberId };
  if (status) where.status = status;
  const data = await prisma.task.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return data as unknown as Task[];
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const prisma = getDb();
  await prisma.task.update({
    where: { id: taskId },
    data: { status, updated_at: new Date() },
  });
}

export async function submitReport(params: {
  taskId: string;
  reporterId: string;
  content: string;
  metrics?: Record<string, any>;
}): Promise<TaskReport> {
  const prisma = getDb();
  const data = await prisma.taskReport.create({
    data: {
      task_id: params.taskId,
      reporter_id: params.reporterId,
      content: params.content,
      metrics: params.metrics || {},
    },
  });

  await prisma.task.update({
    where: { id: params.taskId },
    data: { status: 'completed', updated_at: new Date() },
  });

  return data as unknown as TaskReport;
}

export async function getPendingReports(teamId: string): Promise<any[]> {
  const prisma = getDb();
  const data = await prisma.taskReport.findMany({
    where: {
      status: 'pending_review',
      task: { team_id: teamId },
    },
    include: { task: true },
    orderBy: { created_at: 'asc' },
  });
  return data;
}

export async function getOverdueTasks(teamId: string): Promise<any[]> {
  const prisma = getDb();
  const data = await prisma.task.findMany({
    where: {
      team_id: teamId,
      status: { in: ['pending', 'in_progress'] },
      due_date: { lt: new Date() },
    },
    include: { assignee: true },
    orderBy: { due_date: 'asc' },
  });
  return data;
}

export async function scheduleFollowup(params: {
  teamId: string;
  relatedType: 'task' | 'lead';
  relatedId: string;
  assigneeId: string;
  dueDate: string;
  cadence?: string;
  notes?: string;
}): Promise<void> {
  const prisma = getDb();
  await prisma.followup.create({
    data: {
      team_id: params.teamId,
      related_type: params.relatedType,
      related_id: params.relatedId,
      assignee_id: params.assigneeId,
      due_date: new Date(params.dueDate),
      cadence: params.cadence || null,
      notes: params.notes || null,
    },
  });
}

export async function getPendingFollowups(): Promise<any[]> {
  const prisma = getDb();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const data = await prisma.followup.findMany({
    where: {
      status: 'pending',
      due_date: { lt: tomorrow },
    },
    include: { assignee: true },
    orderBy: { due_date: 'asc' },
  });
  return data;
}
