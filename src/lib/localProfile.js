const STATS_KEY = 'hunterzone_profile_stats';
const WIN_GAMES_KEY = 'hunterzone_winning_games';
const CAUGHT_MICE_KEY = 'hunterzone_caught_mice';

export function getLocalProfileStats() {
  if (typeof window === 'undefined') return { wins: 0, miceCaught: 0 };

  try {
    return { wins: 0, miceCaught: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch {
    return { wins: 0, miceCaught: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordLocalWin(gameId) {
  const wonGames = JSON.parse(localStorage.getItem(WIN_GAMES_KEY) || '[]');
  if (wonGames.includes(gameId)) return;

  const stats = getLocalProfileStats();
  saveStats({ ...stats, wins: stats.wins + 1 });
  localStorage.setItem(WIN_GAMES_KEY, JSON.stringify([...wonGames, gameId]));
}

export function recordCaughtMouse(mouseId) {
  const caughtMice = JSON.parse(localStorage.getItem(CAUGHT_MICE_KEY) || '[]');
  if (caughtMice.includes(mouseId)) return;

  const stats = getLocalProfileStats();
  saveStats({ ...stats, miceCaught: stats.miceCaught + 1 });
  localStorage.setItem(CAUGHT_MICE_KEY, JSON.stringify([...caughtMice, mouseId]));
}