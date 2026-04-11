export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Loading bar background
    const barBg = this.add.rectangle(cx, cy, 300, 20, 0x333366);
    const bar = this.add.rectangle(cx - 150, cy, 0, 16, 0x6c63ff);
    bar.setOrigin(0, 0.5);

    this.load.on('progress', (value) => {
      bar.width = 300 * value;
    });

    // TODO: Add game assets here
    // Example:
    // this.load.image('bg', 'assets/bg.png');
    // this.load.image('character', 'assets/character.png');
    // this.load.audio('win', 'assets/win.mp3');
  }

  create() {
    this.scene.start('GameScene');
  }
}
