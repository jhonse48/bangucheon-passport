import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionItems, missions, places } from '../src/data/content';
import { gameMissions, photoMissions, quizMissions } from '../src/data/game-missions';
import { assertQuizAnswer, getQrInputCode, getQrPayload, makeCompletion, parseQrPayload, summarizeGame, validatePhotoSubmission } from '../src/lib/game';
import type { GameCompletion, PhotoSubmission } from '../src/lib/game';

test('all thirteen stops have a guide quiz and three optional observation photo missions', () => {
  assert.equal(quizMissions.length, 13);
  assert.equal(photoMissions.length, 3);
  assert.equal(new Set(gameMissions.map((mission) => mission.id)).size, 16);
  assert.equal(new Set(quizMissions.map((mission) => mission.qrCode)).size, 13);
  assert.equal(new Set(quizMissions.map((mission) => mission.placeId)).size, 13);
  for (const mission of gameMissions) {
    assert.ok(places.find((place) => place.id === mission.placeId));
    assert.equal(mission.steps.length, 3);
    assert.ok(mission.steps.every((step) => step.trim().length > 8));
    assert.ok(mission.observationHint.trim());
    assert.ok(collectionItems.some((item) => item.id === mission.collectionId));
    assert.ok(Number.isInteger(mission.xp) && mission.xp > 0);
  }
  for (const mission of quizMissions) {
    assert.ok(Number.isInteger(mission.correctIndex) && mission.correctIndex >= 0 && mission.correctIndex < mission.options.length);
    if (!mission.sourceMissionId) continue;
    const source = missions.find((item) => item.id === mission.sourceMissionId)!;
    assert.equal(mission.question, source.question);
    assert.deepEqual(mission.options, source.options);
    assert.equal(mission.correctIndex, source.correctIndex);
  }
  assert.deepEqual(photoMissions.map((mission) => mission.placeId).sort(), ['bangudae', 'cheonjeonri', 'museum']);
});

test('QR parser accepts only known app payloads or explicit short codes', () => {
  for (const mission of quizMissions) {
    assert.equal(parseQrPayload(getQrPayload(mission.id)).id, mission.id);
    assert.equal(parseQrPayload(getQrInputCode(mission.id)).id, mission.id);
    assert.equal(parseQrPayload(` ${mission.qrCode.toLowerCase()} `).id, mission.id);
  }
});

test('official URLs, spoofed, nested or altered QR payloads cannot unlock a quiz', () => {
  const known = quizMissions[0].qrPayload;
  const invalid = ['', ' ', 'https://www.ulsan.go.kr/s/bangudae/main.ulsan', 'https://example.org/?qr=' + known,
    known + '?verified=true', known + '#official', known + '/', known.replace('bangucheon:', 'https:'),
    'bangucheon://quiz/v1/UNKNOWN', known.replace('BG-', '%42G-'), 'javascript:alert(1)', 'x'.repeat(201),
    'BG-MUSEUM-26\nBG-DINO-26'];
  for (const raw of invalid) assert.throws(() => parseQrPayload(raw), { name: 'GameRuleError', code: 'INVALID_QR' });
  assert.throws(() => getQrPayload(photoMissions[0].id), { code: 'UNKNOWN_MISSION' });
});

test('answers require exact integer indices and wrong answers do not create a completion', () => {
  const mission = quizMissions[0];
  assert.doesNotThrow(() => assertQuizAnswer(mission, mission.correctIndex));
  for (const answer of [-1, 1.5, NaN, Infinity, mission.options.length, (mission.correctIndex + 1) % mission.options.length]) {
    assert.throws(() => assertQuizAnswer(mission, answer), { code: 'WRONG_ANSWER' });
  }
});

test('photo completion requires a real nonempty image Blob, allowed subject and observation note', () => {
  const mission = photoMissions[0];
  const valid = { photo: new Blob(['photo'], { type: 'image/jpeg' }), subject: mission.subjects[0], note: ' 꼬리의 모양을 보았어요. ' };
  assert.equal(validatePhotoSubmission(mission, valid).note, '꼬리의 모양을 보았어요.');
  for (const photo of [null, undefined, new Blob([], { type: 'image/jpeg' }), new Blob(['text'], { type: 'text/plain' })]) {
    assert.throws(() => validatePhotoSubmission(mission, { ...valid, photo } as PhotoSubmission), { code: 'INVALID_PHOTO' });
  }
  assert.throws(() => validatePhotoSubmission(mission, { ...valid, subject: '미확인 동물' }), { code: 'INVALID_SUBJECT' });
  assert.throws(() => validatePhotoSubmission(mission, { ...valid, note: '  ' }), { code: 'INVALID_NOTE' });
  assert.throws(() => validatePhotoSubmission(mission, { ...valid, note: '가'.repeat(2001) }), { code: 'INVALID_NOTE' });
});

test('XP, levels and thirteen-place collections derive from unique known missions', () => {
  const records: Record<string, GameCompletion> = {};
  assert.equal(summarizeGame(records).level, 1);
  assert.equal(summarizeGame(records).levelProgress, 0);
  assert.equal(summarizeGame(records).nextLevelXp, 120);
  const first = quizMissions[0];
  records[first.id] = { ...makeCompletion(first), xp: 99_999 };
  records.duplicate = records[first.id];
  records.unknown = { ...makeCompletion(first), missionId: 'unknown' };
  let summary = summarizeGame(records);
  assert.equal(summary.xp, 80, 'stored or duplicated reward counters cannot inflate XP');
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.stampPlaceIds.length, 1);
  for (const mission of gameMissions) records[mission.id] = makeCompletion(mission);
  summary = summarizeGame(records);
  assert.equal(summary.xp, 1400);
  assert.equal(summary.level, 5);
  assert.equal(summary.levelProgress, 100);
  assert.equal(summary.nextLevelXp, null);
  assert.equal(summary.completedCount, 16);
  assert.equal(summary.quizCount, 13);
  assert.equal(summary.photoCount, 3);
  assert.equal(summary.stampPlaceIds.length, 13);
  assert.equal(summary.collectionIds.length, 13);
});
