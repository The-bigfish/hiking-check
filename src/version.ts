declare const __BUILD_INFO__: {
  version: string;
  buildId: string;
  builtAt: string;
};
export const buildInfo =
  typeof __BUILD_INFO__ === "undefined"
    ? { version: "test", buildId: "test", builtAt: "" }
    : __BUILD_INFO__;
