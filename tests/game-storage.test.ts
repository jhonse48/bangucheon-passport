import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { photoMissions, quizMissions } from '../src/data/game-missions';
import { createGameStorage } from '../src/lib/game-storage';
import { summarizeGame } from '../src/lib/game';
import type { PhotoSubmission } from '../src/lib/game';
import { createPassportStorage } from '../src/lib/storage';

const setup = () => createGameStorage({ indexedDB: new IDBFactory() });
const quiz = quizMissions[0];
const photoMission = photoMissions[0];
const photoInput = (): PhotoSubmission => ({ photo: new Blob([new Uint8Array([0, 1, 128, 255])], { type: 'image/jpeg' }), subject: photoMission.subjects[0], note: '선의 모양을 관찰했어요.' });

test('locked quiz and wrong answer award nothing; app QR unlock alone awards nothing', async () => {
  const storage = setup();
  await assert.rejects(() => storage.completeQuiz(quiz.id, quiz.correctIndex), { code: 'LOCKED' });
  await assert.rejects(() => storage.unlockQr('https://www.ulsan.go.kr'), { code: 'INVALID_QR' });
  assert.deepEqual(await storage.snapshot(), { unlockedQuizIds: [], completions: {} });
  assert.deepEqual(await storage.unlockQr(quiz.qrPayload), { missionId: quiz.id, alreadyUnlocked: false });
  assert.deepEqual(await storage.unlockQr(quiz.qrCode), { missionId: quiz.id, alreadyUnlocked: true });
  await assert.rejects(() => storage.completeQuiz(quiz.id, (quiz.correctIndex + 1) % quiz.options.length), { code: 'WRONG_ANSWER' });
  assert.equal(summarizeGame((await storage.snapshot()).completions).xp, 0);
  await storage.close();
});

test('concurrent correct completions across connections award once and persist after reopening', async () => {
  const indexedDB = new IDBFactory();
  const first = createGameStorage({ indexedDB });
  const second = createGameStorage({ indexedDB });
  await first.unlockQr(quiz.qrCode);
  const results = await Promise.all([
    first.completeQuiz(quiz.id, quiz.correctIndex), second.completeQuiz(quiz.id, quiz.correctIndex), first.completeQuiz(quiz.id, quiz.correctIndex),
  ]);
  assert.equal(results.filter((result) => !result.alreadyCompleted).length, 1);
  assert.equal(new Set(results.map((result) => result.completion.completedAt)).size, 1);
  await first.close();
  await second.close();
  const reopened = createGameStorage({ indexedDB });
  const saved = await reopened.snapshot();
  assert.deepEqual(saved.unlockedQuizIds, [quiz.id]);
  assert.equal(saved.completions[quiz.id].answerIndex, quiz.correctIndex);
  assert.equal(summarizeGame(saved.completions).xp, 80);
  await reopened.close();
});

test('cancelled or incomplete photo submissions leave no record and no reward', async () => {
  const storage = setup();
  for (const input of [undefined, { ...photoInput(), photo: null }, { ...photoInput(), subject: 'unknown' }, { ...photoInput(), note: '' }]) {
    await assert.rejects(() => storage.completePhoto(photoMission.id, input as unknown as PhotoSubmission), { name: 'GameRuleError' });
  }
  assert.deepEqual((await storage.snapshot()).completions, {});
  await storage.close();
});

test('photo missions need no QR, preserve original photo on repeat and export exact bytes', async () => {
  const indexedDB = new IDBFactory();
  const storage = createGameStorage({ indexedDB });
  const original = photoInput();
  assert.equal((await storage.completePhoto(photoMission.id, original)).alreadyCompleted, false);
  const repeated = await storage.completePhoto(photoMission.id, { ...photoInput(), note: '반복 완료로 덮어쓰지 않기' });
  assert.equal(repeated.alreadyCompleted, true);
  assert.equal(repeated.completion.note, original.note);
  await storage.close();
  const reopened = createGameStorage({ indexedDB });
  const saved = await reopened.snapshot();
  assert.equal(saved.completions[photoMission.id].subject, original.subject);
  assert.deepEqual(new Uint8Array(await saved.completions[photoMission.id].photo!.arrayBuffer()), new Uint8Array(await original.photo.arrayBuffer()));
  const exported = await reopened.exportData();
  assert.equal(exported.progress.xp, 120);
  assert.equal(exported.completions[0].photo?.mimeType, 'image/jpeg');
  assert.deepEqual(new Uint8Array(Buffer.from(exported.completions[0].photo!.data, 'base64')), new Uint8Array(await original.photo.arrayBuffer()));
  assert.deepEqual(exported.unlockedQuizIds, []);
  await reopened.close();
});

test('quota failures atomically reject photo/completion writes without earning XP or losing earlier data', async () => {
  const storage = setup();
  await storage.unlockQr(quiz.qrCode);
  await storage.completeQuiz(quiz.id, quiz.correctIndex);
  const originalAdd = IDBObjectStore.prototype.add;
  try {
    IDBObjectStore.prototype.add = function () { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    await assert.rejects(() => storage.completePhoto(photoMission.id, photoInput()), { name: 'QuotaExceededError' });
    await assert.rejects(() => storage.unlockQr(quizMissions[1].qrCode), { name: 'QuotaExceededError' });
  } finally { IDBObjectStore.prototype.add = originalAdd; }
  const saved = await storage.snapshot();
  assert.equal(saved.completions[photoMission.id], undefined);
  assert.deepEqual(saved.unlockedQuizIds, [quiz.id]);
  assert.equal(summarizeGame(saved.completions).xp, 80);
  await storage.close();
});

test('deleting mission/place records adjusts rewards and clearAll keeps legacy passport records separate', async () => {
  const indexedDB = new IDBFactory();
  const storage = createGameStorage({ indexedDB });
  const passport = createPassportStorage({ indexedDB });
  await passport.saveNote('museum', '기존 여권 메모');
  await storage.unlockQr(quiz.qrCode);
  await storage.completeQuiz(quiz.id, quiz.correctIndex);
  await storage.completePhoto(photoMission.id, photoInput());
  assert.equal(summarizeGame((await storage.snapshot()).completions).stampPlaceIds.length, 1);
  await storage.deleteCompletion(photoMission.id);
  assert.equal(summarizeGame((await storage.snapshot()).completions).xp, 80);
  await storage.deletePlaceRecords(quiz.placeId);
  assert.deepEqual(await storage.snapshot(), { unlockedQuizIds: [], completions: {} });
  await storage.unlockQr(quizMissions[1].qrCode);
  await storage.clearAll();
  assert.deepEqual(await storage.snapshot(), { unlockedQuizIds: [], completions: {} });
  assert.equal((await passport.snapshot()).records.museum.note, '기존 여권 메모');
  await storage.close();
  await passport.close();
});
