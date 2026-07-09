import { getDb } from './db.js';
import { Lead } from '../types/index.js';

export async function createLead(params: {
  teamId: string;
  companyName?: string;
  domain?: string;
  contactName?: string;
  contactRole?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  assignedTo?: string;
  pipelineId?: string;
  stageId?: string;
}): Promise<Lead> {
  const prisma = getDb();
  const data = await prisma.lead.create({
    data: {
      team_id: params.teamId,
      company_name: params.companyName || null,
      domain: params.domain || null,
      contact_name: params.contactName || null,
      contact_role: params.contactRole || null,
      email: params.email || null,
      phone: params.phone || null,
      source: params.source || 'manual',
      notes: params.notes || null,
      assigned_to: params.assignedTo || null,
      pipeline_id: params.pipelineId || null,
      stage_id: params.stageId || null,
    },
  });
  return data as unknown as Lead;
}

export async function getLeads(teamId: string): Promise<Lead[]> {
  const prisma = getDb();
  const data = await prisma.lead.findMany({
    where: { team_id: teamId },
    orderBy: { created_at: 'desc' },
  });
  return data as unknown as Lead[];
}

export async function updateLeadStage(leadId: string, stageId: string): Promise<void> {
  const prisma = getDb();
  await prisma.lead.update({
    where: { id: leadId },
    data: { stage_id: stageId, updated_at: new Date() },
  });
}

export async function assignLead(leadId: string, memberId: string): Promise<void> {
  const prisma = getDb();
  await prisma.lead.update({
    where: { id: leadId },
    data: { assigned_to: memberId, updated_at: new Date() },
  });
}

export async function saveEnrichment(leadId: string, enrichment: Record<string, any>): Promise<void> {
  const prisma = getDb();
  await prisma.leadEnrichment.create({
    data: {
      lead_id: leadId,
      ...enrichment,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichment_data: enrichment, updated_at: new Date() },
  });
}

export async function logLeadActivity(leadId: string, type: string, content: string, userId: number): Promise<void> {
  const prisma = getDb();
  await prisma.leadActivity.create({
    data: {
      lead_id: leadId,
      type,
      content,
      user_id: BigInt(userId),
    },
  });
}
