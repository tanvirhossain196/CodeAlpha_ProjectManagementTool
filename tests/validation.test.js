import test from "node:test";
import assert from "node:assert/strict";
import { isEmail,isUsername,isDate,TASK_STATUSES,PRIORITIES } from "../server/validators/common.js";
import { cleanText,normalizeEmail } from "../server/utils/security.js";

test("validates core input types",()=>{
  assert.equal(isEmail("user@example.com"),true);
  assert.equal(isEmail("bad"),false);
  assert.equal(isUsername("tanvir.dev"),true);
  assert.equal(isUsername("x"),false);
  assert.equal(isDate("2026-08-25"),true);
  assert.ok(TASK_STATUSES.includes("IN_PROGRESS"));
  assert.ok(PRIORITIES.includes("CRITICAL"));
});
test("normalizes and strips unsafe angle brackets",()=>{
  assert.equal(normalizeEmail(" Test@Example.COM "),"test@example.com");
  assert.equal(cleanText("<b>Hello</b>",100),"bHello/b");
});
