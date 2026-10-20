import { describe, expect, it } from "vitest";
import type { RandomPicker } from "@/modules/shared/ports";
import { pickReplyVariant } from "./reply-picker";

function lastItemPicker() {
  const receivedLists: unknown[][] = [];
  const picker: RandomPicker = {
    pick<T>(items: readonly T[]) {
      receivedLists.push([...items]);
      return items[items.length - 1];
    },
  };
  return { picker, receivedLists };
}

describe("pickReplyVariant", () => {
  it("sem variação preenchida, não há resposta", () => {
    const { picker } = lastItemPicker();

    expect(pickReplyVariant({ variants: [], strategy: "RANDOM" }, picker)).toBeUndefined();
    expect(pickReplyVariant({ variants: ["", "  "], strategy: "RANDOM" }, picker)).toBeUndefined();
  });

  it("com uma única variação preenchida, usa ela sem sortear", () => {
    const { picker, receivedLists } = lastItemPicker();

    expect(pickReplyVariant({ variants: ["", "Te chamei!"], strategy: "RANDOM" }, picker)).toBe(
      "Te chamei!",
    );
    expect(receivedLists).toEqual([]);
  });

  it("CA-10: RANDOM sorteia só entre as variações preenchidas", () => {
    const { picker, receivedLists } = lastItemPicker();

    const reply = pickReplyVariant({ variants: ["A", " ", "B", "C"], strategy: "RANDOM" }, picker);

    expect(reply).toBe("C");
    expect(receivedLists).toEqual([["A", "B", "C"]]);
  });

  it("SEQUENTIAL percorre as variações em ordem e recomeça no fim", () => {
    const { picker, receivedLists } = lastItemPicker();
    const config = { variants: ["A", "", "B", "C"], strategy: "SEQUENTIAL" as const };

    const replies = [0, 1, 2, 3, 4].map((sequenceIndex) =>
      pickReplyVariant(config, picker, sequenceIndex),
    );

    expect(replies).toEqual(["A", "B", "C", "A", "B"]);
    expect(receivedLists).toEqual([]);
  });
});
