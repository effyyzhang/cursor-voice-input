import * as assert from "assert";
import * as mocha from "mocha";
import { FileTreeSchema } from "../utils/validation.js";

const { suite, test } = mocha;

suite("FileTree Validation Tests", () => {
  test("validates correct file paths", () => {
    const validPaths = ["/path/to/file.txt", "file.js"];
    const result = FileTreeSchema.safeParse(validPaths);
    assert.strictEqual(result.success, true);
  });

  test("rejects empty paths", () => {
    const invalidPaths = [""];
    const result = FileTreeSchema.safeParse(invalidPaths);
    assert.strictEqual(result.success, false);
  });
});
