export const messages = {
  "zh-CN": {
    title:"模型中心",subtitle:"选择、下载和管理 AI 抠图模型。模型不预装在安装包中。",
    refresh:"刷新模型",loading:"正在读取模型列表…",ready:"已安装",missing:"待下载",
    search:"搜索模型名称或用途",all:"全部",installed:"已安装",notInstalled:"未安装",
    empty:"未找到符合条件的模型",download:"一键下载",installedButton:"已就绪",
    licenseImport:"需授权后手动导入",licenseHint:"使用前请确认模型许可证",
    start:"选择模型，首次下载完成后可离线使用。",fetchError:"模型目录读取失败",
    downloading:"正在后台下载 {name}，请保持应用开启…",startError:"下载启动失败",
    statusError:"下载状态不可用",downloadError:"下载失败",finished:"{name} 已就绪，可离线使用",
    timeout:"下载仍在进行，请稍后重新打开查看。",checking:"下载并校验文件中（不显示虚假百分比）…",
    footer:"组件：shadcn/ui 风格、Radix UI、Tailwind CSS。模型许可证以原提供方条款为准。",
    language:"语言",back:"返回工作台",total:"模型总数",available:"已安装",requiresDownload:"待准备",
    unknown:"第三方模型",permission:"权限与许可",network:"首次下载需要联网",error:"操作失败",
  },
  "en": {
    title:"Model Library",subtitle:"Discover, download and manage background-removal models. We don't bundle model weights.",
    refresh:"Refresh",loading:"Loading model library…",ready:"Installed",missing:"Not installed",
    search:"Search models or use cases",all:"All",installed:"Installed",notInstalled:"Not installed",
    empty:"No matching models found",download:"Download model",installedButton:"Ready to use",
    licenseImport:"Import with permission",licenseHint:"Check the model license before use",
    start:"Choose a model. Once downloaded, it can work offline.",fetchError:"Couldn't load model library",
    downloading:"Downloading {name} in the background. Keep the app open…",startError:"Failed to start download",
    statusError:"Couldn't retrieve download status",downloadError:"Download failed",finished:"{name} is ready for offline use",
    timeout:"Download is still running. Check again later.",checking:"Downloading and verifying (no estimated percentage)…",
    footer:"UI: shadcn-style components, Radix UI and Tailwind CSS. Model licenses are set by their owners.",
    language:"Language",back:"Back to studio",total:"Models",available:"Installed",requiresDownload:"To prepare",
    unknown:"Third-party model",permission:"License & permissions",network:"Initial download requires internet",error:"Operation failed",
  }
} as const;
export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof messages["zh-CN"];
export const supportedLocales: Locale[] = ["zh-CN","en"];
export function detectLocale(value:string):Locale {return value.toLowerCase().startsWith("zh")?"zh-CN":"en";}
export function translate(locale:Locale,key:MessageKey,variables:Record<string,string>={}):string {
  const template:string = messages[locale][key];
  return template.replace(/\{(\w+)\}/g,(_,k:string)=>variables[k]??"");
}
