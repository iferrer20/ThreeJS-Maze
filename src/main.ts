import { element } from './core';
import { GameMap } from './levels';
import { GamePlayer } from './entities';
import { Camera } from './camera';
import { Input } from './input';
import { Render } from './renderer';
import { Game } from './game';

function start() {
  const controls = element('controls');
  const help = element('info-hvr');
  help.onmouseenter = () => controls.classList.remove('hidden');
  help.onmouseleave = () => controls.classList.add('hidden');
  element('reset-progress').onclick = () => {
    if (!window.confirm('¿Volver al nivel 1? Se conservarán tus mejores tiempos.')) return;
    try {
      Game.resetToFirstLevel();
    } catch (error) {
      console.warn('Could not reset maze progress.', error);
      window.alert('El navegador no permitió reiniciar el progreso.');
      return;
    }
    window.location.reload();
  };

  Game.restoreProgress(GameMap.maps.length);
  if (Game.completed) {
    element('glcanvas').remove();
    element('game-info').classList.add('hidden');
    element('no-levels').classList.remove('hidden');
    return;
  }

  GamePlayer.init();
  GamePlayer.reset(GameMap.load());
  Render.addObject(GameMap);
  Render.addObject(GamePlayer);
  Camera.init();
  Render.addUpdate(() => Camera.updateBoardTilt());
  Render.addUpdate(() => GamePlayer.update());
  Render.addUpdate(() => Camera.updateView(GamePlayer.model));
  Input.init({
    ...(import.meta.env.DEV ? {
      KeyL: () => { Render.wireframe = !Render.wireframe; },
      KeyC: () => { Render.showCollisions = !Render.showCollisions; },
      KeyN: () => GamePlayer.advanceLevel(),
      KeyP: () => GamePlayer.previousLevel(),
    } : {}),
    KeyF: () => Camera.toggleFreeCamera(),
    KeyV: () => Camera.toggleFollowCamera(),
    KeyR: () => Camera.resetZoom(),
  });
  Render.init();
}

try {
  start();
} catch (error) {
  console.error('No se pudo iniciar el laberinto.', error);
  const notice = element('no-webgl');
  notice.textContent = 'No se pudo iniciar el laberinto.';
  notice.classList.remove('hidden');
}
