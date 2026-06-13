import { test } from "node:test";
import assert from "node:assert/strict";
import { signRequest } from "../src/ptv/sign.ts";

test("signRequest produces the known HMAC-SHA1 uppercase-hex signature", () => {
  const path =
    "/v3/departures/route_type/1/stop/2070" +
    "?max_results=5&expand=Route&expand=Direction&expand=Run&devid=1000000";
  const sig = signRequest("testkey", path);
  assert.equal(sig, "263422EE737D0B3614B02519ECCEEBBD1BED84B9");
});

test("signRequest output is 40 uppercase hex chars", () => {
  const sig = signRequest("any-key", "/v3/whatever?devid=1");
  assert.match(sig, /^[0-9A-F]{40}$/);
});
