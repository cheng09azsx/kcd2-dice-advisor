export type FaceProbs = [number, number, number, number, number, number];

export interface DieSpec {
  /** Stable per-slot id, e.g. "die-0". */
  id: string;
  presetId: string | null;
  name: string;
  probs: FaceProbs;
  color: string;
  /** A non-probability rule, kept visible so the user knows it is not modeled. */
  effectNote?: string;
}

export type DiceCategory = "基础" | "灌铅" | "恶魔" | "圣物" | "牙齿";

export interface DicePreset {
  id: string;
  name: string;
  en: string;
  category: DiceCategory;
  percent: number[];
  probs: FaceProbs;
  color: string;
  note?: string;
  effect?: "wild";
}

function normalize(percent: readonly number[]): FaceProbs {
  const sum = percent.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
  return percent.map((v) => v / sum) as FaceProbs;
}

const CATEGORY_COLOR: Record<DiceCategory, string> = {
  基础: "#c9a45c",
  灌铅: "#a66a3d",
  恶魔: "#8f3f3f",
  圣物: "#5f7c8a",
  牙齿: "#b9a98a",
};

function preset(
  id: string,
  name: string,
  en: string,
  category: DiceCategory,
  percent: number[],
  note?: string,
  effect?: "wild",
): DicePreset {
  return {
    id,
    name,
    en,
    category,
    percent,
    probs: normalize(percent),
    color: CATEGORY_COLOR[category],
    note,
    effect,
  };
}

export const DICE_PRESETS: DicePreset[] = [
  preset("ordinary", "普通骰", "Ordinary Die", "基础", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7]),
  preset("weighted", "灌铅骰", "Weighted Die", "灌铅", [66.7, 6.7, 6.7, 6.7, 6.7, 6.7], "最稳的单骰：约 2/3 概率出 1。"),
  preset("favourable", "幸运白骰", "Favourable Die", "基础", [33.3, 0, 5.6, 5.6, 33.3, 22.2], "只出 1/3/4/5/6，1 和 5 合计 66.6%。"),
  preset("lucky", "幸运蓝骰", "Lucky Die", "基础", [27.3, 4.5, 9.1, 13.6, 18.2, 27.3], "1 与 6 各约 27%，是综合期望最高的普通可购骰之一。"),

  preset("aranka", "阿兰卡骰", "Aranka's Die", "灌铅", [28.6, 4.8, 28.6, 4.8, 28.6, 4.8], "奇数面偏重，1/3/5 各 28.6%。"),
  preset("cautious", "谨慎老千骰", "Cautious Cheater's Die", "灌铅", [23.8, 14.3, 9.5, 14.3, 23.8, 14.3], "兼顾 1 和 5 的伪装灌铅。"),
  preset("even", "偶数骰", "Even Die", "灌铅", [6.7, 26.7, 6.7, 26.7, 6.7, 26.7], "偶数各 26.7%，但 1/5 很少。"),
  preset("odd", "奇数骰", "Odd Die", "灌铅", [26.7, 6.7, 26.7, 6.7, 26.7, 6.7], "奇数各 26.7%，1/3/5 都能得分。"),
  preset("greasy", "油手骰", "Greasy Die", "灌铅", [17.6, 11.8, 17.6, 11.8, 17.6, 23.5], "1/3/5/6 略高，比较均衡。"),
  preset("grimy", "污浊骰", "Grimy Die", "灌铅", [6.2, 31.2, 6.2, 6.2, 43.7, 6.2], "5 高达 43.7%，单骰得分率高。"),
  preset("painted", "彩绘骰", "Painted Die", "灌铅", [18.7, 6.2, 6.2, 6.2, 43.7, 18.7], "5 高达 43.7%，兼顾 1/6。"),
  preset("pie", "派骰", "Pie Die", "灌铅", [46.2, 7.7, 23.1, 23.1, 0, 0], "1 占 46.2%，完全不出 5/6。配灌铅骰是热门组合。"),
  preset("strip", "脱衣骰", "Strip Die", "灌铅", [25, 12.5, 12.5, 12.5, 18.7, 18.7], "1 占四分之一，5/6 也不错。"),
  preset("three", "三之骰", "Three Die", "灌铅", [12.5, 6.2, 56.2, 6.2, 12.5, 6.2], "3 占 56.2%，容易凑三条 3。"),
  preset("unbalanced", "失衡骰", "Unbalanced Die", "灌铅", [25, 33.3, 8.3, 8.3, 16.7, 8.3], "1/2 偏重，1 和 5 合计 41.7%。"),
  preset("unlucky", "不幸骰", "Unlucky Die", "灌铅", [9.1, 27.3, 18.2, 18.2, 18.2, 9.1], "2 偏重，得分面偏少。"),
  preset("wagoner", "车夫骰", "Wagoner's Die", "灌铅", [5.6, 27.8, 33.3, 11.1, 11.1, 11.1], "2/3 偏重，适合凑 2 或 3 的三条。"),
  preset("mathematician", "数学家骰", "Mathematician's Die", "灌铅", [16.7, 20.8, 25, 29.2, 4.2, 4.2], "3/4 偏重，1/5 合计仅 20.9%。"),
  preset("lousy", "蹩脚赌徒骰", "Lousy Gambler's Die", "灌铅", [10, 15, 10, 35, 15, 15], "4 占 35%，单骰很难直接得分。"),
  preset("grozav", "格罗扎夫幸运骰", "Grozav's Lucky Die", "灌铅", [6.7, 66.7, 6.7, 6.7, 6.7, 6.7], "2 占 2/3，名字很讽刺。"),
  preset("sad-greaser", "悲伤格雷泽骰", "Sad Greaser's Die", "灌铅", [26.1, 26.1, 4.3, 4.3, 26.1, 13], "1/2/5 各 26.1%，得分面很集中。"),
  preset("shrinking", "缩水骰", "Shrinking Die", "灌铅", [22.2, 11.1, 11.1, 11.1, 11.1, 33.3], "1/6 偏高，接近普通骰。"),
  preset("king", "国王骰", "King's Die", "灌铅", [12.5, 18.7, 21.9, 25, 12.5, 9.4], "2/3/4 偏重，适合凑中点数三条。"),
  preset("hugo", "雨果骰", "Hugo's Die", "基础", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "外观独特，概率等同于普通骰。"),

  preset("lu", "卢骰", "Lu Die", "恶魔", [13, 13, 13, 13, 13, 34.8], "6 占 34.8%，三条 6 期望高。"),
  preset("ci", "茨骰", "Ci Die", "恶魔", [13, 13, 13, 13, 13, 34.8], "与卢骰同概率，6 占 34.8%。"),
  preset("fer", "费尔骰", "Fer Die", "恶魔", [13, 13, 13, 13, 13, 34.8], "恶魔三兄弟同概率，6 占 34.8%。"),
  preset("devils-head", "魔鬼头颅骰", "Devil's Head Die", "恶魔", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "魔鬼面是万能牌，可当任意点数，但不能单独得分。首版只按普通概率计算，未计入万能效果。", "wild"),

  preset("saint-antiochus", "圣安提阿克斯骰", "Saint Antiochus' Die", "圣物", [0, 0, 100, 0, 0, 0], "固定出 3。6 颗一起投，每次六条 3 = 2400 分。"),
  preset("holy-trinity", "圣三一骰", "Holy Trinity Die", "圣物", [18.2, 22.7, 45.4, 4.5, 4.5, 4.5], "3 占 45.4%，但 1/5 偏低。"),
  preset("heavenly", "天国骰", "Heavenly Kingdom Die", "圣物", [36.8, 10.5, 10.5, 10.5, 10.5, 21.1], "1 占 36.8%，6 占 21.1%。"),
  preset("st-stephen", "圣斯蒂芬骰", "St. Stephen's Die", "圣物", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "概率等同于普通骰。"),

  preset("molar", "臼齿骰", "Molar Die", "牙齿", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "概率等同于普通骰。"),
  preset("premolar", "前臼齿骰", "Premolar Die", "牙齿", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "概率等同于普通骰。"),
  preset("wisdom", "智齿骰", "Wisdom Tooth Die", "牙齿", [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], "概率等同于普通骰。"),
];

export const PRESET_BY_ID = new Map(DICE_PRESETS.map((p) => [p.id, p]));

export const DEFAULT_DICE_IDS = Array.from({ length: 6 }, () => "ordinary");

export function dieFromPreset(preset: DicePreset, slot: number): DieSpec {
  return {
    id: `die-${slot}`,
    presetId: preset.id,
    name: preset.name,
    probs: [...preset.probs] as FaceProbs,
    color: preset.color,
    effectNote: preset.effect === "wild" ? "万能面未计入" : undefined,
  };
}

export function customDie(slot: number, probs: FaceProbs, name = "自定义骰"): DieSpec {
  return {
    id: `die-${slot}`,
    presetId: null,
    name,
    probs: [...probs] as FaceProbs,
    color: "#7c7566",
    effectNote: undefined,
  };
}

export interface QuickSet {
  id: string;
  name: string;
  subtitle: string;
  presetIds: string[];
}

export const QUICK_SETS: QuickSet[] = [
  {
    id: "ordinary",
    name: "标准 6 普通骰",
    subtitle: "没有特殊骰时的基准",
    presetIds: ["ordinary", "ordinary", "ordinary", "ordinary", "ordinary", "ordinary"],
  },
  {
    id: "weighted-pie",
    name: "1 灌铅 + 5 派",
    subtitle: "社区热门：单骰期望极高",
    presetIds: ["weighted", "pie", "pie", "pie", "pie", "pie"],
  },
  {
    id: "saint",
    name: "6 圣安提阿克斯",
    subtitle: "固定全 3，单轮 2400",
    presetIds: Array.from({ length: 6 }, () => "saint-antiochus"),
  },
  {
    id: "three",
    name: "6 三之骰",
    subtitle: "56.2% 出 3，专凑三条",
    presetIds: Array.from({ length: 6 }, () => "three"),
  },
  {
    id: "lucky",
    name: "6 幸运蓝骰",
    subtitle: "1/5/6 兼顾，综合稳定",
    presetIds: Array.from({ length: 6 }, () => "lucky"),
  },
  {
    id: "trinity-three",
    name: "1 圣三一 + 5 三之骰",
    subtitle: "高概率三条 3 的娱乐组合",
    presetIds: ["holy-trinity", "three", "three", "three", "three", "three"],
  },
];

export function quickSetDice(set: QuickSet): DieSpec[] {
  return set.presetIds.map((id, index) => {
    const found = PRESET_BY_ID.get(id) ?? DICE_PRESETS[0];
    return dieFromPreset(found, index);
  });
}

export function defaultDice(): DieSpec[] {
  return DEFAULT_DICE_IDS.map((id, index) => dieFromPreset(PRESET_BY_ID.get(id)!, index));
}

export function probsSignature(dice: readonly DieSpec[]): string {
  return dice
    .map((die) => die.probs.map((p) => p.toFixed(5)).join(","))
    .join("|");
}
