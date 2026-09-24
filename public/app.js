const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const avatar=u=>u?.avatar?\`https://cdn.discordapp.com/avatars/\${u.id}/\${u.avatar}.png?size=96\`:"https://cdn.discordapp.com/embed/avatars/0.png";
const channelIcon=t=>t===2?"🔊":t===13?"◈":t===15?"▤":"#";
const channelType=t=>t===2?"Voice channel":t===13?"Stage channel":t===15?"Forum channel":t===5?"Announcement":"Text channel";
let allChannels=[];
function groupChannels(channels){
 const usable=channels.filter(c=>[0,2,5,13,15].includes(c.type)),cats=new Map(channels.filter(c=>c.type===4).map(c=>[c.id,c])),groups=new Map();
 usable.forEach(c=>{const k=c.parent_id||"__root";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c)});
 const out=[];if(groups.has("__root"))out.push({cat:null,items:groups.get("__root")});cats.forEach((cat,id)=>{if(groups.has(id))out.push({cat,items:groups.get(id)})});return out;
}
function renderSideChannels(channels){$("#sideChannels").innerHTML=groupChannels(channels).map(g=>{const title=g.cat?\`<div class="side-cat"><span>◇</span><b>\${esc(g.cat.name)}</b><i>⌄</i></div>\`:"";return title+g.items.map(c=>\`<button class="side-link \${c.type===2?"voice":""}" data-channel="\${c.id}"><span>\${channelIcon(c.type)}</span><span>\${esc(c.name)}</span></button>\`).join("")}).join("")}
function renderChannels(channels){
 const groups=groupChannels(channels);
 $("#channelGrid").innerHTML=groups.map(g=>{const title=g.cat?\`<div class="channel-category"><span>◇</span><b>\${esc(g.cat.name)}</b><small>\${g.items.length} channels</small></div>\`:"";const items=g.items.map(c=>\`<button class="channel-card" data-channel="\${c.id}" data-name="\${esc(c.name)}" data-cat="\${esc(g.cat?.name||"Channels")}"><span class="channel-icon">\${channelIcon(c.type)}</span><div><b>\${esc(c.name)}</b><small>\${channelType(c.type)} · Click to open messages</small></div></button>\`).join("");return \`<div class="channel-group">\${title}<div class="channel-group-items">\${items}</div></div>\`}).join("")||\`<div class="channel-card"><span class="channel-icon">!</span><div><b>No channels loaded</b><small>Connect Discord environment variables.</small></div></div>\`;
}
function renderRoles(roles,members){
 const counts={};members.forEach(m=>(m.roles||[]).forEach(id=>counts[id]=(counts[id]||0)+1));
 const list=roles.filter(r=>!r.managed).sort((a,b)=>b.position-a.position);
 $("#roleGrid").innerHTML=list.map(r=>{const color=r.color&&r.color!==0?"#"+r.color.toString(16).padStart(6,"0"):"#aaa";return \`<div class="role-card"><span class="role-dot" style="background:\${color}"></span><div><b>\${esc(r.name)}</b><small>\${counts[r.id]||0} members · \${r.permissions?"Discord role":""}</small></div><strong style="color:\${color}">@\${esc(r.name)}</strong></div>\`}).join("")||"<div class=\"role-card\"><b>No roles loaded</b></div>";
}
function renderMembers(members,ownerId){
 const list=members.slice(0,60);
 $("#memberGrid").innerHTML=list.map(m=>{const u=m.user||{},name=u.global_name||u.username||"Member";return \`<div class="member-card"><img class="avatar" src="\${avatar(u)}" alt=""><div><b>\${esc(name)}</b><small>\${u.id===ownerId?"Owner":"Member"}</small></div></div>\`}).join("")||\`<div class="member-card"><b>Members will appear here</b></div>\`;
 $("#memberSideList").innerHTML=list.slice(0,25).map(m=>{const u=m.user||{},name=u.global_name||u.username||"Member";return \`<div class="side-member"><img class="side-avatar" src="\${avatar(u)}" alt=""><span class="status-dot"></span><div><b>\${esc(name)}</b><small>Community member</small></div></div>\`}).join("");$("#memberTotal").textContent=list.length;
}
async function openChannel(id,name,cat){
 $("#messageModal").classList.add("open");$("#modalTitle").textContent="# "+name;$("#modalCategory").textContent=cat.toUpperCase();$("#messageList").innerHTML="<div class=\"message-loading\">Loading latest messages…</div>";
 try{const r=await fetch("/api/channel/"+encodeURIComponent(id)+"/messages");const data=await r.json();if(!r.ok)throw new Error(data.error);$("#messageList").innerHTML=data.length?data.map(m=>\`<article class="message"><img src="\${avatar(m.author)}"><div><div class="message-meta"><b>\${esc(m.author.global_name||m.author.username||"Member")}</b><time>\${new Date(m.timestamp).toLocaleString()}</time></div><p>\${esc(m.content)||"<i>Attachment / embed</i>"}</p>\${(m.attachments||[]).map(a=>\`<a href="\${a.url}" target="_blank" rel="noreferrer">📎 \${esc(a.name)}</a>\`).join("<br>")}</div></article>\`).join(""):"<div class=\"message-loading\">No messages found in this channel.</div>"}catch(e){$("#messageList").innerHTML=\`<div class="message-loading">Messages unavailable. Check the bot's View Channel and Read Message History permissions.</div>\`}}
document.addEventListener("click",e=>{const el=e.target.closest("[data-channel]");if(el)openChannel(el.dataset.channel,el.dataset.name||el.textContent.trim(),el.dataset.cat||"Channel")});
$("#closeModal")?.addEventListener("click",()=>$("#messageModal").classList.remove("open"));$("#messageModal")?.addEventListener("click",e=>{if(e.target.id==="messageModal")e.currentTarget.classList.remove("open")});
async function loadAdmin(){
 const status=$("#adminStatus"),gate=$("#adminGate"),panel=$("#adminPanel"); if(!status||!gate||!panel)return;
 try{const r=await fetch("/api/admin",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error);
  if(!d.viewer.loggedIn){status.textContent="Login required";gate.innerHTML='<div class="admin-notice"><b>Discord login required</b><span>Sign in with Discord to verify your server permissions.</span><a class="action-pill" href="/api/login">Login with Discord</a></div>';panel.style.display="none";return}
  if(!d.viewer.isMember){status.textContent="Not a server member";gate.innerHTML='<div class="admin-notice"><b>Server membership required</b><span>Your Discord account is not a member of this community.</span></div>';panel.style.display="none";return}
  status.textContent=d.viewer.canManage?"Access verified":"Read-only access";gate.innerHTML=d.viewer.canManage?'<div class="admin-notice verified"><b>Administration access verified</b><span>Management access is based on your Discord server roles.</span></div>':'<div class="admin-notice"><b>Read-only administration view</b><span>You can inspect roles and permissions, but management access is not enabled for your account.</span></div>';
  panel.style.display="block";
  $("#adminSummary").innerHTML=[["SERVER",d.guild.name],["YOUR ROLES",d.viewer.roles.length?d.viewer.roles.join(", "):"@everyone"],["PERMISSIONS",d.viewer.permissions.length],["ACCESS",d.viewer.canManage?"MANAGEMENT":"READ ONLY"]].map(x=>`<div><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join("");
  $("#adminRoles").innerHTML=d.roles.map(r=>`<div class="admin-role"><span class="role-dot" style="background:#${(r.color||0).toString(16).padStart(6,"0")}"></span><div><b>${esc(r.name)}</b><small>Position ${r.position} · ${r.permissions.length} permissions</small><p>${r.permissions.length?r.permissions.map(esc).join(" · "):"No elevated permissions"}</p></div>${r.administrator?'<strong>ADMIN</strong>':""}</div>`).join("");
  const perms=["Administrator","Manage Server","Manage Channels","Manage Roles","Kick Members","Ban Members","Moderate Members","Manage Messages","Mention Everyone","View Audit Log"];
  $("#permissionList").innerHTML=perms.map(p=>`<div class="permission-item"><span>${esc(p)}</span><b>${d.viewer.permissions.includes(p)?"GRANTED":"—"}</b></div>`).join("");
 }catch(e){status.textContent="Unavailable";gate.innerHTML='<div class="admin-notice"><b>Administration data unavailable</b><span>Check Discord bot configuration and permissions.</span></div>';panel.style.display="none"}}
async function load(){
 try{
  const r=await fetch("/api/server",{cache:"no-store"});if(!r.ok)throw new Error("Discord API");
  const d=await r.json(),g=d.guild||{},channels=d.channels||[],members=d.members||[],roles=d.roles||[];allChannels=channels;
  $("#guildMeta").textContent=\`\${g.approximate_member_count??members.length} Members · Community\`;$("#membersCount").textContent=g.approximate_member_count??members.length;$("#onlineCount").textContent=g.approximate_presence_count??"—";$("#onlineMini").textContent=g.approximate_presence_count??"—";$("#channelsCount").textContent=channels.filter(c=>[0,2,4,5,13,15].includes(c.type)).length;$("#boostCount").textContent=\`\${g.premium_subscription_count??0}/\${g.premium_tier?g.premium_tier*14:36}\`;
  $("#join").href="/api/invite";$("#join2").href="/api/invite";renderSideChannels(channels);renderChannels(channels);renderRoles(roles,members);renderMembers(members,g.owner_id);
 }catch(e){$("#channelHint").textContent="Discord connection pending";$("#channelGrid").innerHTML=\`<div class="channel-card"><span class="channel-icon">!</span><div><b>Connect Discord to load live data</b><small>Add the Render Discord environment variables.</small></div></div>\`}}
$("#menuBtn")?.addEventListener("click",()=>document.body.classList.toggle("menu-open"));load();loadAdmin();setInterval(load,60000);setInterval(loadAdmin,60000);