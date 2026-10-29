import {useEffect,useState} from "react";
import {detectLocale,supportedLocales,translate,type Locale,type MessageKey} from "./messages";
const key="rembg-studio-locale";
function initialLocale():Locale {
 try {const saved=localStorage.getItem(key);if(saved && supportedLocales.includes(saved as Locale))return saved as Locale;}catch {/* storage unavailable */}
 return detectLocale(navigator.language);
}
export function useLocale(){
 const [locale,setLocale]=useState<Locale>(initialLocale);
 useEffect(()=>{document.documentElement.lang=locale;document.title=locale==="zh-CN"?"Rembg Studio · 模型中心":"Rembg Studio · Model Library";try{localStorage.setItem(key,locale)}catch {/* storage unavailable */}},[locale]);
 const t=(name:MessageKey,variables?:Record<string,string>)=>translate(locale,name,variables);
 return {locale,setLocale,t};
}
