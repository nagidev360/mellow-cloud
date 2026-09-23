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
app.get("/api/server",async(_req,res)=>{
 try{
  const id=process.env.DISCORD_GUILD_ID;
  if(!id||!process.env.DISCORD_BOT_TOKEN)return res.status(503).json({configured:false});
  const [g,c,m]=await Promise.all([discord("https://discord.com/api/v10/guilds/"+id+"?with_counts=true"),discord("https://discord.com/api/v10/guilds/"+id+"/channels"),discord("https://discord.com/api/v10/guilds/"+id+"/members?limit=1000")]);
  res.json({configured:true,guild:g.data,channels:c.data,members:m.data.map(x=>({id:x.user.id,username:x.user.username,global_name:x.user.global_name,avatar:x.user.avatar}))});
 }catch(e){res.status(500).json({error:"Discord API error",detail:e.response?.data||e.message});}
});
app.get("/api/login",(req,res)=>{const p=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||"",response_type:"code",redirect_uri:process.env.DISCORD_REDIRECT_URI||"",scope:"identify guilds"});res.redirect("https://discord.com/oauth2/authorize?"+p)});
app.get("/api/callback",async(req,res)=>{try{const t=await axios.post("https://discord.com/api/v10/oauth2/token",new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:"authorization_code",code:req.query.code,redirect_uri:process.env.DISCORD_REDIRECT_URI}),{headers:{"Content-Type":"application/x-www-form-urlencoded"}});const me=await axios.get("https://discord.com/api/v10/users/@me",{headers:{Authorization:"Bearer "+t.data.access_token}});req.session.user=me.data;res.redirect("/")}catch(e){res.status(500).send("Discord login failed.")}});
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));
app.listen(PORT,()=>console.log("Mellow Cloud running on "+PORT));