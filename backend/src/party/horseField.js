// Public identities match the eight actual abilities in horseEngine.js.
export const HORSE_IDENTITIES = [
  {
    name: "พญาลม",
    color: "#f58158",
    style: "wind",
    symbol: "🌪️",
    ability: "เจ้าแห่งลมพายุ",
    abilityDescription: "จังหวะพุ่งแรงกว่าตัวอื่น",
    personality: "ติดลมเมื่อไร ห้ามกะพริบตา",
  },
  {
    name: "เจ้าฟ้า",
    color: "#9ac7ee",
    style: "royal",
    symbol: "✨",
    ability: "สมาธิบริสุทธิ์",
    abilityDescription: "ไม่สะดุดตลอดการแข่งขัน",
    personality: "ม้านิ่ง ๆ ที่ไว้ใจได้",
  },
  {
    name: "หมูตัน",
    color: "#d3ad78",
    style: "stout",
    symbol: "🛡️",
    ability: "อึดและทนทาน",
    abilityDescription: "สะดุดแล้วฟื้นตัวเร็วกว่าตัวอื่น",
    personality: "ตัวแน่น ใจสู้ ไม่ยอมง่าย ๆ",
  },
  {
    name: "จอมซิ่ง",
    color: "#ff9b52",
    style: "racer",
    symbol: "🚀",
    ability: "ไนโตรทางตรง",
    abilityDescription: "เร่งความเร็วช่วงท้ายสนาม",
    personality: "เก็บแรงไว้แซงหน้าเส้นชัย",
  },
  {
    name: "มังกรดำ",
    color: "#b8a0e0",
    style: "dragon",
    symbol: "🔮",
    ability: "โชคชะตาลึกลับ",
    abilityDescription: "มีโอกาสเจอจังหวะพิเศษบ่อยขึ้น",
    personality: "ดวงมาเมื่อไร ใครก็หยุดไม่อยู่",
  },
  {
    name: "สิงห์สนามซ้อม",
    color: "#8dccad",
    style: "lion",
    symbol: "🦁",
    ability: "เครื่องร้อนไว",
    abilityDescription: "ออกตัวแรงในช่วงต้นสนาม",
    personality: "เสียงปืนดัง ก็พร้อมทะยาน",
  },
  {
    name: "เต่าบินเกียร์ห้า",
    color: "#b9d27e",
    style: "turtle",
    symbol: "🐢",
    ability: "แรงฮึดไล่แซง",
    abilityDescription: "ได้แรงเร่งเมื่อตกเป็นบ๊วย",
    personality: "อย่าเพิ่งขำ คนท้ายอาจมาแรง",
  },
  {
    name: "สายฟ้าหน้ามึน",
    color: "#ead36f",
    style: "lightning",
    symbol: "⚡",
    ability: "เดาทางยาก",
    abilityDescription: "ความเร็วผันผวนกว่าตัวอื่น",
    personality: "เดี๋ยวพุ่ง เดี๋ยวแผ่ว ลุ้นทุกวินาที",
  },
];

const hash = (value) => {
  let n = 2166136261;
  for (const c of value) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  // Mix adjacent horse IDs too; plain FNV leaves their opinion buckets almost equal.
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
export function presentHorse(horse) {
  const identity =
    HORSE_IDENTITIES.find((h) => h.name === horse.name) ||
    HORSE_IDENTITIES[(horse.id - 1) % 8];
  // Explicit public presentation: never expose private tuning or legacy form bars.
  return Object.fromEntries(
    ['id', 'name', 'color', 'style', 'symbol', 'personality']
      .map((key) => [key, horse[key] ?? identity[key]]),
  );
}

export function makeHorseField(random = Math.random) {
  return HORSE_IDENTITIES.map((identity, index) => ({
      ...identity,
      id: index + 1,
      speed: 70 + Math.floor(random() * 21),
      stamina: 70 + Math.floor(random() * 21),
      luck: 70 + Math.floor(random() * 21),
    }),
  );
}

export function presentGuru(guru) {
  const result = Object.fromEntries(
    ['id', 'name', 'avatar', 'subtitle', 'quote', 'missQuote', 'pickId', 'avoidId', 'rank', 'hit']
      .filter((key) => guru[key] !== undefined).map((key) => [key, guru[key]]),
  );
  // Recommendation stars are opinions; they are separate from private horse stats.
  if (guru.ratings) result.ratings = Object.fromEntries(
    Object.entries(guru.ratings).filter(([id, value]) => /^[1-8]$/.test(id) && Number.isInteger(value) && value >= 1 && value <= 5),
  );
  return result;
}

export function makeGurus(roundId, horses) {
  const definitions = [
    {
      id: "notknow",
      name: "กรู(ไม่)รู้",
      avatar: "🧐",
      subtitle: "สายวิเคราะห์ฟอร์ม",
      quote: "ฟอร์มมาแบบนี้ กรูขออยู่ข้างตัวนี้!",
      missQuote: "ทฤษฎีกรูดีนะ… ม้ามันไม่อ่านตำรา",
    },
    {
      id: "guess",
      name: "กรูเดา",
      avatar: "😎",
      subtitle: "สายเซนส์ล้วน ๆ",
      quote: "ไม่ต้องถามเหตุผล เซนส์กรูมาแล้ว",
      missQuote: "เซนส์มาถูกทาง แต่ผิดสนาม",
    },
    {
      id: "random",
      name: "กรูมั่ว",
      avatar: "🤪",
      subtitle: "สายดวงประจำวง",
      quote: "ชื่อถูกใจ สีถูกโฉลก จบ!",
      missQuote: "กรูบอกแล้วว่ามั่ว อย่ามองกรูแบบนั้น",
    },
  ];
  const picked = new Set();
  return definitions.map((guru, index) => {
    const ordered = [...horses].sort((a, b) => {
      const potential = (h) =>
        index === 0
          ? h.speed * 0.4 +
            h.stamina * 0.3 +
            h.luck * 0.3 +
            hash(`${roundId}:form:${h.id}`) * 8
          : hash(`${roundId}:${guru.id}:${h.id}`) * 100;
      return potential(b) - potential(a);
    });
    const favorite = ordered.find((h) => !picked.has(h.id));
    picked.add(favorite.id);
    const avoid =
      ordered[ordered.length - 1].id === favorite.id
        ? ordered[ordered.length - 2]
        : ordered[ordered.length - 1];
    return {
      ...guru,
      pickId: favorite.id,
      avoidId: avoid.id,
      ratings: Object.fromEntries(horses.map((h) => [h.id,
        h.id === favorite.id ? 5 : h.id === avoid.id ? 1 : 2 + Math.floor(hash(`${roundId}:${guru.id}:rating:${h.id}`) * 3),
      ])),
    };
  });
}
