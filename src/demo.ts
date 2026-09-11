import { db } from "./db";
import Dexie from "dexie";
import { migrateData } from "./migration";
import { uid, today, type Gear, type Trip, type Food } from "./model";
import { snapshot } from "./services";
export async function seedDemo() {
  await db.transaction("rw", db.tables, async () => {
    if (
      (await db.gear.count()) ||
      (await db.trips.count()) ||
      (await db.wishes.count()) ||
      (await db.foods.count())
    )
      throw Error("演示数据仅可加载到空白数据库，避免混入个人记录。");
    const base = {
      brand: "",
      model: "",
      quantity: 1,
      date: today(),
      status: "正常",
      location: "玄关装备柜",
      notes: "",
      tags: "春秋,露营",
      maintenance: "",
    };
    const gears: Gear[] = [
      {
        ...base,
        id: uid(),
        name: "轻量徒步背包 45L",
        category: "背负",
        weight: 1100,
        price: 89900,
        brand: "山野工坊",
      },
      {
        ...base,
        id: uid(),
        name: "双人三季帐篷",
        category: "住宿",
        weight: 1650,
        price: 129900,
      },
      {
        ...base,
        id: uid(),
        name: "羽绒睡袋 0℃",
        category: "睡眠",
        weight: 850,
        price: 108000,
      },
      {
        ...base,
        id: uid(),
        name: "充气睡垫",
        category: "睡眠",
        weight: 420,
        price: 45900,
      },
      {
        ...base,
        id: uid(),
        name: "防水冲锋衣",
        category: "服装",
        weight: 310,
        price: 69900,
      },
      {
        ...base,
        id: uid(),
        name: "头灯与备用电池",
        category: "照明",
        weight: 95,
        price: 18900,
      },
      {
        ...base,
        id: uid(),
        name: "钛合金炊具",
        category: "炊具",
        weight: 180,
        price: 26900,
      },
      {
        ...base,
        id: uid(),
        name: "随身急救包",
        category: "医疗应急",
        weight: 210,
        price: 9900,
        maintenance: today(),
      },
    ];
    await db.gear.bulkAdd(gears);
    const start = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      end = new Date(Date.parse(start) + 2 * 86400000)
        .toISOString()
        .slice(0, 10);
    const t: Trip = {
      id: uid(),
      name: "武功山 · 云上草甸",
      location: "江西 · 萍乡",
      start,
      end,
      distance: 27,
      ascent: 1850,
      weather: "多云转晴 · 8—19℃",
      route:
        "龙山村 → 发云界 → 绝望坡 → 金顶 → 山脚\n演示路线，请在实际出发前核实开放情况与天气。",
      emergency: "演示联系人，请替换为真实联系信息",
      budget: 120000,
      target: 2600,
      status: "计划中",
    };
    await db.trips.add(t);
    await db.items.bulkAdd(
      gears.map((g, i) => ({
        ...snapshot(g, t.id),
        state: i < 4 ? "已装包" : i < 6 ? "已准备" : "待准备",
      })),
    );
    await db.items.add({
      ...snapshot(gears[0], t.id),
      id: uid(),
      gearId: undefined,
      name: "饮用水",
      category: "饮水",
      kind: "饮水",
      weight: 1000,
      quantity: 2,
      state: "待准备",
    });
    for (let d = 1; d <= 3; d++)
      await db.daily.add({
        id: uid(),
        tripId: t.id,
        day: d,
        start: ["龙山村", "发云界", "金顶"][d - 1],
        end: ["发云界", "金顶", "山脚"][d - 1],
        camp: d < 3 ? "指定营地区域" : "",
        water: "出发前核实水源",
        resupply: "",
        notes: "",
      });
    const foods: Food[] = [
      {
        id: uid(),
        name: "燕麦能量早餐",
        spec: "80 g / 份",
        weight: 80,
        kcal: 320,
        price: 800,
        cook: true,
        water: 200,
        notes: "",
      },
      {
        id: uid(),
        name: "坚果能量棒",
        spec: "50 g / 根",
        weight: 50,
        kcal: 240,
        price: 600,
        cook: false,
        water: 0,
        notes: "",
      },
      {
        id: uid(),
        name: "冻干牛肉饭",
        spec: "120 g / 包",
        weight: 120,
        kcal: 520,
        price: 2500,
        cook: true,
        water: 300,
        notes: "",
      },
    ];
    await db.foods.bulkAdd(foods);
    const sp = uid();
    await db.supplies.add({
      id: sp,
      tripId: t.id,
      name: "金顶补给点（需核实）",
      day: 3,
    });
    for (let d = 1; d <= 3; d++)
      for (const [index, slot] of ["早餐", "午餐", "晚餐", "加餐"].entries()) {
        const f = foods[index === 0 ? 0 : index === 3 ? 1 : 2];
        await db.meals.add({
          id: uid(),
          tripId: t.id,
          day: d,
          slot,
          foodId: f.id,
          name: f.name,
          weight: f.weight,
          kcal: f.kcal,
          price: f.price,
          servings: slot === "加餐" ? 2 : 1,
          supplyId: d === 3 ? sp : "",
        });
      }
    await db.procurement.add({
      id: `${t.id}:${foods[0].id}`,
      tripId: t.id,
      foodId: foods[0].id,
      ready: 3,
    });
    await db.expenses.add({
      id: uid(),
      tripId: t.id,
      amount: 18600,
      category: "交通",
      date: today(),
      notes: "演示：往程车票",
    });
    await db.wishes.add({
      id: uid(),
      name: "折叠登山杖",
      category: "其他",
      brand: "",
      model: "碳纤维",
      price: 39900,
      weight: 360,
      url: "",
      priority: "优先",
      reason: "长距离下坡，减轻膝盖负担",
      status: "待购买",
    });
    for (const [name, count] of [
      ["单日轻装", 3],
      ["两天露营", 8],
      ["多日重装", 8],
    ] as const)
      await db.templates.add({
        id: uid(),
        name,
        items: gears.slice(0, count).map((g) => {
          const { id, tripId, ...i } = snapshot(g, t.id);
          return i;
        }),
      });
    await migrateData(Dexie.currentTransaction!);
  });
}
