import './style.css';
import { Game } from './game/Game.js';

const container = document.querySelector('#game');

try {
  const game = new Game(container);
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
