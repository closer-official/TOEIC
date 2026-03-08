/**
 * Web 用はモックを返す。iOS ビルド時は prepare-ios-build.js がこのファイルを
 * 「export { App } from "@capacitor/app"」に差し替える。
 */
export { App } from './capacitor-app-mock';
