export function getNaturalistTitle(level: number): string {
  if (level <= 1) return "Novice Observer";
  if (level === 2) return "Curious Forager";
  if (level === 3) return "Wilderness Scout";
  if (level === 4) return "Naturalist";
  if (level === 5) return "Botanical Scholar";
  return "Ecology Master";
}

export function calculateUserProgression(userXp?: number, discoveryCount: number = 0) {
  // If user has explicit XP, use it; otherwise compute 50 XP per logged discovery
  const totalXp = typeof userXp === "number" ? userXp : discoveryCount * 50;
  
  const xpPerLevel = 100;
  const level = Math.max(1, Math.floor(totalXp / xpPerLevel) + 1);
  const currentLevelXp = totalXp % xpPerLevel;
  const nextLevelXp = xpPerLevel;
  const neededXp = nextLevelXp - currentLevelXp;
  const rankTitle = getNaturalistTitle(level);

  return {
    totalXp,
    level,
    currentLevelXp,
    nextLevelXp,
    neededXp,
    rankTitle,
  };
}
