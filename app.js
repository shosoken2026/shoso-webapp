import {initializeApp} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {getFirestore,collection,addDoc,doc,getDoc,setDoc,deleteDoc,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const cfg={apiKey:"AIzaSyDnMUL1YT5EBS-Ev9zL7upiNDmVM2aqBqU",authDomain:"shosoken-app.firebaseapp.com",projectId:"shosoken-app",storageBucket:"shosoken-app.firebasestorage.app",messagingSenderId:"1083380646474",appId:"1:1083380646474:web:0b75ea9d60f243467a1cb3"};
const app=initializeApp(cfg),auth=getAuth(app),db=getFirestore(app),$=x=>document.getElementById(x),Y=n=>"¥"+Math.round(+n||0).toLocaleString(),today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
const S={workers:[],sites:[],att:[],profits:[],expenses:[],materials:[],bills:[],users:[]},mats=["ベニヤ 3×6","ベニヤ 2×6","サンギ 3.5m","サンギ 3.0m","バタ角","目地棒","面木","アンコ材"];
let current=null,roleName="employee",amount=1,unsubs=[];
aDate.value=eDate.value=bDate.value=today;aMonth.value=pMonth.value=eMonth.value=month;

loginBtn.onclick=async()=>{try{await signInWithEmailAndPassword(auth,email.value,password.value)}catch(e){message.textContent=e.message}};
signupBtn.onclick=async()=>{try{const c=await createUserWithEmailAndPassword(auth,email.value,password.value);await setDoc(doc(db,"users",c.user.uid),{email:c.user.email,role:"employee",createdAt:serverTimestamp()})}catch(e){message.textContent=e.message}};
logout.onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{
 unsubs.forEach(f=>f());unsubs=[];
 if(!u){loginView.classList.remove("hidden");appView.classList.add("hidden");logout.classList.add("hidden");return}
 current=u;let s=await getDoc(doc(db,"users",u.uid));if(!s.exists())await setDoc(doc(db,"users",u.uid),{email:u.email,role:"employee"});
 roleName=s.exists()?s.data().role:"employee";loginView.classList.add("hidden");appView.classList.remove("hidden");logout.classList.remove("hidden");applyRole();subscribe();
});
function applyRole(){role.textContent=roleName==="admin"?"管理者":roleName==="leader"?"班長":"従業員";document.querySelectorAll(".admin,[data-admin]").forEach(x=>x.classList.toggle("hidden",roleName!=="admin"))}
nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{nav.querySelectorAll("button").forEach(x=>x.classList.remove("on"));document.querySelectorAll(".page").forEach(x=>x.classList.remove("on"));b.classList.add("on");$(b.dataset.page).classList.add("on")});
function subscribe(){let map={workers:"workers",sites:"sites",att:"attendance",profits:"profits",expenses:"expenses",materials:"materials",bills:"bills",users:"users"};Object.entries(map).forEach(([k,c])=>unsubs.push(onSnapshot(collection(db,c),s=>{S[k]=s.docs.map(d=>({id:d.id,...d.data()}));sync.textContent="● リアルタイム同期中";render()},e=>{sync.textContent="⚠ 接続エラー";console.error(e)})))}
const add=(c,d)=>addDoc(collection(db,c),{...d,createdAt:serverTimestamp()});window.del=async(c,i)=>{if(confirm("削除しますか？"))await deleteDoc(doc(db,c,i))};window.changeRole=async(i,v)=>setDoc(doc(db,"users",i),{role:v},{merge:true});
function opt(company=false){let a=company?["会社共通",...S.sites.map(x=>x.name)]:S.sites.map(x=>x.name);return a.length?a.map(x=>`<option>${x}</option>`).join(""):"<option>先に現場登録</option>"}
function expFor(site,m){return S.expenses.filter(x=>x.site===site&&x.date?.startsWith(m)).reduce((s,x)=>s+(+x.amount||0),0)}
function siteProfit(site,m){return S.profits.filter(x=>x.site===site&&(!m||x.month===m)).reduce((s,x)=>s+(+x.sales||0)-(+x.baseCost||0)-expFor(site,x.month),0)}
addWorker.onclick=async()=>{let v=newWorker.value.trim();if(v&&!S.workers.some(x=>x.name===v))await add("workers",{name:v});newWorker.value=""};
addSite.onclick=async()=>{let v=newSite.value.trim();if(v&&!S.sites.some(x=>x.name===v))await add("sites",{name:v});newSite.value=""};
full.onclick=()=>{amount=1;full.classList.add("primary");half.classList.remove("primary")};half.onclick=()=>{amount=.5;half.classList.add("primary");full.classList.remove("primary")};
saveAtt.onclick=async()=>{let w=document.querySelector(".person.sel")?.dataset.w;if(!w)return alert("名前をタップして");await add("attendance",{date:aDate.value,site:aSite.value,worker:w,kind:aKind.value,amount,enteredBy:current.uid})};
aMonth.oninput=eMonth.oninput=render;
function calc(){let salesV=+sqm.value*+sqmPrice.value,baseCost=+days.value*+dayPrice.value + +matCost.value + +supportCost.value + +otherCost.value,total=baseCost+expFor(pSite.value,pMonth.value);sales.textContent=Y(salesV);cost.textContent=Y(total);gain.textContent=Y(salesV-total);return{sales:salesV,baseCost}}
[sqm,sqmPrice,days,dayPrice,matCost,supportCost,otherCost].forEach(x=>x.oninput=calc);
saveProfit.onclick=async()=>add("profits",{month:pMonth.value,site:pSite.value,...calc()});
saveExp.onclick=async()=>add("expenses",{date:eDate.value,site:eSite.value,type:eType.value,amount:+eAmount.value,payee:ePayee.value});
saveMat.onclick=async()=>{let key=mName.value+"__"+mLoc.value,old=S.materials.find(x=>x.id===key),q=+mQty.value,cur=+old?.qty||0;if(mAction.value==="in")cur+=q;if(mAction.value==="out")cur-=q;if(mAction.value==="set")cur=q;await setDoc(doc(db,"materials",key),{name:mName.value,location:mLoc.value,qty:cur,unit:mUnit.value,min:+mMin.value,price:+mPrice.value},{merge:true})};
saveBill.onclick=async()=>add("bills",{site:bSite.value,client:bClient.value,date:bDate.value,amount:+bAmount.value,status:bStatus.value});

function render(){
 [aSite,pSite,bSite].forEach(x=>x.innerHTML=opt());eSite.innerHTML=opt(true);mLoc.innerHTML=["倉庫",...S.sites.map(x=>x.name)].map(x=>`<option>${x}</option>`).join("");mName.innerHTML=mats.map(x=>`<option>${x}</option>`).join("");
 workers.innerHTML=S.workers.map(x=>`<button class="chip" onclick="del('workers','${x.id}')">${x.name} ×</button>`).join("");sites.innerHTML=S.sites.map(x=>`<button class="chip" onclick="del('sites','${x.id}')">${x.name} ×</button>`).join("");
 people.innerHTML=S.workers.map(x=>`<button class="person" data-w="${x.name}">${x.name}</button>`).join("");people.querySelectorAll("button").forEach(b=>b.onclick=()=>{people.querySelectorAll("button").forEach(x=>x.classList.remove("sel"));b.classList.add("sel")});
 let A=S.att.filter(x=>x.date?.startsWith(aMonth.value));aTotal.textContent=A.reduce((s,x)=>s+(+x.amount||0),0);aCount.textContent=A.length;aPeople.textContent=new Set(A.map(x=>x.worker)).size;aTable.innerHTML=A.map(x=>`<tr><td>${x.date}</td><td>${x.worker}</td><td>${x.site}</td><td>${x.kind}</td><td>${x.amount}</td><td><button onclick="del('attendance','${x.id}')">削除</button></td></tr>`).join("");
 pTable.innerHTML=S.profits.map(x=>`<tr><td>${x.month}</td><td>${x.site}</td><td>${Y(x.sales)}</td><td>${Y((+x.baseCost||0)+expFor(x.site,x.month))}</td><td>${Y((+x.sales||0)-(+x.baseCost||0)-expFor(x.site,x.month))}</td><td><button onclick="del('profits','${x.id}')">削除</button></td></tr>`).join("");
 let E=S.expenses.filter(x=>x.date?.startsWith(eMonth.value));eTotal.textContent=Y(E.reduce((s,x)=>s+(+x.amount||0),0));eCount.textContent=E.length;eKinds.textContent=new Set(E.map(x=>x.type)).size;eTable.innerHTML=E.map(x=>`<tr><td>${x.date}</td><td>${x.site}</td><td>${x.type}</td><td>${Y(x.amount)}</td><td><button onclick="del('expenses','${x.id}')">削除</button></td></tr>`).join("");
 mTable.innerHTML=S.materials.map(x=>`<tr><td>${x.name}</td><td>${x.location}</td><td>${x.qty}${x.unit}</td><td>${x.min||0}${x.unit}</td><td>${Y((+x.qty||0)*(+x.price||0))}</td><td><button onclick="del('materials','${x.id}')">削除</button></td></tr>`).join("");
 bTable.innerHTML=S.bills.map(x=>`<tr><td>${x.date}</td><td>${x.site}</td><td>${x.client}</td><td>${Y(x.amount)}</td><td>${x.status}</td><td><button onclick="del('bills','${x.id}')">削除</button></td></tr>`).join("");
 hToday.textContent=S.att.filter(x=>x.date===today).reduce((s,x)=>s+(+x.amount||0),0);hProfit.textContent=Y(S.sites.reduce((s,x)=>s+siteProfit(x.name,month),0));hUnpaid.textContent=Y(S.bills.filter(x=>x.status==="未入金").reduce((s,x)=>s+(+x.amount||0),0));
 siteSummary.innerHTML=S.sites.map(x=>`<div class="site"><b>${x.name}</b><div class="muted">今月人工 ${S.att.filter(a=>a.site===x.name&&a.date?.startsWith(month)).reduce((s,a)=>s+(+a.amount||0),0)} ／ 今月利益 ${Y(siteProfit(x.name,month))}</div></div>`).join("");
 users.innerHTML=S.users.map(x=>`<div class="user-row"><span>${x.email||x.id}</span><select onchange="changeRole('${x.id}',this.value)"><option value="employee" ${x.role==="employee"?"selected":""}>従業員</option><option value="leader" ${x.role==="leader"?"selected":""}>班長</option><option value="admin" ${x.role==="admin"?"selected":""}>管理者</option></select></div>`).join("")
}
