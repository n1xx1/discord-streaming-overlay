import OBSWebSocket from "obs-websocket-js";
import { OBSRequestTypes, OBSResponseTypes } from "./obs-types";

const address = "ws://127.0.0.1:4444";
const password = "92sRowmvd6Y9GDxn";

export = class ExamplePlugin {
  obs = new OBSWebSocket();
  popoutWindowStore: any;
  connected = false;
  popoutInterval: number | null = null;

  start() {
    this.popoutWindowStore = BdApi.findModule(
      (f: any) => f.default.constructor.persistKey == "PopoutWindowStore"
    ).default;
    this.popoutWindowStore.addChangeListener(
      this.handlePopoutWindowStoreChanged
    );

    this.obs.on("ConnectionOpened", () => {
      console.log("connection opened!");
      this.connected = true;
    });
    this.obs.on("ConnectionClosed", (e) => {
      console.log("connection closed");
      this.connected = false;
    });
    this.obs.on("ConnectionError", (e) => {
      setTimeout(() => this.tryConnect(), 500);
    });
    this.tryConnect();
  }
  stop() {
    this.popoutWindowStore.removeChangeListener(
      this.handlePopoutWindowStoreChanged
    );
    if (this.popoutInterval) window.clearInterval(this.popoutInterval);

    this.obs.removeAllListeners();
    this.obs.disconnect();
    delete (this as any).obs;
  }

  async tryConnect() {
    try {
      await this.obs.connect(address, password);
    } catch (e) {}
  }

  async findInput(sceneName: string, windowName: string) {
    const { inputs } = await this.obsCall("GetInputList", {
      inputKind: "window_capture",
    });
    const discordObs: any = inputs.find(
      (i: any) => i.inputName == "DiscordObs"
    );

    const expectedWindowName = `${windowName}:Chrome_WidgetWin_1:Discord.exe`;
    const inputSettings = await this.obsCall("GetInputSettings", {
      inputName: discordObs.inputName,
    });
    if (inputSettings.inputSettings.window !== expectedWindowName) {
      await this.obsCall("SetInputSettings", {
        inputName: discordObs.inputName,
        inputSettings: {
          window: `${windowName}:Chrome_WidgetWin_1:Discord.exe`,
        },
      });
    }

    return discordObs;
  }

  async recreateWindowSource() {
    return null;
  }

  obsCall<Type extends keyof OBSRequestTypes>(
    requestType: Type,
    requestData?: OBSRequestTypes[Type]
  ): Promise<OBSResponseTypes[Type]> {
    return this.obs.call(requestType as any, requestData as any);
  }

  async handleVideos(popup: Window, videos: Element[]) {
    if (!this.connected) return;

    const sceneName = "DiscordOverlay";
    const discordObs = await this.findInput(sceneName, popup.document.title);

    const { sceneItems } = await this.obsCall("GetSceneItemList", {
      sceneName,
    });

    const targets = sceneItems.filter((x) =>
      x.sourceName.startsWith("DiscordSource_")
    );
    const expectedVideos: {
      name: string;
      bounds: { top: number; bottom: number; left: number; right: number };
      target: { x: number; y: number; width: number; height: number };
    }[] = [];

    for (const video of videos) {
      const title = video.querySelector<HTMLDivElement>(
        "[class*=overlayTitleText-]"
      )!;
      const name = title.innerText;
      const target: any = targets.find(
        (x: any) => x.sourceName === `DiscordSource_${name}`
      );
      if (!target) continue;

      const { top, bottom, left, right } = video.getBoundingClientRect();
      const { sceneItemTransform } = await this.obsCall(
        "GetSceneItemTransform",
        {
          sceneName,
          sceneItemId: target.sceneItemId,
        }
      );

      expectedVideos.push({
        name,
        bounds: { top, bottom, left, right },
        target: {
          x: sceneItemTransform.positionX,
          y: sceneItemTransform.positionY,
          width: sceneItemTransform.width,
          height: sceneItemTransform.height,
        },
      });
    }

    let oldVideos = sceneItems
      .filter(
        ({ inputKind, sourceName }: any) =>
          inputKind === "window_capture" && sourceName === discordObs.inputName
      )
      .map((x) => ({ id: x.sceneItemId, enabled: false }));

    for (const video of oldVideos) {
      const enabled = await this.obsCall("GetSceneItemEnabled", {
        sceneName,
        sceneItemId: video.id,
      });
      video.enabled = enabled.sceneItemEnabled;
    }

    let realSource = oldVideos.find((x) => !x.enabled)?.id;
    oldVideos = oldVideos.filter((x) => x.id !== realSource);

    if (!realSource) {
      // TODO!
      // realSource = await this.recreateWindowSource();
    }

    for (const { id } of oldVideos.slice(expectedVideos.length)) {
      await this.obsCall("RemoveSceneItem", { sceneName, sceneItemId: id });
    }

    for (let i = 0; i < expectedVideos.length; i++) {
      const { bounds, target } = expectedVideos[i];
      const sceneItemId =
        oldVideos.length > i
          ? oldVideos[i].id
          : await this.duplicateSource(sceneName, realSource!);

      const {
        sceneItemTransform: { sourceHeight, sourceWidth },
      } = (await this.obsCall("GetSceneItemTransform", {
        sceneName,
        sceneItemId,
      })) as any;

      const cropTop = (bounds.top / popup.innerHeight) * sourceHeight;
      const cropBottom =
        ((popup.innerHeight - bounds.bottom) / popup.innerHeight) *
        sourceHeight;
      const cropLeft = (bounds.left / popup.innerWidth) * sourceWidth;
      const cropRight =
        ((popup.innerWidth - bounds.right) / popup.innerWidth) * sourceWidth;

      const width = sourceWidth - cropLeft - cropRight;
      const height = sourceHeight - cropBottom - cropTop;

      const sceneItemTransform = {
        cropTop,
        cropBottom,
        cropLeft,
        cropRight,
        positionX: target.x,
        positionY: target.y,
        scaleX: target.width / width,
        scaleY: target.height / height,
      };
      await this.obsCall("SetSceneItemTransform", {
        sceneName,
        sceneItemId,
        sceneItemTransform,
      });
    }
  }

  async duplicateSource(sceneName: string, sceneItemId: number) {
    const { sceneItemId: newId } = await this.obsCall("DuplicateSceneItem", {
      sceneName,
      sceneItemId,
    });
    this.obsCall("SetSceneItemEnabled", {
      sceneName,
      sceneItemId: newId,
      sceneItemEnabled: true,
    });
    this.obsCall("SetSceneItemLocked", {
      sceneName,
      sceneItemId: newId,
      sceneItemLocked: true,
    });
    return newId;
  }

  handlePopoutWindowStoreChanged = () => {
    const popup: Window = this.popoutWindowStore.getWindow(
      "DISCORD_CHANNEL_CALL_POPOUT"
    );
    if (this.popoutInterval) window.clearInterval(this.popoutInterval);

    if (popup) {
      const element =
        (popup.document.getElementById(
          "overlay-style-container"
        ) as HTMLStyleElement) ??
        (() => {
          const e = popup.document.createElement("style");
          e.setAttribute("id", "overlay-style-container");
          popup.document.head.appendChild(e);
          return e;
        })();

      for (let i = 0; i < element.sheet!.cssRules.length; i++) {
        element.sheet!.deleteRule(i);
      }
      element.sheet?.insertRule(
        `[class*=tile-] {  border-radius: 0; }                          `
      );
      element.sheet?.insertRule(
        `[class*=tile-] [class*=border-], [class*=tile-] [class*=overlay-2RIWoZ] { display: none; }`
      );

      const func = () => {
        const videos = popup.document.querySelectorAll(
          "[class*=tile-][class*=videoLayer-]"
        );
        this.handleVideos(popup, [...videos]);
      };
      func();
      this.popoutInterval = window.setInterval(func, 2000);
    }
  };
};
