
export function isValidId(id: string): boolean {
  if (!/^\d+$/.test(id)) return false;
  return Number(id) > 0;
}

export function isEmptyBody(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 0;
}
