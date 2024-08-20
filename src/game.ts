import { getTime, element } from './core';

const progressKey = 'mazeProgress';
const scoresKey = 'timeScore';

class GameManager {
  level = 1;
  completed = false;
  private savedLevel = 1;
  deaths = 0;
  timeScore = this.loadScores();
  private levelCount = 1;
  private levelValue = element('level-value');
  private attemptsValue = element('attempts-value');
  private bestValue = element('best-value');
  private timeValue = element('time-value');
  timeStart = getTime();

  loadScores(): Record<number, number> {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(scoresKey) || '{}');
      if (!saved || typeof saved !== 'object') return {};
      return Object.fromEntries(Object.entries(saved).filter(([, value]) =>
        typeof value === 'number' && Number.isFinite(value) && value > 0));
    } catch (error) {
      console.warn('Saved scores could not be read; starting with empty scores.', error);
      return {};
    }
  }

  restoreProgress(levelCount: number) {
    this.levelCount = levelCount;
    try {
      const raw = localStorage.getItem(progressKey);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (Number.isInteger(saved?.level) && saved.level >= 1 && saved.level <= levelCount) {
          this.level = saved.level;
          this.completed = saved.completed === true && saved.level === levelCount;
          if (saved.completed === true && saved.level < levelCount) this.level++;
        }
      } else {
        // Older saves only stored best times. Resume after the last consecutive win.
        while (this.level < levelCount && this.timeScore[this.level]) this.level++;
        this.completed = this.level === levelCount && Boolean(this.timeScore[this.level]);
      }
    } catch (error) {
      console.warn('Saved maze progress could not be read.', error);
    }
    this.savedLevel = this.level;
  }

  saveWin(levelCount: number) {
    this.updateGameScore();
    this.savedLevel = Math.max(this.savedLevel, Math.min(this.level + 1, levelCount));
    this.completed ||= this.level === levelCount;
    try {
      localStorage.setItem(progressKey, JSON.stringify({ level: this.savedLevel, completed: this.completed }));
    } catch (error) {
      console.warn('Could not save maze progress.', error);
    }
  }

  resetToFirstLevel() {
    localStorage.setItem(progressKey, JSON.stringify({ level: 1, completed: false }));
  }

  private updateGameScore() {
    const elapsed = getTime() - this.timeStart;
    const best = this.timeScore[this.level];
    if (best && elapsed >= best) return;

    this.timeScore[this.level] = elapsed;
    try {
      localStorage.setItem(scoresKey, JSON.stringify(this.timeScore));
    } catch (error) {
      console.warn('Could not save scores.', error);
    }
  }

  updateGameInfo() {
    const score = this.timeScore[this.level];
    const elapsed = getTime() - this.timeStart;
    const level = `${this.level} / ${this.levelCount}`;
    const attempts = String(this.deaths);
    const best = score ? `${score.toFixed(3)} s` : '—';
    if (this.levelValue.textContent !== level) this.levelValue.textContent = level;
    if (this.attemptsValue.textContent !== attempts) this.attemptsValue.textContent = attempts;
    if (this.bestValue.textContent !== best) this.bestValue.textContent = best;
    this.timeValue.textContent = `${elapsed.toFixed(3)} s`;
  }
}

export const Game = new GameManager();
