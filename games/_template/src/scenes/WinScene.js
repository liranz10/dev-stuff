/**
 * WinScene — Shown when the player wins.
 * Always positive, celebratory, with confetti and a replay button.
 */
export default class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // רקע חגיגי
    this.add.rectangle(cx, cy, width, height, 0x1a1a2e);

    // כוכבים נופלים (particles placeholder — ב-Phaser 3.60+)
    this.spawnConfetti();

    // הודעת ניצחון
    this.add
      .text(cx, cy - 80, '🌟', { fontSize: '100px' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: this.add
        .text(cx, cy - 80, '🌟', { fontSize: '100px' })
        .setOrigin(0.5),
      alpha: 1,
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 600,
      ease: 'Back.Out',
    });

    this.add
      .text(cx, cy + 20, 'כל הכבוד! 🎉', {
        fontSize: '36px',
        color: '#FFD700',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // כפתור שחק שוב — מופיע אחרי שנייה
    this.time.delayedCall(1200, () => {
      const replayBtn = this.add
        .rectangle(cx, cy + 160, 220, 80, 0x6c63ff)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(cx, cy + 160, '🔄 שוב!', {
          fontSize: '28px',
          color: '#ffffff',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5);

      replayBtn.on('pointerdown', () => {
        this.scene.start('GameScene');
      });

      // Bounce animation on button
      this.tweens.add({
        targets: replayBtn,
        scaleX: { from: 0.8, to: 1 },
        scaleY: { from: 0.8, to: 1 },
        duration: 400,
        ease: 'Back.Out',
      });
    });
  }

  spawnConfetti() {
    const colors = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff6bcb];
    const { width } = this.scale;

    // יצירת 30 חתיכות קונפטי
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const color = colors[Phaser.Math.Between(0, colors.length - 1)];
      const rect = this.add.rectangle(
        x,
        Phaser.Math.Between(-50, -10),
        Phaser.Math.Between(8, 16),
        Phaser.Math.Between(8, 16),
        color
      );

      this.tweens.add({
        targets: rect,
        y: this.scale.height + 50,
        x: x + Phaser.Math.Between(-60, 60),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(1500, 3000),
        delay: Phaser.Math.Between(0, 1000),
        ease: 'Linear',
        onComplete: () => rect.destroy(),
      });
    }
  }
}
