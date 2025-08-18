import { useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api'
import { MapPin, Shuffle, Sparkles, Star } from 'lucide-react'
import { useEffect } from 'react'

type Result = google.maps.places.PlaceResult
type Lang = 'en' | 'ko'
type ThemeName = 'pastel' | 'mint' | 'sunset' | 'mono'

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Random Restaurant Picker',
    placeholder: 'ZIP code or City, State (e.g. 75201 or Dallas, TX)',
    cuisine: 'Cuisine',
    minRating: 'Minimum Rating',
    minReviews: 'Minimum Review Count',
    openNow: 'Open now',
    radius: 'Search Radius',
    button: 'Get Random Recommendation',
    openInMaps: 'Open in Google Maps',
    langToggle: 'KR',
    useMyLoc: 'Use my location',
    noResults: 'No results. Try a larger radius or different filters.',
    noMatch: 'No results matched your filters.',
    searchFail: 'Search failed.',
    searching: 'Searching…',
    mapsFail: 'Google Maps failed to load.',
    theme: 'Theme',
  },
  ko: {
    title: '랜덤 맛집 추천',
    placeholder: 'ZIP 코드 또는 도시, 주 (예: 75201 또는 Dallas, TX)',
    cuisine: '음식 종류',
    minRating: '최소 별점',
    minReviews: '최소 리뷰 수',
    openNow: '영업 중',
    radius: '검색 반경',
    button: '랜덤 추천 받기',
    openInMaps: '구글맵에서 열기',
    langToggle: 'EN',
    useMyLoc: '현재 위치',
    noResults: '결과가 없어요. 반경을 늘리거나 조건을 바꿔보세요.',
    noMatch: '조건에 맞는 곳이 없어요.',
    searchFail: '검색에 실패했어요.',
    searching: '검색 중…',
    mapsFail: '구글 맵 로드에 실패했어요. UI는 계속 쓸 수 있어요.',
    theme: '테마',
  },
}

type CuisineKey = 'korean' | 'japanese' | 'chinese' | 'asian_other' | 'western';

type CuisineItem = {
  key: CuisineKey;
  label: { en: string; ko: string };
  keyword?: string;        // optional로 변경
  type?: string;           // 추가: cuisine별 place type
};

const CUISINES: readonly CuisineItem[] = [
  { key: 'korean', label: { en: 'Korean', ko: '한식' }, type: 'korean_restaurant' },
  { key: 'japanese', label: { en: 'Japanese', ko: '일식' }, type: 'japanese_restaurant' },
  { key: 'chinese', label: { en: 'Chinese', ko: '중식' }, type: 'chinese_restaurant' },
  // 기타 아시안은 타입 랜덤(예: 태국/베트남/인도/인도네시아)
  { key: 'asian_other', label: { en: 'Asian (Other)', ko: '아시안(기타)' } },
  // 서양은 범주가 넓어서 아래에서 여러 타입 돌려서 합칠 거면 keyword 없이 처리
  { key: 'western', label: { en: 'Western', ko: '양식' } },
] as const;

type Kw = readonly string[];

const KW_FUSION: Kw = [
  'fusion', '퓨전', 'pan asian', 'pan-asian', 'panasian', 'asian bistro', 'pan asian bistro'
];

const KW_BUFFET: Kw = [
  'buffet', '뷔페', 'all you can eat', 'all-you-can-eat', '무한리필'
];

const KW_NON_KOREAN_HINT: Kw = [
  'japanese','일식','일본','sushi','스시','ramen','라멘','udon','우동','izakaya','이자카야','yakitori','야키토리','tempura','덴푸라',
  'chinese','중식','중국','dim sum','딤섬','szechuan','sichuan','사천','쓰촨','hot pot','훠궈',
  'thai','타이','태국','pho','쌀국수','viet','vietnam','베트남',
  'indian','인도','tandoor','naan','curry','카레'
];

const EXCLUDE_TYPES = ['bar', 'night_club'] as const;

function wordsToRegex(words: string[]): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const piece = (w: string) => esc(w).replace(/\\-/g,'[-\\s]*').replace(/\\\s+/g,'[-\\s]*');
  return new RegExp(`(${words.map(piece).join('|')})`,'i');
}

const EXCLUDE_FUSION_RE = wordsToRegex([...KW_FUSION]);
const EXCLUDE_NAME_RE   = wordsToRegex([...KW_BUFFET]);
const NON_KOREAN_HINT_RE = wordsToRegex([...KW_NON_KOREAN_HINT]);


const THEMES: Record<ThemeName, { mesh1: string; mesh2: string; acc: string; accText: string }> = {
  pastel: { mesh1: 'rgba(255,182,193,0.25)', mesh2: 'rgba(173,216,230,0.25)', acc: '#ff90b3', accText: '#d72660' },
  mint: { mesh1: 'rgba(186,255,201,0.25)', mesh2: 'rgba(144,238,144,0.25)', acc: '#00c896', accText: '#00896c' },
  sunset: { mesh1: 'rgba(255,183,77,0.25)', mesh2: 'rgba(255,94,98,0.25)', acc: '#ff6e48', accText: '#b53f26' },
  mono: { mesh1: 'rgba(148,163,184,0.25)', mesh2: 'rgba(203,213,225,0.25)', acc: '#334155', accText: '#1f2937' },
}
const NEON_THEMES = [
  { mesh1: 'rgba(0,255,200,0.25)', mesh2: 'rgba(255,0,255,0.25)', acc: '#39ff14', accText: '#00fff7', name: 'Neon Green' },
  { mesh1: 'rgba(0,255,255,0.25)', mesh2: 'rgba(255,0,255,0.25)', acc: '#00fff7', accText: '#ff00ea', name: 'Neon Blue' },
  { mesh1: 'rgba(255,0,255,0.25)', mesh2: 'rgba(0,255,200,0.25)', acc: '#ff00ea', accText: '#39ff14', name: 'Neon Pink' },
  { mesh1: 'rgba(255,255,0,0.25)', mesh2: 'rgba(0,255,255,0.25)', acc: '#faff00', accText: '#00fff7', name: 'Neon Yellow' },
]

function BackgroundDecor({
  variant = 'dots',
  size = 24,          // 패턴 간격(px)
  opacity = 0.06,     // 패턴 진하기(0~1)
}: {
  variant?: 'grid' | 'dots' | 'stripes' | 'rings' | 'cross' | 'hex' | 'checker' | 'bokeh' | 'none'
  size?: number
  opacity?: number
}) {
  const col = `rgba(2,6,23,${opacity})`
  const patternStyle =
    variant === 'grid'
      ? {
        backgroundImage:
          `linear-gradient(to right, ${col} 1px, transparent 1px),
             linear-gradient(to bottom, ${col} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }
      : variant === 'dots'
        ? {
          backgroundImage: `radial-gradient(${col} 1px, transparent 1.6px)`,
          backgroundSize: `${size - 2}px ${size - 2}px`,
        }
        : variant === 'stripes'
          ? {
            backgroundImage: `repeating-linear-gradient(135deg, ${col} 0 1px, transparent 1px ${size}px)`,
          }
          : variant === 'rings'
            ? {
              backgroundImage: `repeating-radial-gradient(circle at 50% -20%, ${col} 0 2px, transparent 2px ${size}px)`,
            }
            : variant === 'cross'
              ? {
                // 가로/세로 헤어라인 교차(크로스 해치)
                backgroundImage:
                  `repeating-linear-gradient(0deg, ${col} 0 1px, transparent 1px ${size}px),
             repeating-linear-gradient(90deg, ${col} 0 1px, transparent 1px ${size}px)`,
              }
              : variant === 'hex'
                ? {
                  // 허니컴 느낌의 오프셋 점무늬(두 레이어를 어긋나게)
                  backgroundImage:
                    `radial-gradient(${col} 1px, transparent 1.4px),
             radial-gradient(${col} 1px, transparent 1.4px)`,
                  backgroundSize: `${size}px ${size}px, ${size}px ${size}px`,
                  backgroundPosition: `0 0, ${size / 2}px ${size / 2}px`,
                }
                : variant === 'checker'
                  ? {
                    // 바둑판(체커)
                    backgroundImage: `repeating-conic-gradient(${col} 0% 25%, transparent 0% 50%)`,
                    backgroundSize: `${size}px ${size}px`,
                  }
                  : variant === 'bokeh'
                    ? {
                      // 보케 느낌의 은은한 원형 하이라이트
                      background:
                        `radial-gradient(18% 18% at 20% 30%, rgba(255,255,255,0.14), transparent 60%),
             radial-gradient(22% 22% at 75% 20%, rgba(255,255,255,0.12), transparent 60%),
             radial-gradient(20% 20% at 30% 75%, rgba(255,255,255,0.10), transparent 60%),
             radial-gradient(18% 18% at 80% 70%, rgba(255,255,255,0.10), transparent 60%)`,
                    }
                    : null

  return (
    <div className="fixed inset-0 -z-10">
      {/* 베이스 메쉬 그라데이션(기존) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(1200px 600px at -10% -20%, var(--mesh1), transparent 60%),
             radial-gradient(900px 500px at 110% 120%, var(--mesh2), transparent 60%)`,
        }}
      />
      {/* 패턴 레이어 */}
      {variant !== 'none' && (
        <div className="absolute inset-0" style={patternStyle as any} />
      )}
      {/* 비네트 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, transparent 60%, rgba(2,6,23,.05))' }}
      />
    </div>
  )
}



function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const v = hover ?? value
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(n)}
          className="p-1"
        >
          <Star className={`h-6 w-6 transition-colors ${v >= n ? 'text-[var(--acc)]' : 'text-slate-300'}`} fill={v >= n ? 'currentColor' : 'none'} />
        </button>
      ))}
      <span className="ml-2 text-sm text-slate-500">{value.toFixed(1)}+</span>
    </div>
  )
}

function getLatLngLiteral(loc: google.maps.LatLng | google.maps.LatLngLiteral): google.maps.LatLngLiteral {
  // @ts-ignore
  if (typeof loc.lat === 'function') return { lat: (loc as google.maps.LatLng).lat(), lng: (loc as google.maps.LatLng).lng() }
  return loc as google.maps.LatLngLiteral
}

function buildMapsUrl(place?: Result | null): string {
  if (!place) return '#'
  const pid = place.place_id
  const name = place.name?.trim()
  const loc = place.geometry?.location && getLatLngLiteral(place.geometry.location)

  if (pid && name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${pid}`
  }
  if (pid) {
    return `https://www.google.com/maps/place/?q=place_id:${pid}`
  }
  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
  }
  if (loc) {
    return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`
  }
  return '#'
}


export default function App() {
  const [lang, setLang] = useState<Lang>('ko')
  const t = I18N[lang]

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false; // SSR 가드
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // 라이트 모드 디폴트
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme-dark');
    return saved === 'true' ? true : false;
  });
  const [theme, setTheme] = useState<ThemeName>('pastel');
  const [neonIdx, setNeonIdx] = useState(0);
  const palette = isDark ? NEON_THEMES[neonIdx] : THEMES[theme];
  const isNeonYellow = isDark && palette.acc.toLowerCase() === '#faff00';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme-dark', next ? 'true' : 'false');
  };

  const [zipOrCity, setZipOrCity] = useState('')
  const [cuisineKey, setCuisineKey] = useState<CuisineKey>('korean')
  const [minRating, setMinRating] = useState(4.0)
  const [minReviews, setMinReviews] = useState(50)
  const [openNow, setOpenNow] = useState(false)
  const [radius, setRadius] = useState(8000)

  const [picked, setPicked] = useState<Result | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geo, setGeo] = useState<google.maps.LatLngLiteral | null>(null)
  const [mapsError, setMapsError] = useState(false)

  const mapRef = useRef<google.maps.Map | null>(null)
  const onLoad = useCallback((map: google.maps.Map) => { mapRef.current = map; setMapsError(false) }, [])
  const center = useMemo(() => ({ lat: 32.7767, lng: -96.7970 }), [])

  const formatRadius = (m: number) => (lang === 'en' ? `${Math.round(m / 1609.344)} mi` : `${Math.round(m / 1000)} km`)
  const slider = useMemo(() => {
    if (lang === 'en') { const MI = 1609; return { min: MI, max: 12 * MI, step: MI } }
    return { min: 1000, max: 20000, step: 1000 }
  }, [lang])
  const fillPct = ((radius - slider.min) / (slider.max - slider.min)) * 100
  const marksMeters = useMemo(() => (lang === 'en' ? [1, 3, 5, 8, 12].map(mi => mi * 1609) : [1, 3, 5, 10, 20].map(km => km * 1000)), [lang])

  const useMyLocation = () => {
    setError(null)
    if (!navigator.geolocation) { setError('Geolocation is not supported.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('Failed to get current location.')
    )
  }

  const geocode = async (): Promise<google.maps.LatLngLiteral> => {
    if (geo) return geo
    if (!zipOrCity) return center
    const geocoder = new google.maps.Geocoder()
    const loc = await new Promise<google.maps.LatLngLiteral>((resolve, reject) => {
      geocoder.geocode({ address: zipOrCity }, (res, status) => {
        if (status === 'OK' && res && res[0]?.geometry?.location) {
          const p = res[0].geometry.location
          resolve({ lat: p.lat(), lng: p.lng() })
        } else reject(new Error(status))
      })
    })
    return loc
  }

  const pickRandom = (items: Result[]) => items[Math.floor(Math.random() * items.length)]

  const ASIAN_OTHER_TYPES = [
    'thai_restaurant',
    'vietnamese_restaurant',
    'indian_restaurant',
    'indonesian_restaurant',
    'sushi_restaurant',
    'ramen_restaurant',
  ] as const;

  const search = async () => {
  if (!mapRef.current) { setError(t.searchFail); return }
  setError(null);
  setIsLoading(true);

  // nearbySearch → Promise 헬퍼
  const nearby = (service: google.maps.places.PlacesService, req: google.maps.places.PlaceSearchRequest) =>
    new Promise<google.maps.places.PlaceResult[]>((resolve) => {
      service.nearbySearch(req, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) resolve(results);
        else resolve([]);
      });
    });

  // getDetails → Promise 헬퍼 (필드 최소화)
  const getDetails = (service: google.maps.places.PlacesService, placeId: string) =>
    new Promise<google.maps.places.PlaceResult | null>((resolve) => {
      service.getDetails(
        {
          placeId,
          // TS에서 필드 리터럴 union이라 any 캐스팅
          fields: ['place_id','name','types','servesCuisine','vicinity','formatted_address'] as any
        },
        (res, status) => resolve(status === google.maps.places.PlacesServiceStatus.OK && res ? res : null)
      );
    });

  try {
    const location = await geocode();
    mapRef.current.setCenter(location);

    const cuisine = CUISINES.find(c => c.key === cuisineKey)!;
    const service = new google.maps.places.PlacesService(mapRef.current);

    const baseReq: google.maps.places.PlaceSearchRequest = { location, radius, openNow };
    let multiTypes: string[] | null = null;

    if (cuisine.type) {
      (baseReq as any).type = cuisine.type; // 예: 'korean_restaurant'
    } else if (cuisineKey === 'asian_other') {
      multiTypes = [
        'thai_restaurant','vietnamese_restaurant','indian_restaurant','indonesian_restaurant',
        'sushi_restaurant','ramen_restaurant'
      ];
    } else if (cuisineKey === 'western') {
      multiTypes = [
        'american_restaurant','italian_restaurant','french_restaurant','seafood_restaurant',
        'steak_house','pizza_restaurant','mediterranean_restaurant','spanish_restaurant','greek_restaurant'
      ];
    } else {
      (baseReq as any).type = 'restaurant';
    }

    // ① 검색
    let results: google.maps.places.PlaceResult[] = [];
    if (!multiTypes) {
      results = await nearby(service, baseReq);
    } else {
      const lists = await Promise.all(
        multiTypes.map(tp => nearby(service, { ...baseReq, type: tp as any }))
      );
      const uniq = new Map<string, google.maps.places.PlaceResult>();
      lists.flat().forEach(p => { if (p.place_id) uniq.set(p.place_id, p); });
      results = Array.from(uniq.values());
    }

    if (results.length === 0) {
      setPicked(null);
      setError(t.noResults);
      return;
    }

    // ② (선택) 정확 타입만 엄격히 남기기
    if ((baseReq as any).type) {
      const strictType = (baseReq as any).type as string;
      results = results.filter(r => r.types?.includes(strictType as any));
    }

    // ③ 1차 오염 제거: 바/뷔페/퓨전(이름·주소) 컷
    results = results.filter(r => !r.types?.some(t => EXCLUDE_TYPES.includes(t as any)));
    results = results.filter(r => {
      const hay = `${r.name ?? ''} ${r.vicinity ?? r.formatted_address ?? ''}`;
      return !EXCLUDE_NAME_RE.test(hay) && !EXCLUDE_FUSION_RE.test(hay);
    });

    // ④ 2차 정밀 검증(한식일 때만): servesCuisine로 Korean 보장 + Fusion 컷
    // ④ 2차 정밀 검증(한식일 때만): servesCuisine로 Korean 보장 + Fusion 컷 (대상 확대)
let refined = results;
if (cuisineKey === 'korean' && results.length) {
  // '한식' 힌트 문자열
  const isKoreanHint = (s: string) => /(korean|한식|bbq|삼겹|갈비|비빔밥|순두부)/i.test(s);

  // ✅ Details 조회 "대상"을 넓힘:
  // - korean_restaurant 타입이거나
  // - 이름/주소에 한식 힌트가 있는 모든 후보
  const candAll = results.filter(r => {
    const hay = `${r.name ?? ''} ${r.vicinity ?? r.formatted_address ?? ''}`;
    return (r.types?.includes('korean_restaurant') || isKoreanHint(hay));
  });

  // 너무 많으면 상한(50) 두기 (리뷰 수 순 정렬)
  const cand = candAll
    .sort((a,b) => (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0))
    .slice(0, 50);

  // Details 조회
  const detailList = await Promise.all(
    cand.map(p => p.place_id ? getDetails(service, p.place_id) : Promise.resolve(null))
  );

  // Details 기반 판정
  const okIds = new Set<string>();
  for (const d of detailList) {
    if (!d?.place_id) continue;

    const cuisines: string[] | undefined = (d as any)?.servesCuisine;
    if (cuisines && cuisines.length) {
      const hasKorean = cuisines.some(c => /korean/i.test(c));
      const hasFusion = cuisines.some(c => /(fusion|pan[-\s]?asian)/i.test(c));
      if (hasKorean && !hasFusion) okIds.add(d.place_id);
      continue;
    }

    // servesCuisine 없으면 이름/주소 + 타입으로 보수적 판단
    const hay = `${d?.name ?? ''} ${d?.vicinity ?? d?.formatted_address ?? ''}`;
    const looksFusion = EXCLUDE_FUSION_RE.test(hay);
    const likelyKorean = isKoreanHint(hay) || (d?.types ?? []).includes('korean_restaurant');
    if (!looksFusion && likelyKorean) okIds.add(d.place_id);
  }

  // Details 통과 우선 적용
  let after = results.filter(r => r.place_id && okIds.has(r.place_id));

  // 너무 줄면 안전 fallback: 여전히 fusion 텍스트 컷 + korean_restaurant 타입만
  if (after.length < Math.min(3, results.length)) {
    after = results.filter(r => {
      const hay = `${r.name ?? ''} ${r.vicinity ?? r.formatted_address ?? ''}`;
      return !EXCLUDE_FUSION_RE.test(hay) && r.types?.includes('korean_restaurant');
    });
  }

  if (after.length) refined = after;
}


    // ⑤ 별점/리뷰수 필터
    const filtered = refined.filter(r =>
      (r.rating ?? 0) >= minRating &&
      (r.user_ratings_total ?? 0) >= minReviews
    );

    const pool = filtered.length ? filtered : refined;
    const choice = pool.length ? pickRandom(pool) : null;

    setPicked(choice);
    if (!choice) setError(t.noMatch);
  } catch (e) {
    setPicked(null);
    setError(t.searchFail);
  } finally {
    setIsLoading(false);
  }
};


  const placeUrl = useMemo(() => buildMapsUrl(picked), [picked])
  const pickedCenter = picked?.geometry?.location ? getLatLngLiteral(picked.geometry.location) : null

  return (
    <>
      <BackgroundDecor variant="cross" size={22} opacity={0.1} />
      {/* '' | 'cross' | 'hex' | ' | '  */}
      <div
        className="min-h-screen w-full text-slate-800 flex items-center justify-center p-6"
        style={{
          ['--mesh1' as any]: palette.mesh1,
          ['--mesh2' as any]: palette.mesh2,
          ['--acc' as any]: palette.acc,
          ['--accText' as any]: palette.accText
        }}
      >
        {/* 전체 래퍼 (relative) */}
        <div className="w-full max-w-2xl relative">
          {/* 로고 */}
          <div className="absolute left-1/2 -translate-x-1/2 top-3 sm:top-3 md:top-4 z-20">
            <img
              src="/logo.svg"
              alt="Food Picker logo"
              className={`h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 object-contain ${isDark ? "filter invert brightness-150" : ""}`}
              draggable={false}
            />
          </div>

          <div className="p-[1px] rounded-[1.6rem] bg-[linear-gradient(135deg,var(--acc),rgba(0,0,0,0))] z-10 relative">
            <div
              className={`rounded-[1.5rem] shadow-2xl backdrop-blur-sm border p-6 md:p-8 pt-16 sm:pt-20 md:pt-24 transition-colors duration-500
                ${isDark ? "bg-[#232329] border-[#333642]" : "bg-white/80 border-[rgba(0,0,0,0.06)]"}`}
              style={{
                boxShadow: isDark
                  ? '0 4px 32px 0 rgba(0,0,0,0.18), 0 0 0 2px var(--acc)'
                  : '0 4px 32px 0 rgba(0,0,0,0.08), 0 0 0 2px var(--acc)',
                borderWidth: '2px'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{t.title}</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleDark}
                    className="rounded-full border px-2 py-1 text-sm ml-2 flex items-center justify-center transition-colors duration-500"
                    aria-label={isDark ? "라이트 모드" : "다크 모드"}
                  >
                    {isDark ? <span style={{ fontSize: '1.1rem' }}>☀️</span> : <span style={{ fontSize: '1.1rem' }}>🌙</span>}
                  </button>
                  <div className="hidden sm:flex items-center gap-1">
                    {isDark ? (
                      NEON_THEMES.map((nt, idx) => (
                        <button
                          key={nt.name}
                          type="button"
                          onClick={() => setNeonIdx(idx)}
                          className={`h-6 w-6 rounded-full ring-2 transition ${neonIdx === idx ? 'ring-white' : 'ring-transparent'}`}
                          style={{ background: nt.acc, boxShadow: neonIdx === idx ? '0 0 0 3px #fff, 0 0 8px ' + nt.acc : undefined }}
                          title={nt.name}
                        />
                      ))
                    ) : (
                      (Object.keys(THEMES) as ThemeName[]).map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setTheme(name)}
                          className={`h-6 w-6 rounded-full ring-2 transition ${theme === name ? 'ring-[var(--acc)]' : 'ring-transparent'}`}
                          style={{ background: THEMES[name].acc }}
                          title={name}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setLang(prev => (prev === 'en' ? 'ko' : 'en'))}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 transition"
                  >
                    {t.langToggle}
                  </button>
                </div>
              </div>

              <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              {/* Location */}
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 opacity-70" />
                <input
                  value={zipOrCity}
                  onChange={e => setZipOrCity(e.target.value)}
                  placeholder={t.placeholder}
                  className={`w-full rounded-2xl border border-slate-300 bg-white/80 px-4 py-3 outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--acc)_35%,white)] shadow-sm
                  ${isDark ? "text-slate-100 placeholder:text-slate-400 bg-[#232329] border-[#333642]" : "text-slate-800"}`}
                />
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 active:scale-95 transition"
                >
                  {t.useMyLoc}
                </button>
              </div>

              {/* Cuisines */}
              <div className="mb-2">
                <div className={`text-sm font-medium mb-2 ${isDark ? "text-slate-100" : ""}`}>{t.cuisine}</div>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map(c => {
                    const selected = cuisineKey === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCuisineKey(c.key)}
                        className={`rounded-full px-3 py-1.5 text-sm border transition
                          ${selected
                            ? `bg-[var(--acc)] border-[var(--acc)] ${isNeonYellow ? 'text-[#222]' : 'text-white'}`
                            : `bg-white border-slate-300 hover:bg-slate-50 ${isDark ? "text-slate-100 bg-[#232329] border-[#333642]" : "text-slate-700"}`}`}
                      >
                        {lang === 'en' ? c.label.en : c.label.ko}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rating */}
              <div className="mb-2">
                <div className="text-sm font-medium mb-2">{t.minRating}</div>
                <StarRating value={minRating} onChange={(v) => setMinRating(v)} />
              </div>

              {/* Reviews */}
              <div className="mb-2">
                <div className={`text-sm font-medium mb-2 ${isDark ? "text-slate-100" : ""}`}>{t.minReviews}</div>
                <div className="flex flex-wrap gap-2">
                  {[0, 10, 30, 50, 100, 200].map(n => {
                    const selected = minReviews === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMinReviews(n)}
                        className={`rounded-full px-3 py-1.5 text-sm border transition
                          ${selected
                            ? `bg-[var(--acc)] border-[var(--acc)] ${isNeonYellow ? 'text-[#222]' : 'text-white'}`
                            : `bg-white border-slate-300 hover:bg-slate-50 ${isDark ? "text-slate-100 bg-[#232329] border-[#333642]" : "text-slate-700"}`}`}
                      >
                        {n}+
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              {/* Switch + Radius */}
              <div className="grid gap-4">
                <div className="flex items-center">
                  <button
                    role="switch"
                    aria-checked={openNow}
                    onClick={() => setOpenNow(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${openNow ? 'bg-[var(--acc)]' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${openNow ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <span className="ml-3 text-sm font-medium">{t.openNow}</span>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.radius}</span>
                    <span className="text-sm text-slate-600">{formatRadius(radius)}</span>
                  </div>

                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={radius}
                    onChange={e => setRadius(Number(e.target.value))}
                    className="range-modern"
                    style={{ ['--fill' as any]: `${fillPct}%` }}
                  />

                  <div className="mt-1 flex items-end justify-between text-[11px] text-slate-500">
                    {marksMeters.map((m) => {
                      const label = lang === 'en' ? `${Math.round(m / 1609)} mi` : `${Math.round(m / 1000)} km`
                      const active = Math.abs(radius - m) < slider.step / 2
                      return (
                        <button key={m} type="button" onClick={() => setRadius(m)} className="group flex flex-col items-center" title={label}>
                          <span className={`h-2.5 w-2.5 rounded-full transition ${active ? 'bg-[var(--acc)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                          <span className={`mt-1 transition ${active ? 'text-[var(--accText)] font-medium' : ''}`}>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={search}
                  disabled={isLoading || mapsError || !mapRef.current}
                  aria-busy={isLoading}
                  className={`mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--acc)] px-6 py-3 font-semibold shadow-lg hover:brightness-95 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed
                  ${isNeonYellow ? 'text-[#222]' : 'text-white'}`}
                >
                  <Shuffle className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? t.searching : t.button}
                  {!isLoading && <Sparkles className="h-5 w-5" />}
                </button>
              </div>

              {/* States */}
              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {isLoading && (
                <div className="mt-6 animate-pulse">
                  <div className="h-40 w-full rounded-2xl bg-slate-200/70" />
                  <div className="mt-3 h-5 w-1/3 rounded bg-slate-200/70" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-slate-200/70" />
                </div>
              )}

              {/* Result + Mini Map */}
              {picked && !isLoading && (
                <div className="mt-8">
                  <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        {picked.photos?.[0] ? (
                          <img
                            src={picked.photos[0].getUrl({ maxWidth: 640, maxHeight: 360 })}
                            alt={picked.name}
                            className="w-full h-48 rounded-2xl object-cover transition-transform hover:scale-[1.01]"
                          />
                        ) : (
                          <div className="w-full h-48 rounded-2xl bg-slate-100 grid place-items-center text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>

                      <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-200">
                        {pickedCenter ? (
                          <GoogleMap
                            center={pickedCenter}
                            zoom={14}
                            options={{
                              disableDefaultUI: true,
                              gestureHandling: 'none',
                              draggable: false,
                              mapTypeControl: false,
                              zoomControl: false,
                              clickableIcons: false,
                            }}
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                          >
                            <MarkerF position={pickedCenter} />
                          </GoogleMap>
                        ) : (
                          <div className="w-full h-full bg-slate-100" />
                        )}
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <h2 className="text-xl font-bold truncate">{picked.name}</h2>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        {typeof picked.price_level === 'number' && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                            {'$'.repeat(Math.min(4, Math.max(1, picked.price_level + 1)))}
                          </span>
                        )}
                        {picked.rating && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            ⭐ {picked.rating} ({picked.user_ratings_total ?? 0})
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {picked.vicinity || picked.formatted_address}
                      </p>
                      <a
                        href={placeUrl}
                        target={isMobile ? undefined : '_blank'}
                        rel={isMobile ? undefined : 'noopener noreferrer'}
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--acc)] px-4 py-2 text-white hover:brightness-95 shadow"
                      >
                        {t.openInMaps}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden map for PlacesService */}
      <LoadScript
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onError={() => setMapsError(true)}
      >
        <GoogleMap
          center={{ lat: 32.7767, lng: -96.7970 }}
          zoom={12}
          onLoad={onLoad}
          mapContainerStyle={{ width: 1, height: 1, position: 'absolute', left: -9999 }}
        />
      </LoadScript>
    </>
  )
}
