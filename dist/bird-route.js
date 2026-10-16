// A small reusable walkability graph. Paths favour the painted roads, check
// intervening collisions, and never use an unwalkable straight-line fallback.
class MinHeap {
  constructor(){this.items=[];}
  push(value){const a=this.items;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=value.f)break;a[i]=a[p];i=p;}a[i]=value;}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
  get length(){return this.items.length;}
}

export function createBirdRoute({canWalk,heightAt,roads=[],bounds={minX:-72,maxX:-2,minZ:-72,maxZ:68},step=2}){
  const nx=Math.floor((bounds.maxX-bounds.minX)/step)+1,nz=Math.floor((bounds.maxZ-bounds.minZ)/step)+1;
  const nodes=Array.from({length:nx*nz},(_,id)=>{
    const x=bounds.minX+(id%nx)*step,z=bounds.minZ+Math.floor(id/nx)*step;
    if(!canWalk(x,z))return null;
    let road2=Infinity;
    for(const p of roads)road2=Math.min(road2,(p.x-x)**2+(p.z-z)**2);
    return {id,x,z,y:heightAt(x,z),cost:1+Math.min(2.2,Math.max(0,Math.sqrt(road2)-1.3)*.28),links:[]};
  });
  function clear(a,b){
    const distance=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(distance/.45));
    for(let i=0;i<=n;i++){const t=i/n;if(!canWalk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
    return true;
  }
  for(const node of nodes){
    if(!node)continue;
    const ix=node.id%nx,iz=Math.floor(node.id/nx);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if((!dx&&!dz)||ix+dx<0||ix+dx>=nx||iz+dz<0||iz+dz>=nz)continue;
      const next=nodes[(iz+dz)*nx+ix+dx];
      if(next&&clear(node,next))node.links.push({id:next.id,cost:Math.hypot(dx,dz)*step*(node.cost+next.cost)*.5+Math.abs(node.y-next.y)*.7});
    }
  }
  function nearest(point){
    return nodes.filter(Boolean).map(n=>({n,d:(n.x-point.x)**2+(n.z-point.z)**2})).sort((a,b)=>a.d-b.d).find(({n,d})=>d<=step*step*9&&clear(point,n))?.n;
  }
  function find(start,goal){
    const a=nearest(start),b=nearest(goal);if(!a||!b)return [];
    const costs=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),heap=new MinHeap();
    costs[a.id]=0;heap.push({id:a.id,f:Math.hypot(a.x-b.x,a.z-b.z)});
    const done=new Set();
    while(heap.length){
      const cur=heap.pop();if(done.has(cur.id))continue;done.add(cur.id);
      if(cur.id===b.id)break;
      for(const edge of nodes[cur.id].links){
        const cost=costs[cur.id]+edge.cost;
        if(cost>=costs[edge.id])continue;
        costs[edge.id]=cost;prev[edge.id]=cur.id;const n=nodes[edge.id];
        heap.push({id:edge.id,f:cost+Math.hypot(n.x-b.x,n.z-b.z)});
      }
    }
    if(!Number.isFinite(costs[b.id]))return [];
    const path=[];for(let id=b.id;id!==-1;id=prev[id]){const p=nodes[id];path.push({x:p.x,z:p.z});}
    path.reverse();path.unshift({x:start.x,z:start.z});path.push({x:goal.x,z:goal.z});
    const clean=path.filter((p,i)=>i===0||Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z)>.025),rounded=[clean[0]];
    for(let i=1;i<clean.length-1;i++){
      const a=clean[i-1],b=clean[i],c=clean[i+1],ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z),r=Math.min(.4,ab*.22,bc*.22);
      const entry={x:b.x+(a.x-b.x)*r/ab,z:b.z+(a.z-b.z)*r/ab},exit={x:b.x+(c.x-b.x)*r/bc,z:b.z+(c.z-b.z)*r/bc};
      const curve=[entry,...Array.from({length:5},(_,j)=>{const t=(j+1)/5,s=1-t;return {x:s*s*entry.x+2*s*t*b.x+t*t*exit.x,z:s*s*entry.z+2*s*t*b.z+t*t*exit.z};})];
      const safe=curve.every((p,j)=>clear(j?curve[j-1]:rounded.at(-1),p));
      rounded.push(...(safe?curve:[b]));
    }
    rounded.push(clean.at(-1));return rounded;
  }
  return {find,clear,nodeCount:nodes.filter(Boolean).length};
}

export function routeLength(path){let length=0;for(let i=1;i<path.length;i++)length+=Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z);return length;}
export function pointOnRoute(path,distance){
  if(!path.length)return null;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],length=Math.hypot(a.x-b.x,a.z-b.z);
    if(distance<=length){const t=length?Math.max(0,distance)/length:0;return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};}distance-=length;
  }
  return {...path.at(-1)};
}
export function nearestRouteDistance(path,point){
  let distance=0,best=Infinity,along=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(length*length))):0;
    const d=Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t);
    if(d<best){best=d;along=distance+length*t;}distance+=length;
  }
  return {along,distance:best};
}
