export function minutesFromSeconds(value: number) {
  return Math.max(1, Math.round(value / 60));
}

export function secondsFromMinutes(value: number, fallbackMinutes: number) {
  return Math.max(1, Number(value) || fallbackMinutes) * 60;
}
