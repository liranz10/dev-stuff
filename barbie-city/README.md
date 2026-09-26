# Dream Doll City 👑

A cute 3D doll-in-the-city game made for a 5-year-old. She walks around a small pink town with her puppy **Coco**, meets friends, visits the shops, and drives her pink convertible.

**🎮 לשחק עכשיו:** https://doll-city.vercel.app (באייפד: Safari ← שיתוף ← הוספה למסך הבית)

**To play:** open `dist/index.html` in any modern browser (tablet, phone or computer). It's one self-contained file that also works offline, so you can copy it to an iPad or Android tablet and open it there.

## העלאה ל-Vercel והתקנה על האייפד

**חד-פעמי, ב-Vercel (חינם):**
1. נכנסים ל-https://vercel.com/new ומתחברים עם GitHub.
2. בוחרים את המאגר `dev-stuff` ולוחצים **Import**. אם הוא לא מופיע, לוחצים "Adjust GitHub App Permissions" ומאשרים גישה אליו.
3. ב-**Root Directory** לוחצים Edit ובוחרים `barbie-city`. את שאר ההגדרות ממלא הקובץ `vercel.json`.
4. לוחצים **Deploy**. אחרי דקה בערך מתקבלת כתובת, למשל `https://dev-stuff-xxxx.vercel.app`.
5. חשוב: המשחק נמצא בענף `claude/barbie-city-3d-game-2uj35v`, לא בענף הראשי של המאגר. ב-Vercel הולכים ל-**Settings ← Environments ← Production** ומגדירים את הענף הזה כ-Production Branch. אחר כך עושים **Redeploy**. (אם יש מסך התחברות בכתובת, זו הגנת התצוגה המקדימה של Vercel. אחרי שהענף מוגדר כ-Production הכתובת הראשית פתוחה.)

**על האייפד:**
1. פותחים את הכתובת ב-**Safari**.
2. לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה) ← **הוספה למסך הבית** ← **הוספה**.
3. מופיע אייקון "עיר הבובות" במסך הבית. המשחק נפתח במסך מלא, בלי שורת כתובת.
4. אחרי הפתיחה הראשונה המשחק עובד גם **בלי אינטרנט**. כשמעלים גרסה חדשה, היא נטענת אוטומטית בפעם הבאה שיש חיבור.

## משחק ביחד (חדר משפחתי) ותמונת פנים

- **שמות:** במסך הפתיחה בוחרים **יובל** או **עלמה** בכפתור גדול, או כותבים שם אחר.
- **🤳 הדמות עם הפנים שלך:** לוחצים "מצלמים את הפנים", שמים את הפנים בתוך העיגול ולוחצים על המצלמה (או בוחרים תמונה מהאלבום). התמונה מונחת על פני הדמות, וצבע העור מותאם אוטומטית. אפשר גם מבית החלומות.
- **👫 משחק ביחד:** לכל מכשיר יש **מספר חדר משפחתי** במסך הפתיחה. מי שכותב את אותו מספר רואה את השאר בעיר: שם מעל הראש, בגדים, פנים, כלבלב ומכונית. לוחצים על חבר כדי להגיד שלום. הכפתור 👫 מראה מי בחדר.
- **פרטיות:** רק מי שיודע את מספר החדר נכנס אליו. המיקום נמחק רבע דקה אחרי שיוצאים מהמשחק, ותמונת הפנים נמחקת אחרי 6 שעות. הנתונים נשמרים רק במסד הנתונים של הפרויקט שלך ב-Vercel.

**כדי שמשחק ביחד יעבוד צריך מסד נתונים קטן (חינם), פעם אחת:**
ב-Vercel ← הפרויקט `doll-city` ← **Storage** ← **Create Database** ← **Upstash for Redis** ← התוכנית החינמית ← לחבר לפרויקט `doll-city`. אחר כך **Redeploy**. בלי זה המשחק עובד רגיל, רק בלי חברים.

## What's in the town

| Place | What you do there |
|---|---|
| ☕ Sweet Café | Pick a drink (pink milkshake, hot chocolate, bubble tea, lemonade) and a treat; she walks out holding her cup |
| 🛒 Supermarket | Find the items from the picture shopping list, then pay at the checkout; she leaves with a shopping bag |
| 💇‍♀️ Hair Salon | Close-up on the doll: 10 hair colours, 6 styles (long, ponytail, buns, braids, bob, curls), tiara/bow/flower, bubble wash |
| 💅 Nail Spa | Paint each nail (incl. glitter and rainbow), add nail stickers; the colour shows on the doll's 3D nails |
| 👗 Boutique | Dress, ball gown, tutu or shorts in 10 colours, shoe colours, sunglasses, handbag, pearls, tiara, and a twirl button |
| 🍦 Ice Cream | Stack up to 3 scoops with sprinkles and a cherry; she walks around holding the cone |
| 🐶 Pet Shop | Close-up on Coco: fur colour, bow, sweater, give a treat, bubble bath |
| 🏠 Dream House | Good night 🌙 / Good morning ☀️ (day and night), plus a wardrobe and a mirror |
| 🛝 Playground | Swings, slide, seesaw and sandbox |
| 🚗 Pink convertible | Tap **Drive!** next to the car. Tap the road to drive there, or use the joystick or arrow keys. Coco rides in the passenger seat |

**Pick your doll:** on the start screen, choose from 4 dolls: blonde in pink, brunette in a tutu, curly hair in yellow, or red braids in a ball gown.

**Magic hearts 💖:** 8 glowing hearts are hidden around town (behind shops, in the garden, at the playground…). Finding all 8 gives the doll **fairy wings** 🧚.

**Rainbow rings 🌈:** when you drive the car, glowing rainbow rings appear on the road. Drive through them in order to finish a lap.

**Friends to meet:** Leo, Mia, Zoe, Lily (with her balloons), Grandma Rose, and Sam the barista. Walk up to one and they wave and say hello out loud. Tap them and you both dance.

**Stickers:** each place gives a sticker, plus stickers for the rings, the hearts and meeting every friend (13 in total). The ⭐ button opens the sticker book, with confetti when it's full.

## Made for little kids
- **No reading needed.** Everything has pictures, and the characters speak their lines out loud (voice on/off with 🗣️).
- **Tap to walk.** Tap the ground and she walks there. Tap a shop and she walks to the door and goes in. Tap the puppy and he barks and jumps. A big **Go in!** bubble appears at each door.
- **Nothing to lose.** You can't fail, and a wrong item just wiggles.
- 📸 takes a photo you can save. 🎵 toggles the cheerful background music.
- **Language.** The game is in Hebrew, laid out right-to-left. That covers every screen, speech bubble, spoken line and shop sign.
- **Name.** You pick the doll's name on the start screen. Progress, outfits and stickers are saved on the device.

## Controls
- **Touch:** tap to walk or drive, drag to turn the camera, pinch to zoom, and use the heart joystick to steer.
- **Keyboard:** WASD or arrow keys to move or drive, H or Space to honk, Esc to close a shop.

## Graphics
The look is inspired by [Fly High NYC](https://github.com/hoodini/fly-high-nyc). It uses the [pmndrs postprocessing](https://github.com/pmndrs/postprocessing) chain:
- **Bloom** on bright things: lamps, windows at night, magic hearts, sparkles, the sun.
- **Colour grade:** a little extra saturation and contrast, lavender shadows and peach highlights, a soft vignette and a whisper of film grain.
- **SMAA** anti-aliasing for smooth edges.
- **Depth of field:** a soft blurred background in the salon, boutique and pet shop close-ups, and in photos.

The painted sky, with its sun and drifting clouds, is also baked into an environment map. So the car paint, gems, nail polish and fountain water reflect it.

There are three quality levels: 🐢 Fast / 🙂 Nice / ✨ Beautiful, in the **?** menu. The game picks one for the device and steps down automatically if the device is slow.

## Development
```bash
cd barbie-city
npm install
npm run build      # -> dist/index.html (single file, three.js bundled in)
                   #    and dist/embed.html (same page without <html>/<head>, for hosts that wrap it)
npm run dev        # rebuild on every change
```
Source is in `src/`:
- `main.js`: game loop, camera, input, driving, friends, stickers
- `world.js`: town, shops, plaza and fountain, playground, nature, day and night
- `characters.js`: the doll (hair styles, outfits, face, accessories), puppy, car, kitty and butterflies
- `activities.js`: the shop mini-games
- `render.js`: post-processing chain, quality presets, sky environment map
- `quests.js`: magic hearts and the rainbow ring course
- `net.js`: family-room multiplayer (polls `/api/room`, draws the other children)
- `face.js`: selfie camera and the photo face texture
- `../api/room.js`, `../api/face.js`: Vercel functions on Upstash Redis (room state, selfies)
- `textures.js`: signs, face and patterns, drawn on canvases
- `audio.js`: synthesized sound effects, music and voice
- `i18n.js`: all the game's text (Hebrew)

There are no image or sound files: everything is drawn and synthesized in code. Static town meshes are merged per material to keep draw calls low, and the resolution drops automatically on slower tablets.
