import assert from "node:assert/strict";
import test from "node:test";
import {
  getVerifiedViewingPosition,
  kakaoSearchUrl,
  searchUlsanPlaces,
} from "../src/lib/kakao";
import type { KakaoPlaceResult, KakaoSDK } from "../src/lib/kakao";
import type { Place } from "../src/lib/types";

function sdkWithSearch(results: KakaoPlaceResult[], status = "OK"): KakaoSDK {
  return {
    maps: {
      services: {
        Status: { OK: "OK", ZERO_RESULT: "ZERO_RESULT", ERROR: "ERROR" },
        Places: class {
          keywordSearch(
            _query: string,
            callback: (results: KakaoPlaceResult[], status: string) => void,
          ) {
            callback(results, status);
          }
        },
      },
    },
  } as unknown as KakaoSDK;
}

const result = (
  id: string,
  patch: Partial<KakaoPlaceResult> = {},
): KakaoPlaceResult => ({
  id,
  place_name: "테스트 장소",
  address_name: "울산 울주군 테스트 주소",
  road_address_name: "",
  place_url: "",
  x: "129",
  y: "35",
  ...patch,
});

test("heritage-only or unverified coordinates never become visitor destinations", () => {
  const heritageOnly = {
    heritagePosition: { lat: 35, lng: 129 },
    viewingPosition: null,
    locationStatus: "공식 자료 확인",
  } as Place;
  assert.equal(getVerifiedViewingPosition(heritageOnly), null);
  assert.equal(
    getVerifiedViewingPosition({
      viewingPosition: { lat: 35, lng: 129 },
      locationStatus: "확인 필요",
    }),
    null,
  );
  assert.equal(
    getVerifiedViewingPosition({
      viewingPosition: { lat: NaN, lng: 129 },
      locationStatus: "공식 자료 확인",
    }),
    null,
  );
  assert.equal(
    getVerifiedViewingPosition({
      viewingPosition: { lat: 95, lng: 129 },
      locationStatus: "공식 자료 확인",
    }),
    null,
  );
  assert.deepEqual(
    getVerifiedViewingPosition({
      viewingPosition: { lat: 35, lng: 129 },
      locationStatus: "공식 자료 확인",
    }),
    { lat: 35, lng: 129 },
  );
});

test("live search excludes other regions and unusable coordinates without inventing replacements", async () => {
  const results = [
    result("local"),
    result("full-name", { address_name: "울산광역시 울주군 테스트 주소" }),
    result("wrong-city", { address_name: "서울 종로구 테스트 주소" }),
    result("wrong-district", { address_name: "울산 중구 테스트 주소" }),
    result("missing-coordinates", { x: "", y: "" }),
    result("invalid", { x: "not-a-number" }),
    result("out-of-range", { y: "95" }),
  ];
  const found = await searchUlsanPlaces(
    sdkWithSearch(results),
    "울산 테스트 장소",
  );
  assert.deepEqual(
    found.map((item) => item.id),
    ["local", "full-name"],
  );
  assert.equal(found[0], results[0]);
});

test("empty or failed map search never substitutes another destination", async () => {
  assert.deepEqual(
    await searchUlsanPlaces(
      sdkWithSearch([], "ZERO_RESULT"),
      "울산 테스트 장소",
    ),
    [],
  );
  await assert.rejects(
    searchUlsanPlaces(sdkWithSearch([], "ERROR"), "울산 테스트 장소"),
    /장소 검색에 연결하지 못했습니다/,
  );
});

test("external search keeps a query as encoded text on the Kakao search origin", () => {
  const query = "울산 테스트 / 장소?next=https://example.com#이동";
  const url = new URL(kakaoSearchUrl(query));
  assert.equal(url.origin, "https://map.kakao.com");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(
    decodeURIComponent(url.pathname.slice("/link/search/".length)),
    query,
  );
});
