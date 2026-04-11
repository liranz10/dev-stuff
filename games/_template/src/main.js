import Phaser from 'phaser';
import LoadingScene from './scenes/LoadingScene.js';
import GameScene from './scenes/GameScene.js';
import WinScene from './scenes/WinScene.js';

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [LoadingScene, GameScene, WinScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3, // Multi-touch support
  },
};

export default new Phaser.Game(config);
