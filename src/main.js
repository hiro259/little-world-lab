import './style.css';
import { Game } from './game/Game.js';
import { WORLD_NAMES } from './world/World.js';

const container = document.querySelector('#game');
const worldSwitch = document.querySelector('#world-switch');
// The URL identifies the world so a refresh or shared link opens the same view.
const worldId = new URLSearchParams(window.location.search).get('world') === '02' ? '02' : '01';
const nextWorldId = worldId === '01' ? '02' : '01';
worldSwitch.querySelector('[data-world-number]').textContent = `WORLD ${worldId}`;
worldSwitch.querySelector('[data-world-name]').textContent = WORLD_NAMES[worldId];
worldSwitch.setAttribute('aria-label', `現在 WORLD ${worldId} ${WORLD_NAMES[worldId]}。クリックで WORLD ${nextWorldId} に切り替える`);
worldSwitch.addEventListener('click', () => {
  const nextUrl = new URL(window.location.href);
  if (nextWorldId === '01') nextUrl.searchParams.delete('world');
  else nextUrl.searchParams.set('world', nextWorldId);
  window.location.assign(nextUrl.toString());
});

try {
  const game = new Game(container, worldId);
  game.start();
} catch (error) {
  console.error('Little World Lab failed to start:', error);
  container.innerHTML = '';
  const notice = document.createElement('div');
  notice.className = 'startup-error';
  notice.setAttribute('role', 'alert');
  const heading = document.createElement('strong');
  heading.textContent = '3Dワールドを起動できませんでした';
  const description = document.createElement('p');
  description.textContent = 'WebGL対応ブラウザで再読み込みしてください。';
  notice.append(heading, description);
  container.append(notice);
}
