import OBSWebSocket, {
  OBSRequestTypes,
  OBSResponseTypes,
} from "obs-websocket-js";
import { genearteSettingsTemplate } from "./settings-template";

const pluginName = "DiscordStreamingOverlay";

const defaultSettings = {
  sceneName: "DiscordOverlay",
  websocketAddress: "ws://127.0.0.1:4444",
  websocketPassword: "",
};

export = class StreamingOverlayPlugin {
  obs = new OBSWebSocket();
  popoutWindowStore: any;
  connected = false;
  popoutInterval: number | null = null;

  settingsDom: HTMLElement | null = null;
  settingsDomSceneName: HTMLInputElement | null = null;
  settingsDomWebsocketAddress: HTMLInputElement | null = null;
  settingsDomWebsocketPassword: HTMLInputElement | null = null;

  settings: {
    sceneName: string;
    websocketAddress: string;
    websocketPassword: string;
  } | null = null;

  start() {
    this.popoutWindowStore = BdApi.findModule(
      (f) => f?.constructor?.persistKey == "PopoutWindowStore"
    );
    this.popoutWindowStore.addChangeListener(
      this.handlePopoutWindowStoreChanged
    );

    this.settings = Object.assign(
      {},
      defaultSettings,
      BdApi.loadData(pluginName, "settings")
    );

    this.obs.on("ConnectionOpened", () => {
      console.log("connection opened!");
      this.connected = true;
    });
    this.obs.on("ConnectionClosed", (e) => {
      console.log("connection closed", e.code, e.message);
      this.connected = false;
      if (e.code !== 1000) {
        setTimeout(() => this.tryConnect(), 1500);
      }
    });
    this.obs.on("ConnectionError", (e) => {
      console.log("connection error");
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

  onSettingsSceneNameBlur = () => {
    if (this.settings!.sceneName !== this.settingsDomSceneName!.value) {
      this.settings!.sceneName = this.settingsDomSceneName!.value;
      BdApi.saveData(pluginName, "settings", this.settings);
    }
  };

  onSettingsWebsocketAddressBlur = async () => {
    if (
      this.settings!.websocketAddress !==
      this.settingsDomWebsocketAddress!.value
    ) {
      this.settings!.websocketAddress = this.settingsDomWebsocketAddress!.value;
      BdApi.saveData(pluginName, "settings", this.settings);
      if (this.connected) {
        await this.obs.disconnect();
        this.tryConnect();
      }
    }
  };

  onSettingsWebsocketPasswordBlur = async () => {
    if (
      this.settings!.websocketPassword !==
      this.settingsDomWebsocketPassword!.value
    ) {
      this.settings!.websocketPassword =
        this.settingsDomWebsocketPassword!.value;
      BdApi.saveData(pluginName, "settings", this.settings);
      if (this.connected) {
        await this.obs.disconnect();
        this.tryConnect();
      }
    }
  };

  getSettingsPanel() {
    this.settingsDom ??= (() => {
      const tpl = genearteSettingsTemplate();

      this.settingsDomSceneName = tpl.querySelector(
        "#discordStreamingOverlaySettingsSceneName"
      )!;
      this.settingsDomWebsocketAddress = tpl.querySelector(
        "#discordStreamingOverlaySettingsWebsocketAddress"
      )!;
      this.settingsDomWebsocketPassword = tpl.querySelector(
        "#discordStreamingOverlaySettingsWebsocketPassword"
      )!;

      this.settingsDomSceneName.addEventListener(
        "blur",
        this.onSettingsSceneNameBlur
      );
      this.settingsDomWebsocketAddress.addEventListener(
        "blur",
        this.onSettingsWebsocketAddressBlur
      );
      this.settingsDomWebsocketPassword.addEventListener(
        "blur",
        this.onSettingsWebsocketPasswordBlur
      );

      return tpl;
    })();

    this.settingsDomSceneName!.value = this.settings!.sceneName;
    this.settingsDomWebsocketAddress!.value = this.settings!.websocketAddress;
    this.settingsDomWebsocketPassword!.value = this.settings!.websocketPassword;

    return this.settingsDom;
  }

  async tryConnect() {
    try {
      console.log(
        this.settings!.websocketAddress,
        this.settings!.websocketPassword
      );
      await this.obs.connect(
        this.settings!.websocketAddress,
        this.settings!.websocketPassword
      );
    } catch (e) {}
  }

  async findInputByName(inputKind: string, inputName: string) {
    const { inputs } = await this.obsCall("GetInputList", { inputKind });
    return inputs.find((i: any) => i.inputName == inputName) ?? null;
  }

  async findInput(sceneName: string, windowName: string) {
    let discordObs = await this.findInputByName("window_capture", "DiscordObs");

    if (!discordObs) {
      await this.obsCall("CreateInput", {
        sceneName,
        inputName: "DiscordObs",
        inputKind: "window_capture",
        sceneItemEnabled: false,
        inputSettings: {
          window: `${windowName}:Chrome_WidgetWin_1:Discord.exe`,
        },
      });
      return await this.findInputByName("window_capture", "DiscordObs");
    }

    const expectedWindowName = `${windowName}:Chrome_WidgetWin_1:Discord.exe`;
    const inputSettings = await this.obsCall("GetInputSettings", {
      inputName: discordObs.inputName as string,
    });
    if (inputSettings.inputSettings.window !== expectedWindowName) {
      await this.obsCall("SetInputSettings", {
        inputName: discordObs.inputName as string,
        inputSettings: {
          window: `${windowName}:Chrome_WidgetWin_1:Discord.exe`,
        },
      });
    }

    return discordObs;
  }

  obsCall<Type extends keyof OBSRequestTypes>(
    requestType: Type,
    requestData?: OBSRequestTypes[Type]
  ): Promise<OBSResponseTypes[Type]> {
    return this.obs.call(requestType as any, requestData as any);
  }

  async handleVideos(popup: Window, videos: Element[]) {
    if (!this.connected) return;

    const sceneName = this.settings!.sceneName;
    const discordObs = await this.findInput(sceneName, popup.document.title);

    if (!discordObs) {
      // failed to create
      return;
    }

    const { sceneItems } = await this.obsCall("GetSceneItemList", {
      sceneName,
    });

    const targets = sceneItems.filter(
      (x) =>
        typeof x.sourceName === "string" &&
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
          x: sceneItemTransform.positionX as number,
          y: sceneItemTransform.positionY as number,
          width: sceneItemTransform.width as number,
          height: sceneItemTransform.height as number,
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
        sceneItemId: video.id as number,
      });
      video.enabled = enabled.sceneItemEnabled;
    }

    let realSource = oldVideos.find((x) => !x.enabled)!.id as number;
    oldVideos = oldVideos.filter((x) => x.id !== realSource);

    for (const { id } of oldVideos.slice(expectedVideos.length)) {
      await this.obsCall("RemoveSceneItem", {
        sceneName,
        sceneItemId: id as number,
      });
    }

    for (let i = 0; i < expectedVideos.length; i++) {
      const { bounds, target } = expectedVideos[i];
      const sceneItemId =
        oldVideos.length > i
          ? (oldVideos[i].id as number)
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
      await this.obsCall("SetSceneItemLocked", {
        sceneName,
        sceneItemId,
        sceneItemLocked: true,
      });
    }
    await this.obsCall("SetSceneItemLocked", {
      sceneName,
      sceneItemId: realSource,
      sceneItemLocked: true,
    });
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
      element.sheet?.insertRule(`[class*=videoControls-] { display: none; }`);

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
