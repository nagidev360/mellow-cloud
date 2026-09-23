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
app.get("/api/callback",async(req,res)=>{try{const t=await axios.post("https://discord.com/api/v10/oauth2/token",new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:"authorization_code",code:req.query.code,redirect_uri:process.env.DISCORD_REDIRECT_URI}),{headers:{"Content-Type":"application/x-www-form-urlencoded"}});const me=await axios.get("https://discord.com/api/v10/users/@me",{headers:{Authorization:"Bearer "+t.data.access_token}});req.session.user=me.data;res.redirect("/")}catch(e){res.status(500).send("Discord login failed.")}});
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));
app.listen(PORT,()=>console.log("Mellow Cloud running on "+PORT));