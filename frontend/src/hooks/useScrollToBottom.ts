import { useEffect, type RefObject } from "react";

export const useScrollToBottom = (
  ref: RefObject<HTMLDivElement | null>,
  dependencies: React.DependencyList
) => {
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, dependencies);
};
