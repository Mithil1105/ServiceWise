/**
 * Cache organization (logo, company name) by user email for the login page
 * so we can show the right logo before the user is authenticated.
 */

import type { Organization } from '@/types';

const CACHE_KEY = 'traveltrak_org_cache';
const RECENT_KEY = 'traveltrak_org_recent';

interface CachedOrg {
  org: Organization;
  email: string;
  at: number;
}

function getCache(): Record<string, CachedOrg> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CachedOrg>;
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, CachedOrg>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/** Get cached org for an email (e.g. when user types email on login page). */
export function getCachedOrg(email: string): Organization | null {
  if (!email?.trim()) return null;
  const key = email.trim().toLowerCase();
  const entry = getCache()[key];
  if (!entry?.org) return null;
  // Optional: expire after 30 days
  if (Date.now() - entry.at > 30 * 24 * 60 * 60 * 1000) return null;
  return entry.org;
}

/** Get most recent org (when no email typed yet). */
export function getMostRecentOrg(): Organization | null {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedOrg;
    if (!entry?.org) return null;
    if (Date.now() - entry.at > 30 * 24 * 60 * 60 * 1000) return null;
    return entry.org;
  } catch {
    return null;
  }
}

/** Store org for an email (call after successful login when we have org). */
export function setCachedOrg(email: string, org: Organization): void {
  if (!email?.trim() || !org) return;
  const key = email.trim().toLowerCase();
  const cache = getCache();
  cache[key] = { org, email: key, at: Date.now() };
  setCache(cache);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify({ org, email: key, at: Date.now() }));
  } catch {
    // ignore
  }
}
