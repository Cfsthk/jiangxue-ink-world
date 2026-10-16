// Historical milestones are factual; the lost luggage and farewell letter are teaching fiction.
export const LUGGAGE = Object.freeze([
  { id:'hat', name:'官帽', place:'山頂附近・掛雪的枯樹', action:'搖動樹幹', duration:2.1, x:-49,z:-13,
    title:'曾在朝廷任職',year:'離京以前・在朝為官',text:'柳宗元曾在京城做官，後來擔任禮部員外郎。他和其他官員商議國事，原本有機會施展自己的抱負。', detail:'這頂帽子，讓人想起他在京城任職的日子。' },
  { id:'scroll', name:'改革文稿卷筒', place:'山背曲徑・兩石之間', action:'挪開小石', duration:1.7, x:-35,z:-42,
    title:'與同伴一起推動改革',year:'805 年・永貞革新',text:'柳宗元和王叔文等人參與政治改革，希望改善朝政。他有一起商議、一起做事的同伴，也有想實現的理想。', detail:'筒中的文稿是教學示意，帶出他參與改革的往事。' },
  { id:'decree', name:'貶官文書', place:'西側林徑・薄雪下的繫帶', action:'挖開積雪', duration:2.2, x:-61,z:20,
    title:'改革失敗，被迫離京',year:'805 年・朝局改變',text:'支持改革的唐順宗退位後，唐憲宗即位，改革派受到處分。柳宗元也被貶官，必須離開熟悉的長安，前往遠方。', detail:'他的人生方向，突然被改變了。' },
  { id:'map', name:'行程布地圖', place:'東側江灣・壓在枯枝下', action:'移開枯枝，拉出地圖', duration:1.9, x:-11,z:35,
    title:'路上，又收到新的去向',year:'805 年・從邵州改往永州',text:'柳宗元原本被貶為邵州刺史。在前往邵州的途中，又被改貶為永州司馬。地點和職位再次改變，這段遠行不能由他自己決定。', detail:'攤開地圖，舊路線停在邵州，新路線轉往永州。' },
  { id:'farewell', name:'舊友送別信', place:'江岸・望見孤舟的蘆葦旁', action:'撥開蘆葦，解開繫帶', duration:2.0, x:-5.7,z:-25.5,
    title:'故人遠，前路長',year:'遠行途中・一封送別信',text:'「這次分別，不知何日才能再見。路途遙遠，望你珍重。」', detail:'這封送別信是遊戲創作。從前一起商議國事的同伴，如今各散遠方；他帶着思念，繼續走向陌生的永州。' },
].map(Object.freeze));

// Each pickup advances the biography; the five keepsakes return together at the end.
export function createJourneyState() {
  const statuses = Object.fromEntries(LUGGAGE.map(item => [item.id,'covered']));
  const storiesRead=new Set();
  const count = status => Object.values(statuses).filter(s=>status==='collected' ? s==='collected'||s==='returned' : s===status).length;
  const activeId = () => LUGGAGE.find(i=>!['collected','returned'].includes(statuses[i.id]))?.id ?? null;
  const readyToReturn = () => count('collected')===LUGGAGE.length && count('returned')===0;
  const unlocked = id => Object.hasOwn(statuses,id) && (id===activeId() || ['collected','returned'].includes(statuses[id]));
  return {
    get collected() { return count('collected'); },
    get returned() { return count('returned'); },
    get readyToReturn() { return readyToReturn(); },
    get complete() { return count('returned')===LUGGAGE.length; },
    get activeId() { return activeId(); },
    status: id => statuses[id],
    unlocked,
    begin(id) {
      if(!unlocked(id) || statuses[id]!=='covered')return false;
      statuses[id]='working';return true;
    },
    reveal(id) {
      if(statuses[id]!=='working')return false;
      statuses[id]='ready';return true;
    },
    pickup(id) {
      if(!unlocked(id) || statuses[id]!=='ready')return false;
      statuses[id]='collected';storiesRead.add(id);return true;
    },
    deposit() {
      if(!readyToReturn())return null;
      const ids=LUGGAGE.map(item=>item.id);
      for(const id of ids)statuses[id]='returned';
      return ids;
    },
    reset() { storiesRead.clear();for(const item of LUGGAGE)statuses[item.id]='covered'; },
    snapshot() { return {collected:count('collected'),activeId:activeId(),returned:count('returned'),readyToReturn:readyToReturn(),complete:count('returned')===LUGGAGE.length,letterUnlocked:unlocked('farewell'),storiesRead:[...storiesRead],items:LUGGAGE.map(i=>({id:i.id,name:i.name,status:statuses[i.id],unlocked:unlocked(i.id),x:i.x,z:i.z}))}; },
  };
}
