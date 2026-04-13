# SBTI Personality Test - Build Task

You are building the SBTI personality test project. The questions.json file already exists with 25 questions + 1 hidden trigger question.

## Files to Create

### 1. index.html - Single page app
- Landing page: Hook text + Start button + counter showing test count
- Quiz page: one question per screen, progress bar, large option buttons
- Result page: personality type + description + 15-dimension radar chart + share button
- Privacy policy section (toggle)
- Language toggle (Chinese/English)
- Fresh social theme: purple #8B5CF6 + cream white #FFF8F0, rounded cards, smooth animations
- Mobile-first responsive design
- Google Fonts: Inter + Noto Sans SC
- Tailwind CSS via CDN

### 2. personalities.json - 27+1 personality types
Each personality needs:
- code, name_zh, name_en
- pattern: 15-dimension H/M/L string like "HHHMMHLLHHMMHLM" (5 models x 3 dimensions)
- desc_zh, desc_en (2-3 sentences)
- strengths_zh, strengths_en (3 items)
- blind_spots_zh, blind_spots_en (2 items)
- tagline_zh, tagline_en (short catchy phrase)
- color (hex color for this personality)

The 27 types based on original SBTI:
CTRL(拿捏者), BOSS(领导者), SHIT(愤世者), PEACE(和平主义者), CARE(照顾者), LONE(独行侠),
FUN(开心果), DEEP(深思者), REAL(真实者), GHOST(隐形人), WARM(温暖者), EDGE(边缘人),
SAGE(智者), WILD(野马), COOL(酷盖), SOFT(软糖), SHARP(锐利者), DREAM(梦想家),
LOGIC(逻辑怪), SPARK(火花), FLOW(流水), ROOT(扎根者), SKY(天空), FREE(自由人),
DARK(暗夜), STAR(星星), ECHO(回声)
Plus hidden: DRUNK(酒鬼)

Create realistic and diverse dimension patterns for each. Make descriptions fun and entertaining (this is a personality test for entertainment, like the original SBTI).

### 3. i18n.js - Language pack
All UI text in Chinese and English as a JS object.

### 4. app.js - Main application logic
- Question flow: shuffle questions, show one per screen, save progress to localStorage
- Scoring: count H/M/L for each of 15 dimensions (each question maps to one dimension)
- Personality matching: Manhattan distance between user 15-dim pattern and all 28 personality patterns
- Hidden personality trigger: if Q26 option C is selected, skip normal matching and return DRUNK
- Radar chart: Canvas API, 15 dimensions grouped by 5 models with different colors
- Share card: Canvas generated, 9:16 ratio, personality name + tagline + radar + QR placeholder
- Language switching: toggle between zh/en, save preference to localStorage
- Privacy policy toggle

### 5. privacy.html - Privacy policy
Separate page with full privacy policy in Chinese and English. GDPR compliant. Includes data deletion info.

## Design Requirements
- Mobile-first, touch-friendly (buttons min 48px, large text)
- Smooth CSS transitions and animations
- Fresh social style: soft purple + cream white, rounded corners, subtle shadows
- Progress bar during quiz showing X/25
- Result reveal animation
- Share card suitable for social media (9:16 vertical)
- All text bilingual (zh/en)

## Dimension mapping for questions:
Questions 1-5 map to Self model (self_esteem x2, self_clarity x2, core_values x1)
Questions 6-10 map to Emotional model (attachment_security x2, emotional_investment x1, boundaries x2)
Questions 11-15 map to Attitude model (worldview x2, rules_flexibility x2, sense_of_purpose x1)
Questions 16-20 map to Action model (motivation x1, decision_style x2, execution x2)
Questions 21-25 map to Social model (social_initiative x2, interpersonal_boundaries x1, expression x2)

## Dimension order in pattern string (15 chars):
Index 0: self_esteem
Index 1: self_clarity
Index 2: core_values
Index 3: attachment_security
Index 4: emotional_investment
Index 5: boundaries
Index 6: worldview
Index 7: rules_flexibility
Index 8: sense_of_purpose
Index 9: motivation
Index 10: decision_style
Index 11: execution
Index 12: social_initiative
Index 13: interpersonal_boundaries
Index 14: expression

Make it production-ready. All files should be complete and functional. Test the scoring logic carefully.
