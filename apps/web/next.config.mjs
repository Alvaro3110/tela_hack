import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..", "..");
const reactAriaRoot = path.join(
  repoRoot,
  "node_modules",
  "@copilotkit",
  "react-ui",
  "node_modules",
  "@headlessui",
  "react",
  "node_modules",
  "@react-aria",
  "focus",
  "node_modules",
  "react-aria"
);

const reactAriaSubpaths = [
  "Focusable",
  "FocusRing",
  "FocusScope",
  "Pressable",
  "private/focus/FocusScope",
  "private/focus/useHasTabbableChild",
  "private/focus/virtualFocus",
  "private/interactions/focusSafely",
  "private/interactions/PressResponder",
  "private/interactions/useFocusable",
  "private/interactions/useFocusVisible",
  "private/interactions/useScrollWheel",
  "private/utils/isFocusable",
  "useFocus",
  "useFocusable",
  "useFocusRing",
  "useFocusVisible",
  "useFocusWithin",
  "useHover",
  "useInteractOutside",
  "useKeyboard",
  "useLongPress",
  "useMove",
  "usePress"
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...Object.fromEntries(reactAriaSubpaths.map((subpath) => [`react-aria/${subpath}`, path.join(reactAriaRoot, subpath)]))
    };

    return config;
  }
};

export default nextConfig;
