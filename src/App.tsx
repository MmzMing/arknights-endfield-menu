import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MENU_CONTENT, announcementDialog, collectDialogText, dialogFor, feedDialog, friendsDialog } from "./config/menu-content";
import { FRIEND_LINKS } from "./config/friend-links";
import { SITE_LINKS } from "./config/link-config";
import { TECH_STACK_COUNT, TECH_STACK_LABEL } from "./config/profile-panel-config";
import { MenuActionsContext } from "./menu-actions";
import { SceneLayer, SceneProvider, useScene, type SceneApi } from "./scene/scene-context";
import { SpriteDefs } from "./components/sprite-defs";
import { SiteIconDefs } from "./components/icon-defs";
import { BackdropDecor, Wallpaper } from "./components/backdrop";
import { Countdown } from "./components/countdown";
import { Disc } from "./components/disc";
import { TransitionSkeleton } from "./components/transition-skeleton";
import { DialRings } from "./components/dial-rings";
import { LevelPill } from "./components/level-pill";
import { EnergyPill } from "./components/energy-pill";
import { DiscButtons } from "./components/disc-buttons";
import { LeftCards, CardLinks } from "./components/left-cards";
import { RightTiles } from "./components/right-tiles";
import { TopBar } from "./components/top-bar";
import { NewsBelt, NewsPanel, type NewsSlide } from "./components/news-panel";
import { PlayerBadge } from "./components/player-badge";
import { ProfilePanel } from "./components/profile-panel";
import { CloseButton, Hud, NetInfo } from "./components/hud";
import { InfoDialog } from "./components/info-dialog";
import { DialogRasterWarm } from "./components/dialog-raster-warm";
import { BootScreen } from "./components/boot-screen";
import { warmDialogFonts, warmDialogImages, warmDialogRenderer, warmDialogSnapshot } from "./scene/dialog-pixel-renderer";
import { LegalFooter } from "./components/legal-footer";
import { MusicDialog } from "./components/music-dialog";
import { useMenuPhase } from "./hooks/use-menu-phase";
import { useFeeds } from "./hooks/use-feeds";
import { useMusicPlayer } from "./hooks/use-music-player";
import { useStageScale } from "./hooks/use-stage-scale";

/* App: assembles the menu exactly in the demo's mount order (app.js mountAll) and owns the two pieces of
   app-level state — the menu phase (body classes) and the open dialog. Everything inside the scene layers
   mounts through portals in tree order, which reproduces that order inside each layer. */

/** 订阅弹窗预热口径：首屏可见的条目数（卡片最多 780px、行高约 31px，取两倍余量）与失败源条数。 */
const VISIBLE_FEED_ITEMS = 24;
const VISIBLE_FEED_FAILURES = 6;
const noopRetry = () => {};

/** Hands the scene's imperative api (pause/resume/stageScale) out of the tree. */
function SceneBridge({ onScene }: { onScene: (api: SceneApi) => void }) {
  const scene = useScene();
  useEffect(() => {
    onScene(scene);
  }, [scene, onScene]);
  return null;
}

export default function App() {
  const content = MENU_CONTENT;
  const menu = useMenuPhase();
  const [dialog, setDialog] = useState<string | null>(null);
  // 首次访问（浏览器会话内）先跑全屏启动预设；完成后本会话不再展示（见 hooks/use-boot-screen.ts）。
  // 每次进入页面（含刷新）都先跑全屏预设加载：模块级缓存在刷新时会清空，只挡首次会漏掉后续进入。
  const [booting, setBooting] = useState(true);
  const finishBoot = useCallback(() => setBooting(false), []);
  // 启动页读数下方那一行身份资料直接取玩家徽章那一份，改配置即改启动页。
  const bootIdentity = useMemo(
    () => ({
      name: content.player.name,
      code: content.player.uid.replace(/^UID\s*[:：]\s*/i, ""),
    }),
    [content.player],
  );
  const feeds = useFeeds(dialog === "rss", menu.phase === "open");
  // 弹窗快照的输入在配置里已知：启动页与空闲预热共用同一份，避免重复拼装。
  // 订阅文案随抓取实时变化，按首屏可见的前若干条预热，与快照的可见文字选择同口径。
  const dialogPresets = useMemo(() => {
    const feedPreview = feedDialog(
      {
        ...feeds.data,
        items: feeds.data.items.slice(0, VISIBLE_FEED_ITEMS),
        failures: (feeds.data.failures ?? []).slice(0, VISIBLE_FEED_FAILURES),
      },
      feeds.status,
      feeds.isLive,
      noopRetry,
    );
    return {
      texts: [...Object.values(content.dialogs), friendsDialog(), feedPreview].map((dialogContent) =>
        collectDialogText(dialogContent),
      ),
      images: SITE_LINKS.map((link) => link.image),
    };
  }, [content, feeds.data, feeds.isLive, feeds.status]);
  const music = useMusicPlayer(dialog === "music");
  const [announcement, setAnnouncement] = useState<NewsSlide | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setAnnouncement(null);
  }, []);
  const openAnnouncement = useCallback((slide: NewsSlide) => {
    setDialog(null);
    setAnnouncement(slide);
  }, []);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  // 订阅内容与空闲期预栅格化必须取自同一份数据，快照缓存的 key 才会命中。
  const feedContent = feedDialog(feeds.data, feeds.status, feeds.isLive, feeds.refresh);
  const dialogContent =
    announcement !== null
      ? announcementDialog(announcement)
      : dialog === null || dialog === "music"
        ? null
        : dialog === "rss"
          ? feedContent
          : dialog === "friends"
            ? friendsDialog()
            : dialogFor(dialog, content);

  const stageRef = useRef<HTMLDivElement>(null);
  const wallpaperRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneApi | null>(null);

  const menuHeld = menu.phase === "exiting" || menu.phase === "closed";
  const paused = menuHeld || dialog !== null || announcement !== null || profileOpen;

  useStageScale(stageRef, wallpaperRef, (s) => {
    if (sceneRef.current) sceneRef.current.stageScale.value = s;
  });

  // the demo pauses the camera and the carousel while the menu closes; the dialog holds them the same way
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (paused) scene.pause();
    else scene.resume();
  }, [paused]);

  // the dialog transition needs an embedded-font stylesheet snapshot. Build it only after the entrance has
  // settled and the menu is idle, so the one-off ~60ms task never lands inside the entrance animation.
  // 首次访问时启动页已经把同一批预设跑完，这里的空闲预热只服务于跳过启动页的会话。
  useEffect(() => {
    if (menu.phase !== "open" || booting) return;
    let timer = 0;
    let idle = 0;
    const warm = () => {
      void warmDialogImages(dialogPresets.images);
      void warmDialogSnapshot();
      void warmDialogFonts(dialogPresets.texts);
      void warmDialogRenderer();
    };
    const run = () => {
      if (typeof window.requestIdleCallback !== "function") {
        warm();
        return;
      }
      idle = window.requestIdleCallback(warm, { timeout: 2000 });
    };
    timer = window.setTimeout(run, 500);
    return () => {
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [booting, dialogPresets, menu.phase]);

  const actions = useMemo(
    () => ({
      onAction: (action: string) => {
        setAnnouncement(null);
        setDialog(action);
      },
      requestClose: () => menu.close(),
    }),
    [menu],
  );

  // Escape: the dialog/panel owns its exit timeline; otherwise keep the demo's menu toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (booting || dialog !== null || announcement !== null || profileOpen) return;
      if (menu.phase === "entering" || menu.phase === "open") menu.close();
      else menu.open();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [announcement, booting, dialog, menu, profileOpen]);

  // clicking the letterbox around the stage closes the menu (the demo's #efMenu self-click)
  const onOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) menu.close();
    },
    [menu],
  );

  const onScene = useCallback((api: SceneApi) => {
    sceneRef.current = api;
  }, []);

  return (
    <MenuActionsContext.Provider value={actions}>
      <SpriteDefs />
      <SiteIconDefs />
      <Wallpaper ref={wallpaperRef} />
      <Countdown content={content.countdown} />
      <div className="ef-overlay" id="efMenu" onClick={onOverlayClick}>
        <div className="ef-stage" ref={stageRef} data-paused={paused ? "true" : "false"}>
          <SceneProvider>
            <BackdropDecor />
            <SceneLayer name="deck">
              <CardLinks />
              <NewsBelt />
            </SceneLayer>
            <SceneLayer name="core">
              <Disc paused={paused}>
                <TransitionSkeleton />
                <DialRings />
                <LevelPill label={TECH_STACK_LABEL} level={String(TECH_STACK_COUNT)} onAction={actions.onAction} />
              </Disc>
            </SceneLayer>
            <SceneLayer name="btns">
              <EnergyPill content={content.energy} />
              <DiscButtons />
            </SceneLayer>
            <SceneLayer name="tiles">
              <RightTiles tiles={content.rightTiles} />
              <CloseButton />
            </SceneLayer>
            <SceneLayer name="cards">
              <LeftCards cards={content.leftCards} />
              <PlayerBadge content={content.player} onOpen={openProfile} />
              <Hud />
            </SceneLayer>
            <SceneLayer name="news">
              <NewsPanel slides={content.news.slides} paused={paused} onOpen={openAnnouncement} />
            </SceneLayer>
            <SceneLayer name="top">
              <TopBar friendCount={FRIEND_LINKS.length} rssCount={feeds.data.items.length} />
            </SceneLayer>
            <SceneBridge onScene={onScene} />
          </SceneProvider>
          <NetInfo netUid={content.net.uid} />
          <LegalFooter />
        </div>
      </div>
      <button className="ef-closed-hint" id="efClosedHint" onClick={menu.open}>
        MENU CLOSED · 点击重新打开
      </button>
      <LegalFooter variant="fixed" />
      <div className="ef-post" aria-hidden="true">
        <div className="ef-post__grade" />
      </div>
      {dialogContent && (
        <InfoDialog content={dialogContent} onClose={closeDialog} />
      )}
      {dialog === "music" && (
        <MusicDialog player={music} onClose={closeDialog} />
      )}
      {profileOpen && (
        <ProfilePanel
          player={content.player}
          panel={content.profilePanel}
          music={music}
          startDate={content.siteStartDate}
          onClose={closeProfile}
        />
      )}
      {!booting &&
        menu.phase === "open" &&
        feeds.status === "ready" &&
        dialog === null &&
        announcement === null &&
        !profileOpen && (
          // 订阅弹窗是这里最重的一份快照：抓取落定后在空闲期先栅格化，打开时才来得及播满入场。
          <DialogRasterWarm content={feedContent} />
        )}
      {booting && (
        <BootScreen
          texts={dialogPresets.texts}
          images={dialogPresets.images}
          identity={bootIdentity}
          onDone={finishBoot}
        />
      )}
    </MenuActionsContext.Provider>
  );
}
