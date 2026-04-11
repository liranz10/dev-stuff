# Output Format Preferences

## General Rules
- Language: Hebrew for messages to Liran, English for code and filenames
- Length: Short and to the point. No essays.
- Structure: Bullet points > paragraphs
- Tone: Direct, friendly, professional

## Telegram Message Format

### When starting a task:
```
🎮 מתחיל: {game-name}
📋 תוכנית:
• עיצוב GDD
• פיתוח קוד
• יצירת assets
• בדיקות QA
```

### When reporting progress:
```
✅ {task} - הושלם
⏳ {task} - בתהליך
```

### When done:
```
🎉 {game-name} מוכן!
🌐 Web: {url}
📁 קבצים: games/{name}/
📱 iOS: cd games/{name} && npm run ios:sync
```

### When there's an error:
```
⚠️ בעיה ב-{step}:
{short description}
דרוש ממך: {specific action needed}
```

## Agent-to-Agent Communication (internal)
- JSON objects for structured data between agents
- Markdown for human-readable documents (GDD, reports)
- Keep intermediate files in `games/{name}/` directory

## GDD Format (Design Agent output)
```markdown
# Game: {name}
## Concept
## Core Mechanic
## Scenes
## Assets Needed (list for Art Agent)
## Win Condition
## Audio
```

## Code Standards
- Phaser.js Scene classes (not functions)
- Descriptive variable names in English
- Comments in Hebrew for non-obvious logic
- No TypeScript, no transpilation complexity
