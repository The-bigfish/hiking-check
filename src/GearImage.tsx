import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Backpack,
  Tent,
  BedSingle,
  Shirt,
  Footprints,
  CookingPot,
  Milk,
  Flashlight,
  Compass,
  HeartPulse,
  Droplets,
  Smartphone,
  Package,
} from "lucide-react";
import { db } from "./db";
import { defaultIcon } from "./migration";
const icons = {
  背包: Backpack,
  帐篷: Tent,
  睡袋: BedSingle,
  衣服: Shirt,
  鞋袜: Footprints,
  炊具: CookingPot,
  水瓶: Milk,
  照明: Flashlight,
  导航通信: Compass,
  医疗: HeartPulse,
  卫生: Droplets,
  电子设备: Smartphone,
  其他: Package,
};
export function BuiltinIcon({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] || Package;
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
export function GearImage({
  name,
  category,
  categoryId,
  attachmentId,
  gearId,
  large = false,
}: {
  name: string;
  category: string;
  categoryId?: string;
  attachmentId?: string;
  gearId?: string;
  large?: boolean;
}) {
  const data = useLiveQuery(async () => {
    const g = gearId ? await db.gear.get(gearId) : undefined;
    const aid = attachmentId || g?.attachmentId;
    return {
      photo: aid ? (await db.attachments.get(aid))?.data : undefined,
      icon: categoryId
        ? (await db.categories.get(categoryId))?.icon
        : undefined,
    };
  }, [gearId, attachmentId, categoryId]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [data?.photo]);
  return (
    <span
      className={`equipment-image ${large ? "large" : ""}`}
      data-fallback={!data?.photo || failed ? "true" : "false"}
    >
      {data?.photo && !failed ? (
        <img src={data.photo} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span
          role="img"
          aria-label={`${name} · ${data?.icon || defaultIcon(category)}图标`}
        >
          <BuiltinIcon
            name={data?.icon || defaultIcon(category)}
            size={large ? 58 : 28}
          />
        </span>
      )}
    </span>
  );
}
