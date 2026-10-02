import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Firestore セキュリティルール（firestore.rules）のテスト。
 * 「本人のデータだけ読み書きできる」「想定外のデータは書き込めない」ことを確認する。
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "tameru-dde4e",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const validDoc = (rev: number) => ({
  schemaVersion: 3,
  rev,
  updatedAt: serverTimestamp(),
  deviceId: "device-1",
  payload: JSON.stringify({ accounts: [], yearlyData: {} }),
});

/** 管理者権限（ルールを無視）でデータを用意する */
async function seed(uid: string, rev = 1) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), { ...validDoc(rev), updatedAt: Timestamp.now() });
  });
}

describe("読み取り", () => {
  it("本人は自分のデータを読める", async () => {
    await seed("alice");
    await assertSucceeds(getDoc(doc(env.authenticatedContext("alice").firestore(), "users", "alice")));
  });

  it("他人のデータは読めない", async () => {
    await seed("alice");
    await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), "users", "alice")));
  });

  it("ログインしていなければ読めない", async () => {
    await seed("alice");
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users", "alice")));
  });

  it("users 以外の場所は誰も読み書きできない", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "admin", "config")));
    await assertFails(setDoc(doc(db, "other", "alice"), { a: 1 }));
  });
});

describe("書き込み", () => {
  it("本人は rev=1 で新規作成できる", async () => {
    await assertSucceeds(setDoc(doc(env.authenticatedContext("alice").firestore(), "users", "alice"), validDoc(1)));
  });

  it("新規作成で rev が1以外なら拒否", async () => {
    await assertFails(setDoc(doc(env.authenticatedContext("alice").firestore(), "users", "alice"), validDoc(5)));
  });

  it("他人の場所には書き込めない", async () => {
    await assertFails(setDoc(doc(env.authenticatedContext("bob").firestore(), "users", "alice"), validDoc(1)));
  });

  it("更新は rev をちょうど1増やす必要がある（他端末の更新を上書きしないため）", async () => {
    await seed("alice", 3);
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users", "alice"), validDoc(3)));
    await assertFails(setDoc(doc(db, "users", "alice"), validDoc(5)));
    await assertSucceeds(setDoc(doc(db, "users", "alice"), validDoc(4)));
  });

  it("想定外の項目・型・大きさのデータは拒否", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const ref = doc(db, "users", "alice");
    await assertFails(setDoc(ref, { ...validDoc(1), extra: "x" }));
    await assertFails(setDoc(ref, { ...validDoc(1), payload: 123 }));
    await assertFails(setDoc(ref, { ...validDoc(1), schemaVersion: "3" }));
    await assertFails(setDoc(ref, { ...validDoc(1), updatedAt: Timestamp.fromDate(new Date("2020-01-01")) }));
    await assertFails(setDoc(ref, { ...validDoc(1), payload: "x".repeat(900_001) }));
  });

  it("本人は削除できる。他人は削除できない", async () => {
    await seed("alice");
    await assertFails(deleteDoc(doc(env.authenticatedContext("bob").firestore(), "users", "alice")));
    await assertSucceeds(deleteDoc(doc(env.authenticatedContext("alice").firestore(), "users", "alice")));
  });
});
