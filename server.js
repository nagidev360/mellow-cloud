import express from "express";
import session from "express-session";
import axios from "axios";
import path from "path";
import {fileURLToPath} from "url";
import "dotenv/config";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(),PORT=process.env.PORT||10000;
app.use(express.json());
app.use(session({secret:process.env.SESSION_SECRET||"change-me",resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax"}}));
app.use(express.static(path.join(__dirname,"public")));
const discord=url=>axios.get(url,{headers:{Authorization:"Bot "+process.env.DISCORD_BOT_TOKEN}});
const discordPost=(url,data={})=>axios.post(url,data,{headers:{Authorization:"Bot "+process.env.DISCORD_BOT_TOKEN,"Content-Type":"application/json"}});
app.get("/api/server",async(_req,res)=>{
 try{
  const id=process.env.DISCORD_GUILD_ID;
  if(!id||!process.env.DISCORD_BOT_TOKEN)return res.status(503).json({configured:false});
  const [g,c,m,r]=await Promise.all([
   discord("https://discord.com/api/v10/guilds/"+id+"?with_counts=true"),
   discord("https://discord.com/api/v10/guilds/"+id+"/channels"),
   discord("https://discord.com/api/v10/guilds/"+id+"/members?limit=1000"),
   discord("https://discord.com/api/v10/guilds/"+id+"/roles")
  ]);
  res.json({configured:true,guild:g.data,channels:c.data,roles:r.data,members:m.data.map(x=>({id:x.user.id,username:x.user.username,global_name:x.user.global_name,avatar:x.user.avatar,roles:x.roles||[]}))});
 }catch(e){res.status(500).json({error:"Discord API error",detail:e.response?.data||e.message});}
});
app.get("/api/channel/:id/messages",async(req,res)=>{
 try{
  const data=await discord("https://discord.com/api/v10/channels/"+req.params.id+"/messages?limit=50");
  res.json(data.data.map(m=>({id:m.id,content:m.content,author:{id:m.author?.id,username:m.author?.username,global_name:m.author?.global_name,avatar:m.author?.avatar},timestamp:m.timestamp,attachments:(m.attachments||[]).map(a=>({url:a.url,name:a.filename}))})).reverse());
 }catch(e){res.status(500).json({error:"Unable to load messages",detail:e.response?.data||e.message});}
});
app.get("/api/invite",async(req,res)=>{
 try{
  const guildId=process.env.DISCORD_GUILD_ID;
  const g=await discord("https://discord.com/api/v10/guilds/"+guildId);
  if(g.data.vanity_url_code)return res.redirect("https://discord.gg/"+g.data.vanity_url_code);
  const channels=await discord("https://discord.com/api/v10/guilds/"+guildId+"/channels");
  const ch=channels.data.find(c=>c.type===0)||channels.data.find(c=>c.type===5);
  if(!ch) return res.status(503).send("No invite-capable channel found.");
  const inv=await discordPost("https://discord.com/api/v10/channels/"+ch.id+"/invites",{max_age:0,max_uses:0,temporary:false});
  res.redirect("https://discord.gg/"+inv.data.code);
 }catch(e){res.status(500).send("Invite could not be created. Check the bot's Create Invite permission.");}
});
app.get("/api/login",(req,res)=>{const p=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||"",response_type:"code",redirect_uri:process.env.DISCORD_REDIRECT_URI||"",scope:"identify guilds"});res.redirect("https://discord.com/oauth2/authorize?"+p)});
app.get("/api/callback",async(req,res)=>{try{
 if(req.query.error)return res.status(400).send("Discord OAuth error: "+String(req.query.error));
 const clientId=process.env.DISCORD_CLIENT_ID?.trim(),clientSecret=process.env.DISCORD_CLIENT_SECRET?.trim(),redirectUri=process.env.DISCORD_REDIRECT_URI?.trim();
 if(!clientId||!clientSecret||!redirectUri)return res.status(500).send("Discord login is not configured. Check DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI in Render.");
 const code=String(req.query.code||"");if(!code)return res.status(400).send("Discord OAuth code is missing.");
 const t=await axios.post("https://discord.com/api/v10/oauth2/token",new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"authorization_code",code,redirect_uri:redirectUri}),{headers:{"Content-Type":"application/x-www-form-urlencoded"}});
 const me=await axios.get("https://discord.com/api/v10/users/@me",{headers:{Authorization:"Bearer "+t.data.access_token}});
 req.session.user=me.data;res.redirect("/");
}catch(e){
 const d=e.response?.data;console.error("Discord OAuth callback failed",{status:e.response?.status,code:d?.error,description:d?.error_description,message:e.message});
 const reason=d?.error_description||d?.message||e.message||"Unknown OAuth error";
 res.status(500).send("Discord login failed: "+String(reason));
}});
app.get("/api/admin",async(req,res)=>{try{
 const guildId=process.env.DISCORD_GUILD_ID;if(!guildId||!process.env.DISCORD_BOT_TOKEN)return res.status(503).json({configured:false});
 const [g,roles]=await Promise.all([discord("https://discord.com/api/v10/guilds/"+guildId),discord("https://discord.com/api/v10/guilds/"+guildId+"/roles")]);
 let member=null;
 if(req.session.user?.id){try{member=(await discord("https://discord.com/api/v10/guilds/"+guildId+"/members/"+req.session.user.id)).data}catch{}}
 const roleMap=new Map(roles.data.map(r=>[r.id,r]));
 const permissions=[
  ["Administrator",8],["Manage Server",32],["Manage Channels",16],["Manage Roles",268435456],
  ["Kick Members",2],["Ban Members",4],["Moderate Members",1099511627776],["Manage Messages",8192],
  ["Mention Everyone",131072],["View Audit Log",128]
 ];
 const roleDetails=roles.data.filter(r=>!r.managed).sort((a,b)=>b.position-a.position).map(r=>({id:r.id,name:r.name,color:r.color,position:r.position,permissions:permissions.filter(([n,v])=>(BigInt(r.permissions||"0")&BigInt(v))===BigInt(v)).map(x=>x[0]),administrator:(BigInt(r.permissions||"0")&8n)===8n}));
 const userRoles=(member?.roles||[]).map(id=>roleMap.get(id)).filter(Boolean);
 const effective=userRoles.reduce((set,r)=>{permissions.forEach(([n,v])=>{if((BigInt(r.permissions||"0")&BigInt(v))===BigInt(v))set.add(n)});return set},new Set());
 const isOwner=member?.user?.id===g.data.owner_id;
 res.json({configured:true,guild:{id:g.data.id,name:g.data.name,owner_id:g.data.owner_id},viewer:{loggedIn:!!req.session.user,isMember:!!member,isOwner,roles:userRoles.map(r=>r.name),permissions:[...effective],canManage: isOwner||effective.has("Administrator")||effective.has("Manage Server")},roles:roleDetails});
}catch(e){res.status(500).json({error:"Administration data unavailable",detail:e.response?.data||e.message})}});
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));
app.listen(PORT,()=>console.log("Mellow Cloud running on "+PORT));