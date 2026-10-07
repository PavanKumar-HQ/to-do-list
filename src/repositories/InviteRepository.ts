// Invite System Repository (Section 32-35)
// Privacy-first invite generation, expiry enforcement, and local attribution tracking.
// INVARIANT: Invite tokens contain NO personal data (name, email, tasks, expenses).

import { db, generateId, logAudit } from '../db/db';
import type { InviteItem } from '../types';

export class InviteRepository {
  public static generateCryptoToken(): string {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public static async createInvite(duration: '24 hours' | '7 days' | '30 days' = '7 days'): Promise<InviteItem> {
    const now = new Date();
    const expiresAt = new Date(now.getTime());

    if (duration === '24 hours') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else if (duration === '7 days') {
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else if (duration === '30 days') {
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    const token = this.generateCryptoToken();
    const id = generateId();

    const invite: InviteItem = {
      id,
      token,
      durationLabel: duration,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      attributionCount: 0
    };

    await db.invites.add(invite);
    await logAudit('create', 'invite', id, `Generated invite link (${duration} validity)`);

    return invite;
  }

  public static async validateToken(token: string): Promise<{ valid: boolean; reason?: string }> {
    const invite = await db.invites.filter(i => i.token === token).first();
    if (!invite) {
      return { valid: false, reason: 'Invite token not found.' };
    }

    const now = new Date().toISOString();
    if (invite.expiresAt < now) {
      return { valid: false, reason: 'Invite link has expired.' };
    }

    return { valid: true };
  }

  public static async recordAttribution(id: string): Promise<void> {
    const invite = await db.invites.get(id);
    if (invite) {
      await db.invites.update(id, { attributionCount: (invite.attributionCount || 0) + 1 });
    }
  }

  public static async queryAll(): Promise<InviteItem[]> {
    return db.invites.reverse().sortBy('createdAt');
  }

  public static async delete(id: string): Promise<void> {
    await db.invites.delete(id);
  }
}
