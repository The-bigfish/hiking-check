import Dexie, { type Table } from "dexie";
import { migrateData } from "./migration";
import type { Category, DataMeta } from "./model";
import type {
  Gear,
  Trip,
  Item,
  Template,
  Food,
  Meal,
  Supply,
  Daily,
  Procurement,
  Expense,
  Wish,
  Review,
  Attachment,
} from "./model";
export class HikingDB extends Dexie {
  categories!: Table<Category>;
  meta!: Table<DataMeta>;
  gear!: Table<Gear>;
  trips!: Table<Trip>;
  items!: Table<Item>;
  templates!: Table<Template>;
  foods!: Table<Food>;
  meals!: Table<Meal>;
  supplies!: Table<Supply>;
  daily!: Table<Daily>;
  procurement!: Table<Procurement>;
  expenses!: Table<Expense>;
  wishes!: Table<Wish>;
  reviews!: Table<Review>;
  attachments!: Table<Attachment>;
  constructor(name = "shanxing") {
    super(name);
    this.version(1).stores({
      gear: "id,category,status",
      trips: "id,start",
      items: "id,tripId,gearId",
      templates: "id",
      foods: "id",
      meals: "id,tripId,foodId",
      supplies: "id,tripId",
      daily: "id,tripId",
      procurement: "id,tripId",
      expenses: "id,tripId",
      wishes: "id,status",
      reviews: "id,tripId",
      attachments: "id",
    });
    this.version(2)
      .stores({ gear: "id,category,status,maintenance" })
      .upgrade((tx) =>
        tx
          .table("gear")
          .toCollection()
          .modify((g) => {
            g.maintenance ??= "";
          }),
      );
    this.version(3)
      .stores({
        categories: "id,system,name,order",
        meta: "id",
        gear: "id,category,status,maintenance,categoryId",
        items: "id,tripId,gearId,sourceId,categoryId",
        wishes: "id,status,categoryId",
        expenses: "id,tripId,categoryId",
      })
      .upgrade(migrateData);
    this.on("populate", migrateData);
    this.on("versionchange", () => {
      this.close();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("shanxing:database-upgraded"));
    });
  }
}
export const db = new HikingDB();
