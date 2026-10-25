/* 音乐终端弹窗的可编辑配置。数据源与 D:\my-blog\my-blog 的 musicConfig.ts 对齐：
   mode = "meting" 走 Meting API（歌单 / 音频 / 封面 / 歌词），"local" 使用本地曲目列表。
   接口字段差异（name/title、artist/author、pic/cover）由 src/lib/music.ts 的归一化逻辑兼容；
   主接口失败时按 fallbackApis 顺序重试。弹窗里只展示这些内容，所有坐标/时序在组件与 CSS 中。 */

export type MusicMode = "meting" | "local";
export type MusicPlayModeName = "list" | "one" | "random";

export interface MusicMetingConfig {
  /** 形如 https://api.example/meting/?server=:server&type=:type&id=:id */
  api: string;
  /** 主接口失败时依次重试 */
  fallbackApis: string[];
  /** netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐 */
  server: string;
  /** song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家 */
  type: string;
  /** 歌单/专辑/单曲 ID 或搜索关键词 */
  id: string;
  /** 可选认证 token */
  auth?: string;
}

export interface MusicLocalTrackConfig {
  name: string;
  artist: string;
  url: string;
  /** 封面图（可选） */
  cover?: string;
  /** LRC 文本或歌词地址（可选） */
  lrc?: string;
}

export interface MusicConfig {
  mode: MusicMode;
  /** 初始音量 0–1 */
  volume: number;
  /** 初始播放模式：list=列表循环, one=单曲循环, random=随机 */
  playMode: MusicPlayModeName;
  meting: MusicMetingConfig;
  local: { playlist: MusicLocalTrackConfig[] };
}

/** 弹窗内的固定文案（控件 aria-label / 悬停提示在组件里）。 */
export interface MusicDialogCopy {
  title: string;
  titleEn: string;
  playlistTab: string;
  lyricsTab: string;
}

export const MUSIC_CONFIG: MusicConfig = {
  mode: "meting",
  volume: 0.6,
  playMode: "list",
  meting: {
    api: "https://api.qijieya.cn/meting/?server=:server&type=:type&id=:id",
    // injahow 已无法连接；i-meto 的 type=url 第二跳 404，仅作最后兜底
    fallbackApis: [
      "https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
      "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
    ],
    server: "netease",
    type: "playlist",
    id: "17955431099",
    auth: "",
  },
  local: {
    playlist: [],
  },
};

export const MUSIC_DIALOG_COPY: MusicDialogCopy = {
  title: "音乐终端",
  titleEn: "MUSIC",
  playlistTab: "歌单",
  lyricsTab: "歌词",
};
