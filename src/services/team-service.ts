import { getDb } from './db.js';
import { Team, TeamMember } from '../types/index.js';

export async function createTeam(name: string, ownerId: number): Promise<Team> {
  const prisma = getDb();
  const data = await prisma.team.create({
    data: { name, owner_id: BigInt(ownerId) },
  });
  return data as unknown as Team;
}

export async function addMember(
  teamId: string,
  telegramId: number,
  username: string,
  role: string,
  skills: string[]
): Promise<TeamMember> {
  const prisma = getDb();
  const data = await prisma.teamMember.create({
    data: {
      team_id: teamId,
      telegram_id: BigInt(telegramId),
      username,
      role,
      skills,
    },
  });
  return data as unknown as TeamMember;
}

export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const prisma = getDb();
  const data = await prisma.teamMember.findMany({
    where: { team_id: teamId },
    orderBy: { created_at: 'asc' },
  });
  return data as unknown as TeamMember[];
}

export async function getMemberByTelegramId(telegramId: number): Promise<TeamMember | null> {
  const prisma = getDb();
  const data = await prisma.teamMember.findUnique({
    where: { telegram_id: BigInt(telegramId) },
  });
  return data as unknown as TeamMember | null;
}

export async function updateMemberRole(telegramId: number, role: string): Promise<void> {
  const prisma = getDb();
  await prisma.teamMember.update({
    where: { telegram_id: BigInt(telegramId) },
    data: { role },
  });
}

export async function getOwnerId(): Promise<number> {
  return Number(process.env.OWNER_TELEGRAM_ID);
}
