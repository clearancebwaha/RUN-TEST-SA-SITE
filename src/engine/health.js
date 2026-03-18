/* ============================================================
   POCKET APP — Health Debt Detection
   Flags patterns of high-cost, low-nutrition food spending
   ============================================================ */

import { todayISO, localISO } from '../utils/format.js';

export function checkHealthDebt(state) {
  const today = todayISO();
  const threeDaysAgo = new Date(today + 'T00:00:00');
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const cutoff = localISO(threeDaysAgo);

  const recent = state.nutritionLog.filter(n => n.date >= cutoff);
  if (recent.length < 3) return null;

  const avgScore = recent.reduce((s, n) => s + n.score, 0) / recent.length;
  const avgCost = recent.reduce((s, n) => s + n.cost, 0) / recent.length;

  if (avgScore <= 2 && avgCost > 3000) { // avg ≤2 score, avg >₱30 cost
    return {
      avgScore: avgScore.toFixed(1),
      avgCost: Math.round(avgCost),
      meals: recent.length,
    };
  }
  return null;
}
