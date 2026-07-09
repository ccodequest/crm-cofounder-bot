import { getDb } from './db.js';
import { Pipeline, PipelineStage } from '../types/index.js';

export async function createPipeline(teamId: string, name: string, isDefault?: boolean): Promise<Pipeline> {
  const prisma = getDb();
  const data = await prisma.pipeline.create({
    data: { team_id: teamId, name, is_default: isDefault || false },
  });
  return data as unknown as Pipeline;
}

export async function addStage(params: {
  pipelineId: string;
  name: string;
  order: number;
  color?: string;
  slaDays?: number;
}): Promise<PipelineStage> {
  const prisma = getDb();
  const data = await prisma.pipelineStage.create({
    data: {
      pipeline_id: params.pipelineId,
      name: params.name,
      stage_order: params.order,
      color: params.color || '#808080',
      sla_days: params.slaDays || null,
    },
  });
  return data as unknown as PipelineStage;
}

export async function getPipelines(teamId: string): Promise<any[]> {
  const prisma = getDb();
  const data = await prisma.pipeline.findMany({
    where: { team_id: teamId },
    include: { stages: { orderBy: { stage_order: 'asc' } } },
    orderBy: { created_at: 'asc' },
  });
  return data;
}

export async function getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
  const prisma = getDb();
  const data = await prisma.pipelineStage.findMany({
    where: { pipeline_id: pipelineId },
    orderBy: { stage_order: 'asc' },
  });
  return data as unknown as PipelineStage[];
}
