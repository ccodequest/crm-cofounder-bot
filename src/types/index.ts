export interface Team {
  id: string;
  name: string;
  owner_id: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  telegram_id: number;
  username: string | null;
  nickname: string | null;
  role: string;
  skills: string[];
  workload_capacity: number;
  created_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReportStatus = 'pending_review' | 'approved' | 'revision_required';

export interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskReport {
  id: string;
  task_id: string;
  reporter_id: string;
  content: string;
  metrics: Record<string, any>;
  status: ReportStatus;
  reviewer_notes: string | null;
  cofounder_analysis: Record<string, any>;
  created_at: string;
}

export interface Lead {
  id: string;
  team_id: string;
  company_name: string | null;
  domain: string | null;
  contact_name: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  notes: string | null;
  score: number;
  enrichment_data: Record<string, any>;
  cofounder_take: string | null;
  assigned_to: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEnrichment {
  id: string;
  lead_id: string;
  tech_stack: string[];
  linkedin_data: Record<string, any>;
  news: Record<string, any>[];
  competitors: string[];
  decision_makers: Record<string, any>[];
  raw_research: string | null;
  researched_at: string;
}

export interface Pipeline {
  id: string;
  team_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  stage_order: number;
  color: string;
  sla_days: number | null;
  created_at: string;
}

export interface Followup {
  id: string;
  team_id: string;
  related_type: 'task' | 'lead';
  related_id: string;
  assignee_id: string | null;
  due_date: string;
  status: 'pending' | 'completed' | 'missed';
  cadence: string | null;
  notes: string | null;
  created_at: string;
}

export type Tone = 'brutal' | 'strict' | 'neutral' | 'gentle' | 'auto';

export interface PersonaProfile {
  id: string;
  team_id: string;
  telegram_id: number;
  tone: Tone;
  custom_prompt_override: string | null;
  set_by: number | null;
  created_at: string;
}

export interface SchemaVersion {
  id: string;
  table_name: string;
  schema_json: Record<string, any>;
  version: number;
  created_by: number | null;
  created_at: string;
  is_active: boolean;
}
