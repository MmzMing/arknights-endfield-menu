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
import { DialogContourDefs, InfoDialog } from "./components/info-dialog";
import { DialogRasterWarm } from "./components/dialog-raster-warm";
import { BootScreen } from "./components/boot-screen";
import { LegalFooter } from "./components/legal-footer";
import { MusicDialog } from "./components/music-dialog";
import { warmDialogRenderer } from "./scene/dialog-pixel-renderer";
import { useDialogViewport } from "./hooks/use-dialog-viewport";
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
  const [booting, setBooting] = useState(true);
  const [canAnimate, setCanAnimate] = useState(false);
  const [feedWaitOver, setFeedWaitOver] = useState(false);
  const [pageEpoch, setPageEpoch] = useState(0);
  const viewport = useDialogViewport();
  useEffect(() => {
    const timer = window.setTimeout(() => setFeedWaitOver(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    // pagehide 会归还 WebGL 上下文；从 bfcache 回来时重挂当前弹窗并在后台重建管线。
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setPageEpoch((value) => value + 1);
      if (canAnimate) void warmDialogRenderer().catch(() => undefined);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [canAnimate]);
  const finishBoot = useCallback((animate: boolean) => {
    setCanAnimate(animate);
    setBooting(false);
  }, []);
  const bootIdentity = useMemo(
    () => ({ name: content.player.name, code: content.player.uid.replace(/^UID\s*[:：]\s*/i, "") }),
    [content.player],
  );
  const feeds = useFeeds(dialog === "rss");
  const essentialDialogs = useMemo(() => [
    ...Object.values(content.dialogs),
    friendsDialog(),
    ...content.news.slides.map(announcementDialog),
  ], [content]);
  const backgroundDialogs = useMemo(() => content.rightTiles
    .filter((tile) => tile.id !== "friends" && !content.dialogs[tile.id])
    .map((tile) => dialogFor(tile.id, content)), [content]);
  const dialogPresets = useMemo(() => {
    const feedPreview = feedDialog({
      ...feeds.data,
      items: feeds.data.items.slice(0, VISIBLE_FEED_ITEMS),
      failures: (feeds.data.failures ?? []).slice(0, VISIBLE_FEED_FAILURES),
    }, feeds.status, feeds.isLive, noopRetry);
    return {
      texts: [...essentialDialogs, ...backgroundDialogs, feedPreview].map(collectDialogText),
      images: SITE_LINKS.map((link) => link.image),
    };
  }, [backgroundDialogs, essentialDialogs, feeds.data, feeds.isLive, feeds.status]);
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
  const feedContent = useMemo(() => feedDialog(feeds.data, feeds.status, feeds.isLive, feeds.refresh), [feeds.data, feeds.status, feeds.isLive, feeds.refresh]);
  const isFeedSettled = feeds.status === "error" || (feeds.status === "ready" && feeds.isLive) || feedWaitOver;
  // 订阅未落定时启动页先等（有上限），避免把构建期快照当作真正的首屏准备结果。
  const bootWarmContents = useMemo(() => isFeedSettled ? [...essentialDialogs, feedContent] : null, [essentialDialogs, feedContent, isFeedSettled]);
  // 后台只补拍会随抓取更新的订阅弹窗；占位弹窗结构简单，首次打开现拍也赶得上入场窗口。
  const idleWarmKey = `${feeds.data.generatedAt}:${feeds.status}:${viewport}:${pageEpoch}`;
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
  const paused = booting || menuHeld || dialog !== null || announcement !== null || profileOpen;

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

  const actions = useMemo(
    () => ({
      onAction: (action: string) => {
        if (booting) return;
        setAnnouncement(null);
        setDialog(action);
      },
      requestClose: () => { if (!booting) menu.close(); },
    }),
    [booting, menu],
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
      <DialogContourDefs />
      <Wallpaper ref={wallpaperRef} />
      <Countdown content={content.countdown} />
      <div className="ef-overlay" id="efMenu" onClick={onOverlayClick} inert={booting}>
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
      <button className="ef-closed-hint" id="efClosedHint" onClick={menu.open} disabled={booting}>
        MENU CLOSED · 点击重新打开
      </button>
      <LegalFooter variant="fixed" />
      <div className="ef-post" aria-hidden="true">
        <div className="ef-post__grade" />
      </div>
      {dialogContent && (
        <InfoDialog key={`${dialog ?? announcement?.title}:${viewport}:${pageEpoch}`} content={dialogContent} canAnimate={canAnimate} onClose={closeDialog} />
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
      {canAnimate && !booting && menu.phase === "open" &&
        dialog === null && announcement === null && !profileOpen && (
          <DialogRasterWarm key={idleWarmKey} contents={[feedContent]} idle />
        )}
      {booting && (
        <BootScreen
          texts={dialogPresets.texts}
          images={dialogPresets.images}
          contents={bootWarmContents}
          identity={bootIdentity}
          onDone={finishBoot}
        />
      )}
    </MenuActionsContext.Provider>
  );
}
