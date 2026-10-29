import zh from "../../locales/zh-CN.json";
import en from "../../locales/en.json";
export const messages = {"zh-CN":zh,en} as const;
export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof messages["zh-CN"];
export const supportedLocales:Locale[]=["zh-CN","en"];
export function detectLocale(value:string):Locale {return value.toLowerCase().startsWith("zh")?"zh-CN":"en";}
export function translate(locale:Locale,key:MessageKey,variables:Record<string,string>={}):string {
 const template:string=messages[locale][key] || messages["zh-CN"][key];
 return template.replace(/\{(\w+)\}/g,(_,k:string)=>variables[k]??"");
}
