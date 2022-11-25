/**
 * @name PluginOrThemeName
 * @version 0.0.1
 * @description Just a simple description of the content that may
 * end up being pretty long
 * @author Author
 *
 * @website http://twitter.com/BandagedBD
 */

module.exports = class ExamplePlugin {
  connected = false;
  start() {
    connected = false;
    this.doStart();
  }
  async doStart() {
    // await loadObsWebsocket();
    console.log("Started!");
    this.popoutWindowStore = BdApi.findModule(
      (f) => f.default.constructor.persistKey == "PopoutWindowStore"
    ).default;
    this.obs = new OBSWebSocket();

    try {
      await this.obs.connect("ws://127.0.0.1:4444", "92sRowmvd6Y9GDxn");
      this.popoutWindowStore.addChangeListener(
        this.handlePopoutWindowStoreChanged
      );
    } catch (e) {
      console.dir(e);
    }
  }
  stop() {
    this.popoutWindowStore.removeChangeListener(
      this.handlePopoutWindowStoreChanged
    );
    if (this.interval) window.clearInterval(this.interval);
    this.obs?.disconnect?.();
    this.obs = null;
    console.log("Stopped!");
  }

  observer(changes) {
    // console.log(changes);
  }
  async handleVideos(popup, videos) {
    const { currentProgramSceneName: sceneName } = await this.obs.call(
      "GetSceneList"
    );
    const { inputs } = await this.obs.call("GetInputList", {
      inputKind: "window_capture",
    });
    const discordObs = inputs.find((i) => i.inputName == "DiscordObs");
    const { sceneItems } = await this.obs.call("GetSceneItemList", {
      sceneName,
    });

    const oldVideos = sceneItems.filter(
      ({ inputKind, sourceName }) =>
        inputKind === "window_capture" && sourceName === discordObs.inputName
    );

    for (const { sceneItemId } of oldVideos.slice(videos.length)) {
      await this.obs.call("RemoveSceneItem", { sceneName, sceneItemId });
    }

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const title = video.querySelector("[class*=overlayTitleText-]");
      const name = title.innerText;
      const { top, bottom, left, right } = video.getBoundingClientRect();

      const sceneItemId =
        oldVideos.length > i
          ? oldVideos[i].sceneItemId
          : await this.obs.call("CreateSceneItem", {
              sceneName,
              sourceName: discordObs.inputName,
            });

      const {
        sceneItemTransform: { sourceHeight, sourceWidth },
      } = await this.obs.call("GetSceneItemTransform", {
        sceneName,
        sceneItemId,
      });

      const sceneItemTransform = {
        cropTop: (top / popup.innerHeight) * sourceHeight,
        cropBottom:
          ((popup.innerHeight - bottom) / popup.innerHeight) * sourceHeight,
        cropLeft: (left / popup.innerWidth) * sourceWidth,
        cropRight:
          ((popup.innerWidth - right) / popup.innerWidth) * sourceWidth,
      };
      await this.obs.call("SetSceneItemTransform", {
        sceneName,
        sceneItemId,
        sceneItemTransform,
      });
    }
  }
  handlePopoutWindowStoreChanged = () => {
    const popup = this.popoutWindowStore.getWindow(
      "DISCORD_CHANNEL_CALL_POPOUT"
    );
    if (this.interval) window.clearInterval(this.interval);

    // popup.document.title

    if (popup) {
      const func = () => {
        const videos = popup.document.querySelectorAll(
          "[class*=tile-][class*=videoLayer-]"
        );
        this.handleVideos(popup, [...videos]);
      };
      func();
      this.interval = window.setInterval(func, 2000);
    }
  };
};
