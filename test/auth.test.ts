import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createAuthMiddleware } from "../src/auth.ts";

function mockRes() {
  const recorded: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      recorded.statusCode = code;
      return res;
    },
    json(body: unknown) {
      recorded.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, recorded };
}

function reqWith(authHeader?: string) {
  const req = {
    get: (name: string) => (name.toLowerCase() === "authorization" ? authHeader : undefined),
  };
  return req as unknown as Request;
}

const auth = createAuthMiddleware("s3cret");

test("calls next() when token matches", () => {
  let called = false;
  const { res, recorded } = mockRes();
  auth(reqWith("Bearer s3cret"), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(recorded.statusCode, 200);
});

test("401 when header missing", () => {
  let called = false;
  const { res, recorded } = mockRes();
  auth(reqWith(undefined), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(recorded.statusCode, 401);
  assert.deepEqual(recorded.body, { error: "unauthorized" });
});

test("401 when token wrong", () => {
  let called = false;
  const { res, recorded } = mockRes();
  auth(reqWith("Bearer nope"), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(recorded.statusCode, 401);
});

test("401 when scheme is not Bearer", () => {
  let called = false;
  const { res, recorded } = mockRes();
  auth(reqWith("Basic s3cret"), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(recorded.statusCode, 401);
});
