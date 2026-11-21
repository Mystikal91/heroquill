// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectNumberOnFocus } from "./selectOnFocus";

/** Number fields report no selection range, so the test watches for the call to `select`. */
function field(id: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const select = vi.spyOn(input, "select");
  return { input, select };
}

describe("select a number field on focus", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("selects the text of a number field and leaves other fields alone", () => {
    const stop = selectNumberOnFocus(document);
    document.body.innerHTML =
      '<input id="n" type="number" value="45"><input id="t" type="text" value="abc">';
    const number = field("n");
    const text = field("t");
    number.input.focus();
    expect(number.select).toHaveBeenCalledOnce();
    text.input.focus();
    expect(text.select).not.toHaveBeenCalled();
    stop();
  });

  it("leaves a read-only field alone and stops listening when asked", () => {
    const stop = selectNumberOnFocus(document);
    document.body.innerHTML =
      '<input id="r" type="number" value="4" readonly><input id="n" type="number" value="45">';
    const readOnly = field("r");
    const number = field("n");
    readOnly.input.focus();
    expect(readOnly.select).not.toHaveBeenCalled();
    stop();
    number.input.focus();
    expect(number.select).not.toHaveBeenCalled();
  });
});
