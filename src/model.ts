export const categories = [
  "背负",
  "住宿",
  "睡眠",
  "服装",
  "鞋袜",
  "炊具",
  "饮水",
  "照明",
  "导航通信",
  "医疗应急",
  "卫生",
  "电子设备",
  "其他",
];
export interface Gear {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  weight: number;
  quantity: number;
  price: number;
  date: string;
  status: string;
  location: string;
  notes: string;
  tags: string;
  maintenance: string;
  attachmentId?: string;
  archived?: boolean;
}
export interface Trip {
  id: string;
  name: string;
  location: string;
  start: string;
  end: string;
  distance: number;
  ascent: number;
  weather: string;
  route: string;
  emergency: string;
  budget: number | null;
  target: number;
  status: string;
}
export interface Item {
  id: string;
  tripId: string;
  gearId?: string;
  name: string;
  category: string;
  quantity: number;
  weight: number;
  price: number;
  required: boolean;
  carry: string;
  kind: string;
  state: string;
  notes: string;
  used?: string;
  rating?: string;
  replace?: boolean;
}
export interface Template {
  id: string;
  name: string;
  items: Omit<Item, "id" | "tripId">[];
}
export interface Food {
  id: string;
  name: string;
  spec: string;
  weight: number;
  kcal: number;
  price: number;
  cook: boolean;
  water: number;
  notes: string;
}
export interface Meal {
  id: string;
  tripId: string;
  day: number;
  slot: string;
  foodId: string;
  name: string;
  weight: number;
  kcal: number;
  price: number;
  servings: number;
  supplyId: string;
}
export interface Supply {
  id: string;
  tripId: string;
  name: string;
  day: number;
}
export interface Daily {
  id: string;
  tripId: string;
  day: number;
  start: string;
  end: string;
  camp: string;
  water: string;
  resupply: string;
  notes: string;
}
export interface Procurement {
  id: string;
  tripId: string;
  foodId: string;
  ready: number;
}
export interface Expense {
  id: string;
  tripId: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  attachmentId?: string;
  gearId?: string;
}
export interface Wish {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  price: number;
  weight: number;
  url: string;
  priority: string;
  reason: string;
  status: string;
  tripItemId?: string;
  gearId?: string;
  purchaseQty?: number;
  merged?: boolean;
  previousItem?: Item;
}
export interface Review {
  id: string;
  tripId: string;
  notes: string;
  leftovers: string;
}
export interface Attachment {
  id: string;
  data: string;
  name: string;
}
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (c: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(
    c / 100,
  );
export const kg = (g: number) => `${(g / 1000).toFixed(2)} kg`;
export function days(t: Pick<Trip, "start" | "end">) {
  return Math.round((Date.parse(t.end) - Date.parse(t.start)) / 86400000) + 1;
}
export function mealTotal(ms: Meal[]) {
  return ms.reduce(
    (a, m) => ({
      weight: a.weight + m.weight * m.servings,
      kcal: a.kcal + m.kcal * m.servings,
      price: a.price + Math.round(m.price * m.servings),
    }),
    { weight: 0, kcal: 0, price: 0 },
  );
}
export function weights(items: Item[], meals: Meal[]) {
  let base = 0,
    consumable = 0,
    water = 0,
    worn = 0;
  for (const i of items) {
    const w = i.weight * i.quantity;
    if (i.carry === "穿戴") worn += w;
    else if (i.kind === "饮水") water += w;
    else if (i.kind === "消耗品") consumable += w;
    else base += w;
  }
  const food = mealTotal(meals.filter((m) => !m.supplyId)).weight;
  return {
    base,
    consumable,
    water,
    worn,
    food,
    total: base + consumable + water + food,
  };
}
export function shopping(meals: Meal[], ready: Procurement[]) {
  const out = new Map<
    string,
    {
      foodId: string;
      name: string;
      servings: number;
      weight: number;
      price: number;
      ready: number;
      needed: number;
    }
  >();
  for (const m of meals) {
    const x = out.get(m.foodId) || {
      foodId: m.foodId,
      name: m.name,
      servings: 0,
      weight: 0,
      price: 0,
      ready: ready.find((r) => r.foodId === m.foodId)?.ready || 0,
      needed: 0,
    };
    x.servings += m.servings;
    x.weight += m.weight * m.servings;
    x.price += Math.round(m.price * m.servings);
    out.set(m.foodId, x);
  }
  return [...out.values()].map((x) => ({
    ...x,
    needed: Math.max(0, x.servings - x.ready),
  }));
}
export function supplyLoads(
  meals: Meal[],
  supplies: Supply[],
  duration: number,
) {
  const points = [
    { id: "", name: "出发携带", day: 1 },
    ...supplies.slice().sort((a, b) => a.day - b.day),
  ];
  return points.map((s, index) => ({
    ...s,
    endDay: points[index + 1] ? points[index + 1].day - 1 : duration,
    receiveWeight: mealTotal(meals.filter((m) => m.supplyId === s.id)).weight,
    carryWeight: mealTotal(
      meals.filter(
        (m) =>
          m.day >= s.day &&
          (points.find((p) => p.id === m.supplyId)?.day ?? Infinity) <= s.day,
      ),
    ).weight,
  }));
}
