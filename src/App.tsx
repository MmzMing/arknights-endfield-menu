import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MENU_CONTENT, dialogFor } from "./config/menu-content";
import { MenuActionsContext } from "./menu-actions";
import { SceneLayer, SceneProvider, useScene, type SceneApi } from "./scene/scene-context";
import { SpriteDefs } from "./components/sprite-defs";
import { SiteIconDefs } from "./components/icon-defs";
import { BackdropDecor, Wallpaper } from "./components/backdrop";
import { Disc } from "./components/disc";
import { TransitionSkeleton } from "./components/transition-skeleton";
import { DialRings } from "./components/dial-rings";
import { LevelPill } from "./components/level-pill";
import { EnergyPill } from "./components/energy-pill";
import { DiscButtons } from "./components/disc-buttons";
import { LeftCards, CardLinks } from "./components/left-cards";
import { RightTiles } from "./components/right-tiles";
import { TopBar } from "./components/top-bar";
import { NewsBelt, NewsPanel } from "./components/news-panel";
import { PlayerBadge } from "./components/player-badge";
import { CloseButton, Hud, NetInfo } from "./components/hud";
import { InfoDialog } from "./components/info-dialog";
import { useMenuPhase } from "./hooks/use-menu-phase";
import { useStageScale } from "./hooks/use-stage-scale";

/* App: assembles the menu exactly in the demo's mount order (app.js mountAll) and owns the two pieces of
   app-level state — the menu phase (body classes) and the open dialog. Everything inside the scene layers
   mounts through portals in tree order, which reproduces that order inside each layer. */

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
  const closeDialog = useCallback(() => setDialog(null), []);

  const stageRef = useRef<HTMLDivElement>(null);
  const wallpaperRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneApi | null>(null);

  const menuHeld = menu.phase === "exiting" || menu.phase === "closed";
  const paused = menuHeld || dialog !== null;

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
      onAction: (action: string) => setDialog(action),
      requestClose: () => menu.close(),
    }),
    [menu],
  );

  // Escape: the dialog owns its exit timeline; otherwise keep the demo's menu toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialog !== null) return;
      if (menu.phase === "entering" || menu.phase === "open") menu.close();
      else if (menu.phase !== "boot") menu.open();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, menu]);

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
      <div className="ef-overlay" id="efMenu" onClick={onOverlayClick}>
        <div className="ef-stage" ref={stageRef} data-paused={paused ? "true" : "false"}>
          <SceneProvider>
            <BackdropDecor />
            <SceneLayer name="deck">
              <CardLinks />
              <NewsBelt />
            </SceneLayer>
            <SceneLayer name="core">
              <Disc paused={paused} entering={menu.phase === "entering"}>
                <TransitionSkeleton />
                <DialRings />
                <LevelPill label={content.levelPill.label} level={content.levelPill.level} onAction={actions.onAction} />
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
              <PlayerBadge content={content.player} />
              <Hud />
            </SceneLayer>
            <SceneLayer name="news">
              <NewsPanel slides={content.news.slides} paused={paused} />
            </SceneLayer>
            <SceneLayer name="top">
              <TopBar content={content.topBar} />
            </SceneLayer>
            <SceneBridge onScene={onScene} />
          </SceneProvider>
          <NetInfo netDelay={content.net.delay} netUid={content.net.uid} />
        </div>
      </div>
      <button className="ef-closed-hint" id="efClosedHint" onClick={menu.open}>
        MENU CLOSED · 点击重新打开
      </button>
      <div className="ef-post" aria-hidden="true">
        <div className="ef-post__grade" />
      </div>
      {dialog !== null && (
        <InfoDialog content={dialogFor(dialog, content)} onClose={closeDialog} />
      )}
    </MenuActionsContext.Provider>
  );
}
