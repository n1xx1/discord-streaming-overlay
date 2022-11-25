export function genearteSettingsTemplate() {
  const tpl = html`
    <div class="bd-settings-group">
      <h2 class="bd-settings-title bd-settings-group-title">General</h2>
      <div class="bd-settings-container">
        <div class="bd-setting-item inline">
          <div class="bd-setting-header">
            <label
              for="discordStreamingOverlaySettingsSceneName"
              class="bd-setting-title"
            >
              Scene Name
            </label>
            <input
              class="bd-text-input"
              name="discordStreamingOverlaySettingsSceneName"
              id="discordStreamingOverlaySettingsSceneName"
            />
          </div>
          <div class="bd-setting-note">
            The name (or names, separated by commas) of the scenes managed by
            the plugin
          </div>
          <div class="bd-setting-divider"></div>
        </div>
        <div class="bd-setting-item inline">
          <div class="bd-setting-header">
            <label
              for="discordStreamingOverlaySettingsWebsocketAddress"
              class="bd-setting-title"
            >
              Websocket Address
            </label>
            <input
              class="bd-text-input"
              name="discordStreamingOverlaySettingsWebsocketAddress"
              id="discordStreamingOverlaySettingsWebsocketAddress"
            />
          </div>
          <div class="bd-setting-note">
            Address of the obs-websocket plugin server.
          </div>
          <div class="bd-setting-divider"></div>
        </div>
        <div class="bd-setting-item inline">
          <div class="bd-setting-header">
            <label
              for="discordStreamingOverlaySettingsWebsocketPassword"
              class="bd-setting-title"
            >
              Websocket Password
            </label>
            <input
              class="bd-text-input"
              name="discordStreamingOverlaySettingsWebsocketPassword"
              id="discordStreamingOverlaySettingsWebsocketPassword"
            />
          </div>
          <div class="bd-setting-note">
            Password for the obs-websocket plugin server.
          </div>
          <div class="bd-setting-divider"></div>
        </div>
      </div>
    </div>
  `;

  const ret = document.createElement("div");
  ret.innerHTML = tpl;
  return ret;
}

const html = (strings: TemplateStringsArray, ...values: any[]) =>
  String.raw({ raw: strings }, ...values);
