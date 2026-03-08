/**
 * Web ビルド用の @capacitor/app モック。
 * next.config で @capacitor/app をここに差し替え、Web では npm に @capacitor/app が無くてもビルドを通す。
 */
export const App = {
  async getLaunchUrl() {
    return { url: undefined };
  },
  addListener(_event: string, _handler: (event: { url: string }) => void) {
    return Promise.resolve({ remove: () => {} });
  },
};
