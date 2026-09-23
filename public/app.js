const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const avatar=u=>u?.avatar?\`https://cdn.discordapp.com/avatars/\${u.id}/\${u.avatar}.png?size=96\`:"https://cdn.discordapp.com/embed/avatars/0.png";
const channelIcon=t=>t===2?"🔊":t===13?"◈":t===15?"▤":"#";
const channelType=t=>t===2?"Voice channel":t===13?"Stage channel":t===15?"Forum channel":t===5?"Announcement":"Text channel";

function renderSideChannels(channels){
  const box=$("#sideChannels");
  const usable=channels.filter(c=>[0,2,5,13,15].includes(c.type));
  const cats={};
  usable.forEach(c=>{(cats[c.parent_id||"root"]??=[]).push(c)});
  const categoryMap=new Map(channels.filter(c=>c.type===4).map(c=>[c.id,c]));
  const ordered=[];
  Object.keys(cats).forEach(id=>{
    if(id!=="root"&&categoryMap.has(id)) ordered.push({cat:categoryMap.get(id),items:cats[id]});
    else if(id==="root") ordered.unshift({cat:null,items:cats[id]});
  });
  box.innerHTML=ordered.map(group=>{
    const title=group.cat?\`<div class="side-cat"><span>◇</span><b>\${esc(group.cat.name)}</b><i>⌄</i></div>\`:"";
    return title+group.items.slice(0,18).map(c=>\`<div class="side-link \${c.type===2?"voice":""}"><span>\${channelIcon(c.type)}</span><span>\${esc(c.name)}</span></div>\`).join("");
  }).join("");
}
function renderChannels(channels){
  $("#channelGrid").innerHTML=channels.filter(c=>[0,2,5,13,15].includes(c.type)).slice(0,40).map(c=>\`<a class="channel-card" href="#channels"><span class="channel-icon">\${channelIcon(c.type)}</span><div><b>\${esc(c.name)}</b><small>\${channelType(c.type)}</small></div></a>\`).join("")||\`<div class="channel-card"><span class="channel-icon">#</span><div><b>No channels loaded</b><small>Connect the Discord environment variables in Render.</small></div></div>\`;
}
function renderMembers(members,ownerId){
  const list=members.slice(0,60);
  const html=list.map(m=>{
    const u=m.user||{}, name=u.global_name||u.username||"Member", isOwner=u.id===ownerId;
    return \`<div class="member-card"><img class="avatar" src="\${avatar(u)}" alt=""><div><b>\${esc(name)}</b><small>\${isOwner?"Owner":"Member"}</small></div></div>\`;
  }).join("");
  $("#memberGrid").innerHTML=html||\`<div class="member-card"><div><b>Members will appear here</b><small>Discord connection pending</small></div></div>\`;
  $("#memberSideList").innerHTML=list.slice(0,25).map(m=>{
    const u=m.user||{}, name=u.global_name||u.username||"Member";
    return \`<div class="side-member"><img class="side-avatar" src="\${avatar(u)}" alt=""><span class="status-dot"></span><div><b>\${esc(name)}</b><small>Community member</small></div></div>\`;
  }).join("");
  $("#memberTotal").textContent=list.length;
}
async function load(){
  try{
    const r=await fetch("/api/server",{cache:"no-store"});
    if(!r.ok) throw new Error("Discord API");
    const d=await r.json(), g=d.guild||{}, channels=d.channels||[], members=d.members||[];
    $("#membersCount").textContent=g.approximate_member_count??members.length;
    $("#onlineCount").textContent=g.approximate_presence_count??"—";
    $("#onlineMini").textContent=g.approximate_presence_count??"—";
    $("#channelsCount").textContent=channels.length;
    $("#memberTotal").textContent=g.approximate_member_count??members.length;
    $("#boostCount").textContent=\`\${g.premium_subscription_count??0}/\${g.premium_tier?g.premium_tier*14:36}\`;
    const invite=g.vanity_url_code?\`https://discord.gg/\${g.vanity_url_code}\`:"#";
    $("#join").href=invite; $("#join2").href=invite;
    renderSideChannels(channels); renderChannels(channels); renderMembers(members,g.owner_id);
  }catch(e){
    $("#channelHint").textContent="Discord connection pending";
    $("#channelGrid").innerHTML=\`<div class="channel-card"><span class="channel-icon">!</span><div><b>Connect Discord to load live data</b><small>Add DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and the other Render variables.</small></div></div>\`;
    $("#memberSideList").innerHTML=\`<div class="side-member"><div><b>Waiting for Discord</b><small>Render environment setup</small></div></div>\`;
  }
}
$("#menuBtn")?.addEventListener("click",()=>document.body.classList.toggle("menu-open"));
load();setInterval(load,60000);