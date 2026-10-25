import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MUSIC_CONFIG } from "../config/music-config";
import {
  buildMetingUrl,
  findLyricIndex,
  formatMusicTime,
  normalizeMetingTrack,
  parseLrc,
  playModeFromName,
  type MusicLyricLine,
  type MusicPlayMode,
  type MusicTrack,
} from "../lib/music";

/* 音乐终端的播放引擎：<audio>、歌单拉取（Meting 多源回退）、歌词同步与所有控件状态。
   弹窗打开（active）时补齐初始化；关闭弹窗不打断播放，音频与进度继续留在这一层，
   因此个人档案的播放卡等弹窗外的入口也能直接驱动它。
   高频进度不经过 React：timeupdate 通过 onTime 订阅直接写 DOM，只有曲目/歌词行这类低频变化进 state。 */

type LoadStatus = "idle" | "loading" | "ready" | "error";
type LyricsStatus = "idle" | "loading" | "loaded" | "none" | "failed";

export interface MusicTimeSnapshot {
  currentTime: number;
  duration: number;
  progress: number;
  currentTimeStr: string;
  durationStr: string;
}

export interface MusicPlayerApi {
  status: LoadStatus;
  error: string | null;
  playlist: MusicTrack[];
  currentIndex: number;
  track: MusicTrack | null;
  isPlaying: boolean;
  playMode: MusicPlayMode;
  volume: number;
  isMuted: boolean;
  lyrics: MusicLyricLine[];
  lyricsStatus: LyricsStatus;
  currentLrcIndex: number;
  init: (force?: boolean) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  cycleMode: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  seekRatio: (ratio: number) => void;
  seekTime: (time: number) => void;
  playAt: (index: number) => void;
  onTime: (listener: (snapshot: MusicTimeSnapshot) => void) => () => void;
  onSpectrum: (listener: (spectrum: Uint8Array) => void) => () => void;
}

const VOLUME_STORAGE_KEY = "endfield-music-volume";
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

function isUrlLike(source: string): boolean {
  return /^(https?:)?\/\//.test(source) || source.startsWith("/") || /\.(lrc|txt)(\?|#|$)/i.test(source);
}

function resolveAsset(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function storedVolume(): number | null {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null) return null;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? clamp01(value) : null;
  } catch {
    return null;
  }
}

async function fetchPlaylist(signal: AbortSignal): Promise<MusicTrack[]> {
  const config = MUSIC_CONFIG;
  if (config.mode === "local") {
    return config.local.playlist.map((track) => ({
      name: track.name,
      artist: track.artist,
      url: resolveAsset(track.url),
      ...(track.cover ? { pic: resolveAsset(track.cover) } : {}),
      ...(track.lrc ? { lrc: isUrlLike(track.lrc) ? resolveAsset(track.lrc) : track.lrc } : {}),
    }));
  }
  const apis = [config.meting.api, ...config.meting.fallbackApis].filter((api) => api.length > 0);
  for (const api of apis) {
    try {
      const response = await fetch(buildMetingUrl(api, config.meting, Date.now()), { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) continue;
      const tracks = payload
        .map(normalizeMetingTrack)
        .filter((track): track is MusicTrack => track !== null);
      if (tracks.length > 0) return tracks;
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn("[music] meting source failed", api, error);
    }
  }
  throw new Error("所有音乐源均不可用");
}

async function fetchLyricText(source: string, signal: AbortSignal): Promise<string> {
  if (!isUrlLike(source)) return source;
  const response = await fetch(resolveAsset(source), { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export function useMusicPlayer(active: boolean): MusicPlayerApi {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<MusicPlayMode>(() => playModeFromName(MUSIC_CONFIG.playMode));
  const [volume, setVolumeState] = useState(() => storedVolume() ?? clamp01(MUSIC_CONFIG.volume));
  const initialVolumeRef = useRef(volume);
  const [isMuted, setIsMuted] = useState(false);
  const [lyrics, setLyrics] = useState<MusicLyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>("idle");
  const [currentLrcIndex, setCurrentLrcIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<MusicTrack[]>([]);
  const currentIndexRef = useRef(0);
  const playModeRef = useRef<MusicPlayMode>(playMode);
  const lyricsRef = useRef<MusicLyricLine[]>([]);
  const lyricIndexRef = useRef(-1);
  const hasTrackRef = useRef(false);
  const initializedRef = useRef(false);
  const initBusyRef = useRef(false);
  const initAbortRef = useRef<AbortController | null>(null);
  const lyricAbortRef = useRef<AbortController | null>(null);
  const lyricTokenRef = useRef(0);
  const timeListenersRef = useRef(new Set<(snapshot: MusicTimeSnapshot) => void>());
  const spectrumListenersRef = useRef(new Set<(spectrum: Uint8Array) => void>());
  const spectrumRafRef = useRef(0);
  const spectrumFrameRef = useRef(0);
  const spectrumBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextRef = useRef<(auto: boolean) => void>(() => {});

  const snapshot = useCallback((): MusicTimeSnapshot => {
    const audio = audioRef.current;
    const duration = audio?.duration ?? 0;
    const currentTime = audio?.currentTime ?? 0;
    const valid = Number.isFinite(duration) && duration > 0;
    return {
      currentTime,
      duration: valid ? duration : 0,
      progress: valid ? clamp01(currentTime / duration) * 100 : 0,
      currentTimeStr: formatMusicTime(currentTime),
      durationStr: valid ? formatMusicTime(duration) : "0:00",
    };
  }, []);

  const emitTime = useCallback(() => {
    const value = snapshot();
    timeListenersRef.current.forEach((listener) => listener(value));
  }, [snapshot]);

  const onTime = useCallback((listener: (value: MusicTimeSnapshot) => void) => {
    timeListenersRef.current.add(listener);
    listener(snapshot());
    return () => {
      timeListenersRef.current.delete(listener);
    };
  }, [snapshot]);

  const onSpectrum = useCallback((listener: (spectrum: Uint8Array) => void) => {
    spectrumListenersRef.current.add(listener);
    if (spectrumRafRef.current === 0) {
      const tick = () => {
        const analyser = analyserRef.current;
        const buffer = spectrumBufferRef.current;
        const audio = audioRef.current;
        if (analyser && buffer) {
          if (audio && !audio.paused) analyser.getByteFrequencyData(buffer);
          spectrumFrameRef.current = (spectrumFrameRef.current + 1) % 2;
          if (spectrumFrameRef.current === 0) {
            spectrumListenersRef.current.forEach((notify) => notify(buffer));
          }
        }
        spectrumRafRef.current = requestAnimationFrame(tick);
      };
      spectrumRafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      spectrumListenersRef.current.delete(listener);
      if (spectrumListenersRef.current.size === 0 && spectrumRafRef.current !== 0) {
        cancelAnimationFrame(spectrumRafRef.current);
        spectrumRafRef.current = 0;
      }
    };
  }, []);

  const syncLyricIndex = useCallback((audio: HTMLAudioElement) => {
    const lines = lyricsRef.current;
    if (lines.length === 0) {
      if (lyricIndexRef.current !== -1) {
        lyricIndexRef.current = -1;
        setCurrentLrcIndex(-1);
      }
      return;
    }
    const index = findLyricIndex(lines, audio.currentTime);
    if (index === lyricIndexRef.current) return;
    lyricIndexRef.current = index;
    setCurrentLrcIndex(index);
  }, []);

  const loadLyrics = useCallback(async (source: string, token: number) => {
    lyricAbortRef.current?.abort();
    const controller = new AbortController();
    lyricAbortRef.current = controller;
    try {
      const text = await fetchLyricText(source, controller.signal);
      if (controller.signal.aborted || token !== lyricTokenRef.current) return;
      const lines = parseLrc(text);
      lyricsRef.current = lines;
      lyricIndexRef.current = -1;
      setLyrics(lines);
      setCurrentLrcIndex(-1);
      setLyricsStatus(lines.length > 0 ? "loaded" : "none");
    } catch (cause) {
      if (controller.signal.aborted || token !== lyricTokenRef.current) return;
      console.warn("[music] lyric load failed", cause);
      lyricsRef.current = [];
      setLyrics([]);
      setLyricsStatus("failed");
    }
  }, []);

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !hasTrackRef.current) return;
    const context = audioContextRef.current;
    if (context && context.state !== "running") void context.resume();
    const result = audio.play();
    if (result) {
      result.catch(() => {
        setIsPlaying(false);
        setError("浏览器拦截了播放，请再点一次播放键。");
      });
    }
  }, []);

  const loadTrack = useCallback((index: number, autoPlay: boolean) => {
    const list = playlistRef.current;
    if (index < 0 || index >= list.length) return;
    const track = list[index];
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setError(null);
    hasTrackRef.current = true;

    lyricTokenRef.current += 1;
    lyricAbortRef.current?.abort();
    lyricsRef.current = [];
    lyricIndexRef.current = -1;
    setLyrics([]);
    setCurrentLrcIndex(-1);
    setLyricsStatus(track.lrc ? "loading" : "none");

    const audio = audioRef.current;
    if (audio) {
      audio.src = track.url;
      audio.load();
      emitTime();
    }
    if (track.lrc) void loadLyrics(track.lrc, lyricTokenRef.current);
    if (autoPlay) startPlayback();
  }, [emitTime, loadLyrics, startPlayback]);

  const init = useCallback((force = false) => {
    if (initBusyRef.current) return;
    if (initializedRef.current && !force) return;
    initBusyRef.current = true;
    initAbortRef.current?.abort();
    const controller = new AbortController();
    initAbortRef.current = controller;
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const list = await fetchPlaylist(controller.signal);
        if (controller.signal.aborted) return;
        if (list.length === 0) throw new Error("歌单为空");
        playlistRef.current = list;
        setPlaylist(list);
        initializedRef.current = true;
        setStatus("ready");
        loadTrack(playModeRef.current === 2 ? Math.floor(Math.random() * list.length) : 0, false);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("[music] playlist load failed", cause);
        initializedRef.current = false;
        setStatus("error");
        setError("无法连接音乐档案库，请检查网络后重试。");
      } finally {
        initBusyRef.current = false;
      }
    })();
  }, [loadTrack]);

  const playNext = useCallback((auto: boolean) => {
    const list = playlistRef.current;
    if (list.length === 0) return;
    const audio = audioRef.current;
    if (auto && playModeRef.current === 1) {
      if (audio) {
        audio.currentTime = 0;
        startPlayback();
      }
      return;
    }
    let nextIndex: number;
    if (playModeRef.current === 2 && list.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * list.length);
      } while (nextIndex === currentIndexRef.current);
    } else {
      nextIndex = (currentIndexRef.current + 1) % list.length;
    }
    loadTrack(nextIndex, true);
  }, [loadTrack, startPlayback]);

  const playPrev = useCallback(() => {
    const list = playlistRef.current;
    if (list.length === 0) return;
    let prevIndex: number;
    if (playModeRef.current === 2 && list.length > 1) {
      do {
        prevIndex = Math.floor(Math.random() * list.length);
      } while (prevIndex === currentIndexRef.current);
    } else {
      prevIndex = (currentIndexRef.current - 1 + list.length) % list.length;
    }
    loadTrack(prevIndex, true);
  }, [loadTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!hasTrackRef.current) {
      if (status === "ready") loadTrack(currentIndexRef.current, true);
      else if (status === "idle") init();
      return;
    }
    if (audio.paused) startPlayback();
    else audio.pause();
  }, [init, loadTrack, startPlayback, status]);

  const playAt = useCallback((index: number) => {
    const audio = audioRef.current;
    if (index === currentIndexRef.current && hasTrackRef.current) {
      if (audio?.paused) startPlayback();
      return;
    }
    loadTrack(index, true);
  }, [loadTrack, startPlayback]);

  const cycleMode = useCallback(() => {
    const next = ((playModeRef.current + 1) % 3) as MusicPlayMode;
    playModeRef.current = next;
    setPlayMode(next);
  }, []);

  const setVolume = useCallback((value: number) => {
    const next = clamp01(value);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = next;
      audio.muted = false;
    }
    setVolumeState(next);
    setIsMuted(false);
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(next));
    } catch {
      // 隐私模式写不进存储，音量只在本次会话生效
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    const next = !isMuted;
    if (audio) audio.muted = next;
    setIsMuted(next);
  }, [isMuted]);

  const seekRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = clamp01(ratio) * audio.duration;
    emitTime();
    syncLyricIndex(audio);
  }, [emitTime, syncLyricIndex]);

  const seekTime = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    emitTime();
    syncLyricIndex(audio);
  }, [emitTime, syncLyricIndex]);

  useEffect(() => {
    nextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    audio.volume = initialVolumeRef.current;
    audioRef.current = audio;
    const spectrumListeners = spectrumListenersRef.current;

    try {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      spectrumBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (cause) {
      console.warn("[music] spectrum unavailable, playback continues without analyser", cause);
    }

    const handleTime = () => {
      emitTime();
      syncLyricIndex(audio);
    };
    const handleState = () => setIsPlaying(!audio.paused);
    const handleEnded = () => nextRef.current(true);
    const handleError = () => {
      if (!audio.getAttribute("src")) return;
      setIsPlaying(false);
      setError("音频加载失败，试试下一首。");
    };

    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("durationchange", handleTime);
    audio.addEventListener("loadedmetadata", handleTime);
    audio.addEventListener("play", handleState);
    audio.addEventListener("pause", handleState);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("durationchange", handleTime);
      audio.removeEventListener("loadedmetadata", handleTime);
      audio.removeEventListener("play", handleState);
      audio.removeEventListener("pause", handleState);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      initAbortRef.current?.abort();
      lyricAbortRef.current?.abort();
      if (spectrumRafRef.current !== 0) {
        cancelAnimationFrame(spectrumRafRef.current);
        spectrumRafRef.current = 0;
      }
      spectrumListeners.clear();
      spectrumBufferRef.current = null;
      analyserRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close();
      audioRef.current = null;
    };
  }, [emitTime, syncLyricIndex]);

  useEffect(() => {
    if (active) init();
  }, [active, init]);

  const track = playlist[currentIndex] ?? null;

  return useMemo(
    () => ({
      status,
      error,
      playlist,
      currentIndex,
      track,
      isPlaying,
      playMode,
      volume,
      isMuted,
      lyrics,
      lyricsStatus,
      currentLrcIndex,
      init,
      toggle,
      next: () => playNext(false),
      prev: playPrev,
      cycleMode,
      setVolume,
      toggleMute,
      seekRatio,
      seekTime,
      playAt,
      onTime,
      onSpectrum,
    }),
    [
      status, error, playlist, currentIndex, track, isPlaying, playMode, volume, isMuted,
      lyrics, lyricsStatus, currentLrcIndex, init, toggle, playNext, playPrev, cycleMode,
      setVolume, toggleMute, seekRatio, seekTime, playAt, onTime, onSpectrum,
    ],
  );
}
