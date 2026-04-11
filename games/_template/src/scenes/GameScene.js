/**
 * GameScene — Replace this with the actual game logic.
 * This is a placeholder that shows a tap-to-win demo.
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // רקע — placeholder
    this.add.rectangle(cx, cy, width, height, 0x1a1a2e);

    // כיתוב placeholder — ה-Developer Agent יחליף את זה
    this.add
      .text(cx, cy - 60, '🎮', { fontSize: '80px' })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 20, 'לחץ כאן!', {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5);

    // כפתור גדול — מינימום 120x120px לגיל 5
    const btn = this.add
      .rectangle(cx, cy + 100, 200, 80, 0x6c63ff, 1)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, cy + 100, 'שחק!', {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5);

    btn.on('pointerdown', () => {
      this.scene.start('WinScene');
    });

    btn.on('pointerover', () => btn.setFillStyle(0x8b83ff));
    btn.on('pointerout', () => btn.setFillStyle(0x6c63ff));
  }
}
