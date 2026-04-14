const fs = require('fs');

const data = JSON.parse(fs.readFileSync('personalities.json', 'utf8'));

// Define proper 15-char patterns for each personality
const patterns = {
  CTRL: "HHHMMLLLHHMMHLM",
  BOSS: "HHHMMMLLLHHMMHL",
  SHIT: "LLLHMLLLLHLLLLL",
  PEACE: "MMMMLMMMMMMLMMM",
  CARE: "MMMLLMMLMMLLMML",
  LONE: "HHHLLLLLHLLLLHL",
  FUN: "MMMMMLLMLLMMMML",
  DEEP: "HHHLLLMMLMMHHMH",
  REAL: "HHHMMLLMHHMLLMH",
  GHOST: "LLLMLLLLMMMLLML",
  WARM: "MMMLLMMLHMMMMLL",
  EDGE: "HHHMLLLLMMMHHML",
  SAGE: "HHHMLMLMHMMHMHH",
  WILD: "HHHMLLMMHMLMMHH",
  COOL: "MMMMLMMMLLHMHMH",
  SOFT: "MMMLLMMLLMHMMMM",
  SHARP: "HHHMMLLLLHHMHMH",
  DREAM: "HHHMLLMMLMHHMHH",
  LOGIC: "HHHMLMLLMMHHHMH",
  SPARK: "MMHMMLLMHMHMHMH",
  FLOW: "MMMLLMMLLMHMLHM",
  ROOT: "HHHMMLLMMHMMLLH",
  SKY: "HHHMMLLMHMMHHHH",
  FREE: "HHHMMLLMHMMLLMH",
  DARK: "LLLMLLLLMMMMLLH",
  STAR: "MMHMMLLMHMHMHMM",
  ECHO: "MMLMMLMMMMMLLML",
  DRUNK: "LLLLMMMMLLLLLLL"
};

for (const p of data.personalities) {
  const code = p.code;
  if (patterns[code]) {
    p.pattern = patterns[code];
    console.log(`Fixed ${code}: ${p.pattern} (${p.pattern.length})`);
  } else {
    console.log(`WARN: No pattern for ${code}`);
  }
  
  // Ensure taglines exist
  if (!p.tagline_zh || p.tagline_zh.length < 3) {
    p.tagline_zh = `${p.name_zh}的标签`;
  }
  if (!p.tagline_en || p.tagline_en.length < 3) {
    p.tagline_en = `${p.name_en} tagline`;
  }
}

fs.writeFileSync('personalities.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Fixed personalities.json');