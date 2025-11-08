import { useEffect, type RefObject } from "react";
import { UI_CONFIG } from "../config/constants";

export const useAutoResize = (
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string
) => {
  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    element.style.height = "auto";
    element.style.height = `${Math.min(
      element.scrollHeight,
      UI_CONFIG.TEXTAREA_MAX_HEIGHT
    )}px`;
  }, [value, ref]);
};
