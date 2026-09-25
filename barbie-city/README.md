# Dream Doll City 👑

A cute 3D doll-in-the-city game made for a 5-year-old. She walks around a small pink town with her puppy **Coco**, meets friends, visits the shops, and drives her pink convertible.

**To play:** open `dist/index.html` in any modern browser (tablet, phone or computer). It's one self-contained file that also works offline, so you can copy it to an iPad or Android tablet and open it there.

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

**Friends to meet:** Leo, Mia, Zoe, Lily (with her balloons), Grandma Rose, and Sam the barista. Walk up to one and they wave and say hello out loud. Tap them and you both dance.

**Stickers:** each place gives a sticker (11 in total, including one for meeting every friend). The ⭐ button opens the sticker book, with confetti when it's full.

## Made for little kids
- **No reading needed.** Everything has pictures, and the characters speak their lines out loud (voice on/off with 🗣️).
- **Tap to walk.** Tap the ground and she walks there. Tap a shop and she walks to the door and goes in. Tap the puppy and he barks and jumps. A big **Go in!** bubble appears at each door.
- **Nothing to lose.** You can't fail, and a wrong item just wiggles.
- 📸 takes a photo you can save. 🎵 toggles the cheerful background music.
- **Language.** You can switch between English and Hebrew (עב/EN button, or on the start screen). Hebrew switches the layout to right-to-left.
- **Name.** You pick the doll's name on the start screen. Progress, outfits and stickers are saved on the device.

## Controls
- **Touch:** tap to walk or drive, drag to turn the camera, pinch to zoom, and use the heart joystick to steer.
- **Keyboard:** WASD or arrow keys to move or drive, H or Space to honk, Esc to close a shop.

## Development
```bash
cd barbie-city
npm install
npm run build      # -> dist/index.html (single file, three.js bundled in)
npm run dev        # rebuild on every change
```
Source is in `src/`:
- `main.js`: game loop, camera, input, driving, friends, stickers
- `world.js`: town, shops, plaza and fountain, playground, nature, day and night
- `characters.js`: the doll (hair styles, outfits, face, accessories), puppy, car, kitty and butterflies
- `activities.js`: the shop mini-games
- `textures.js`: signs, face and patterns, drawn on canvases
- `audio.js`: synthesized sound effects, music and voice
- `i18n.js`: all the text in English and Hebrew

There are no image or sound files: everything is drawn and synthesized in code. Static town meshes are merged per material to keep draw calls low, and the resolution drops automatically on slower tablets.
