import { getDb } from './db.js';
import { PersonaProfile, Tone } from '../types/index.js';

export async function setPersonaTone(
  teamId: string,
  telegramId: number,
  tone: Tone,
  setBy: number
): Promise<void> {
  const prisma = getDb();
  await prisma.personaProfile.upsert({
    where: {
      team_id_telegram_id: { team_id: teamId, telegram_id: BigInt(telegramId) },
    },
    update: { tone, set_by: BigInt(setBy), updated_at: new Date() },
    create: {
      team_id: teamId,
      telegram_id: BigInt(telegramId),
      tone,
      set_by: BigInt(setBy),
    },
  });
}

export async function getPersona(telegramId: number): Promise<PersonaProfile | null> {
  const prisma = getDb();
  const data = await prisma.personaProfile.findFirst({
    where: { telegram_id: BigInt(telegramId) },
  });
  return data as unknown as PersonaProfile | null;
}

export async function listPersonas(teamId: string): Promise<any[]> {
  const prisma = getDb();
  const data = await prisma.personaProfile.findMany({
    where: { team_id: teamId },
    include: { team: { include: { team_members: true } } },
  });
  return data;
}
