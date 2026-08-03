import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnMUL1YT5EBS-Ev9zL7upiNDmVM2aqBqU",
  authDomain: "shosoken-app.firebaseapp.com",
  projectId: "shosoken-app",
  storageBucket: "shosoken-app.firebasestorage.app",
  messagingSenderId: "1083380646474",
  appId: "1:1083380646474:web:0b75ea9d60f243467a1cb3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const yen = n => "¥" + Math.round(Number(n) || 0).toLocaleString();
const isoDate = () => new Date().toISOString().slice(0,10);
const isoMonth = () => isoDate().slice(0,7);
const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

let currentUser = null;
let currentRole = "employee";
let selectedWorkerId = "";
let selectedAmount = 1;
let unsubs = [];

const data = {
  workers: [], sites: [], attendance: [], profits: [], expenses: [], materials: []
};

["attDate","expenseDate","materialDate","siteStart"].forEach(id => $(id).value = isoDate());
["attendanceMonth","profitMonth"].forEach(id => $(id).value = isoMonth());

function clearSubscriptions(){
  unsubs.forEach(fn => fn());
  unsubs = [];
}
function setSync(text){ $("syncStatus").textContent = "● " + text; }
function showAuthError(err){
  $("authError").textContent = err?.message ? `Firebase: ${err.message}` : String(err);
}
function isAdmin(){ return currentRole === "admin"; }

$("loginBtn").onclick = async () => {
  try{
    $("authError").textContent = "";
    await signInWithEmailAndPassword(auth, $("emailInput").value.trim(), $("passwordInput").value);
  }catch(e){ showAuthError(e); }
};
$("registerBtn").onclick = async () => {
  try{
    $("authError").textContent = "";
    const cred = await createUserWithEmailAndPassword(auth, $("emailInput").value.trim(), $("passwordInput").value);
    await setDoc(doc(db,"users",cred.user.uid),{
      email: cred.user.email, role:"employee", createdAt:serverTimestamp()
    },{merge:true});
  }catch(e){ showAuthError(e); }
};
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  clearSubscriptions();
  currentUser = user;
  if(!user){
    currentRole = "employee";
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    setSync("接続待ち");
    return;
  }
  const userRef = doc(db,"users",user.uid);
  let snap = await getDoc(userRef);
  if(!snap.exists()){
    await setDoc(userRef,{email:user.email,role:"employee",createdAt:serverTimestamp()});
    snap = await getDoc(userRef);
  }
  currentRole = snap.data()?.role || "employee";
  $("roleBadge").textContent = currentRole === "admin" ? "管理者" : currentRole === "leader" ? "班長" : "従業員";
  document.querySelectorAll("[data-admin],.admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  setSync("リアルタイム同期中");
  startRealtime();
});

function startRealtime(){
  const configs = [
    ["workers","workers"],["sites","sites"],["attendance","attendance"],
    ["profits","profits"],["expenses","expenses"],["materials","materials"]
  ];
  configs.forEach(([coll,key])=>{
    const q = query(collection(db,coll),orderBy("createdAt","desc"));
    unsubs.push(onSnapshot(q,snap=>{
      data[key] = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderAll();
    },err=>{
      console.error(coll,err);
      setSync("同期エラー");
    }));
  });
}

$("nav").querySelectorAll("button").forEach(btn=>{
  btn.onclick = ()=>{
    $("nav").querySelectorAll("button").forEach(x=>x.classList.remove("on"));
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("on"));
    btn.classList.add("on");
    $(btn.dataset.page).classList.add("on");
    if(btn.dataset.page === "graph") drawCharts();
  };
});

function activeWorkers(){ return data.workers.filter(x=>x.active !== false); }
function activeSites(){ return data.sites.filter(x=>x.active !== false); }

function renderOptions(){
  const siteOptions = activeSites().length
    ? activeSites().map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")
    : `<option value="">先に現場登録</option>`;
  ["attSite","profitSite","expenseSite"].forEach(id=>{
    const old = $(id).value;
    $(id).innerHTML = siteOptions;
    if([...$(id).options].some(o=>o.value===old)) $(id).value=old;
  });
  const materialOld = $("materialSite").value;
  $("materialSite").innerHTML =
    `<option value="warehouse">倉庫（会社在庫）</option>` +
    activeSites().map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  if([...$("materialSite").options].some(o=>o.value===materialOld)) $("materialSite").value=materialOld;
}

function renderWorkerButtons(){
  const workers = activeWorkers();
  $("workerButtons").innerHTML = workers.length ? workers.map(w=>`
    <button class="${selectedWorkerId===w.id?"selected":""}" data-worker="${w.id}">
      ${escapeHtml(w.name)}<br><small>${escapeHtml(w.type||"")}</small>
    </button>`).join("") : `<div class="list-empty">先に従業員を登録してください</div>`;
  $("workerButtons").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    selectedWorkerId=b.dataset.worker;
    renderWorkerButtons();
  });
}

$("fullDayBtn").onclick=()=>{ selectedAmount=1; $("fullDayBtn").classList.add("primary"); $("halfDayBtn").classList.remove("primary"); };
$("halfDayBtn").onclick=()=>{ selectedAmount=.5; $("halfDayBtn").classList.add("primary"); $("fullDayBtn").classList.remove("primary"); };

$("saveAttendanceBtn").onclick = async ()=>{
  if(!selectedWorkerId) return alert("名前をタップしてください");
  if(!$("attSite").value) return alert("現場を登録してください");
  const worker=data.workers.find(x=>x.id===selectedWorkerId);
  const site=data.sites.find(x=>x.id===$("attSite").value);
  await addDoc(collection(db,"attendance"),{
    date:$("attDate").value, workerId:worker.id, workerName:worker.name,
    siteId:site.id, siteName:site.name, amount:selectedAmount,
    memo:$("attMemo").value.trim(), createdBy:currentUser.uid, createdAt:serverTimestamp()
  });
  $("attMemo").value="";
  $("attMessage").textContent=`${worker.name}：${selectedAmount}人工を登録しました`;
  setTimeout(()=>$("attMessage").textContent="",2500);
};

function renderAttendance(){
  const month=$("attendanceMonth").value;
  const rows=data.attendance.filter(x=>x.date?.startsWith(month));
  $("monthManDays").textContent=rows.reduce((s,x)=>s+Number(x.amount||0),0).toFixed(1).replace(".0","");
  $("monthWorkerCount").textContent=new Set(rows.map(x=>x.workerId)).size;
  $("monthAttendanceCount").textContent=rows.length;
  const summary={};
  rows.forEach(x=>summary[x.workerName]=(summary[x.workerName]||0)+Number(x.amount||0));
  $("attendanceSummary").innerHTML=Object.keys(summary).length?`
    <table class="summary-table"><thead><tr><th>名前</th><th>合計人工</th></tr></thead><tbody>
    ${Object.entries(summary).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<tr><td>${escapeHtml(n)}</td><td>${v.toFixed(1).replace(".0","")}</td></tr>`).join("")}
    </tbody></table>`:"";
  $("attendanceList").innerHTML=rows.length?rows.slice(0,50).map(x=>recordHtml(
    `${x.date}　${escapeHtml(x.workerName)}`,
    `${escapeHtml(x.siteName)} ／ ${x.amount}人工${x.memo?` ／ ${escapeHtml(x.memo)}`:""}`,
    "attendance",x.id
  )).join(""):`<div class="list-empty">この月の出面はありません</div>`;
}

$("attendanceMonth").oninput=renderAttendance;

function recordHtml(title,sub,coll,id){
  return `<div class="record"><div class="record-main"><b>${title}</b><small>${sub}</small></div>
  ${isAdmin()?`<div class="record-actions"><button class="danger-btn" data-delete="${coll}" data-id="${id}">削除</button></div>`:""}</div>`;
}
document.addEventListener("click",async e=>{
  const btn=e.target.closest("[data-delete]");
  if(!btn) return;
  if(!confirm("このデータを削除しますか？")) return;
  await deleteDoc(doc(db,btn.dataset.delete,btn.dataset.id));
});

function regularExpenseCost(siteId, month){
  return data.expenses
    .filter(x=>x.siteId===siteId && (!month || x.date?.startsWith(month)))
    .reduce((s,x)=>s+Number(x.amount||0),0);
}
function automaticMaterialCost(siteId, month){
  if(!siteId || siteId==="warehouse") return 0;
  return data.materials
    .filter(x=>x.siteId===siteId && x.action==="in" && Number(x.unitPrice||0)>0 && (!month || x.date?.startsWith(month)))
    .reduce((s,x)=>s + Number(x.qty||0)*Number(x.unitPrice||0),0);
}
function profitTotals(x){
  const sales = Number(x.sales ?? (Number(x.sqm||0)*Number(x.sqmPrice||0)));
  const labor = Number(x.labor ?? (Number(x.days||0)*Number(x.dayPrice||0)));
  const manualMaterial = Number(x.materialCost||0);
  const other = Number(x.otherCost||0);
  const autoMaterial = automaticMaterialCost(x.siteId,x.month);
  const autoExpense = regularExpenseCost(x.siteId,x.month);
  const cost = labor + manualMaterial + other + autoMaterial + autoExpense;
  return {sales,labor,manualMaterial,other,autoMaterial,autoExpense,cost,profit:sales-cost};
}

function calcProfit(){
  const siteId=$("profitSite").value;
  const month=$("profitMonth").value;
  const sales=Number($("profitSqm").value||0)*Number($("profitSqmPrice").value||0);
  const labor=Number($("profitDays").value||0)*Number($("profitDayPrice").value||0);
  const manualMaterial=Number($("profitMaterial").value||0);
  const other=Number($("profitOther").value||0);
  const autoMaterial=automaticMaterialCost(siteId,month);
  const autoExpense=regularExpenseCost(siteId,month);
  const cost=labor+manualMaterial+other+autoMaterial+autoExpense;
  $("calcSales").textContent=yen(sales);
  $("calcCost").textContent=yen(cost);
  $("calcProfit").textContent=yen(sales-cost);
  $("calcAutoMaterial").textContent=yen(autoMaterial);
  $("calcAutoExpense").textContent=yen(autoExpense);
  return {sales,labor,materialCost:manualMaterial,otherCost:other};
}
["profitSqm","profitSqmPrice","profitDays","profitDayPrice","profitMaterial","profitOther","profitMonth","profitSite"].forEach(id=>$(id).oninput=calcProfit);
$("saveProfitBtn").onclick=async()=>{
  if(!$("profitSite").value)return alert("現場を選んでください");
  const site=data.sites.find(x=>x.id===$("profitSite").value);
  const c=calcProfit();
  await addDoc(collection(db,"profits"),{
    month:$("profitMonth").value,siteId:site.id,siteName:site.name,
    sqm:Number($("profitSqm").value||0),sqmPrice:Number($("profitSqmPrice").value||0),
    days:Number($("profitDays").value||0),dayPrice:Number($("profitDayPrice").value||0),
    ...c,createdAt:serverTimestamp()
  });
};
function renderProfits(){
  $("profitList").innerHTML=data.profits.length?data.profits.map(x=>{
    const t=profitTotals(x);
    return recordHtml(
      `${escapeHtml(x.month)}　${escapeHtml(x.siteName)}`,
      `売上 ${yen(t.sales)} ／ 原価 ${yen(t.cost)} ／ 利益 ${yen(t.profit)}（材料自動 ${yen(t.autoMaterial)}）`,
      "profits",x.id
    );
  }).join(""):`<div class="list-empty">利益データがありません</div>`;
}

$("saveExpenseBtn").onclick=async()=>{
  if(!$("expenseSite").value)return alert("現場を選んでください");
  const site=data.sites.find(x=>x.id===$("expenseSite").value);
  await addDoc(collection(db,"expenses"),{
    date:$("expenseDate").value,siteId:site.id,siteName:site.name,
    type:$("expenseType").value,amount:Number($("expenseAmount").value||0),
    memo:$("expenseMemo").value.trim(),createdAt:serverTimestamp()
  });
  $("expenseAmount").value="";$("expenseMemo").value="";
};
function renderExpenses(){
  const normal=data.expenses.map(x=>({
    date:x.date,title:x.type,siteName:x.siteName,amount:Number(x.amount||0),
    memo:x.memo||"",collection:"expenses",id:x.id,automatic:false
  }));
  const materials=data.materials
    .filter(x=>x.action==="in" && x.siteId!=="warehouse" && Number(x.unitPrice||0)>0)
    .map(x=>({
      date:x.date,title:"材料費（自動）",siteName:x.siteName,
      amount:Number(x.qty||0)*Number(x.unitPrice||0),
      memo:`${x.type} ${x.qty} × ${yen(x.unitPrice)}`,
      collection:"materials",id:x.id,automatic:true
    }));
  const rows=[...normal,...materials].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("expenseList").innerHTML=rows.length?rows.map(x=>recordHtml(
    `${x.date}　${escapeHtml(x.title)}`,
    `${escapeHtml(x.siteName)} ／ ${yen(x.amount)}${x.memo?` ／ ${escapeHtml(x.memo)}`:""}`,
    x.collection,x.id
  )).join(""):`<div class="list-empty">経費データがありません</div>`;
}

$("saveMaterialBtn").onclick=async()=>{
  const locationId=$("materialSite").value;
  if(!locationId)return alert("保管場所か現場を選んでください");
  const site=locationId==="warehouse"?null:data.sites.find(x=>x.id===locationId);
  const qty=Number($("materialQty").value||0);
  if(qty<=0)return alert("数量を入力してください");
  await addDoc(collection(db,"materials"),{
    date:$("materialDate").value,type:$("materialType").value,
    siteId:locationId,siteName:site?site.name:"倉庫（会社在庫）",
    qty,action:$("materialAction").value,unitPrice:Number($("materialUnitPrice").value||0),
    createdAt:serverTimestamp()
  });
  $("materialQty").value="";$("materialUnitPrice").value="";
};
function renderMaterials(){
  const stock={};
  data.materials.forEach(x=>stock[x.type]=(stock[x.type]||0)+(x.action==="out"?-1:1)*Number(x.qty||0));
  $("stockList").innerHTML=Object.keys(stock).length?Object.entries(stock).map(([k,v])=>`<div class="stock-row"><b>${escapeHtml(k)}</b><span>${v.toLocaleString()}</span></div>`).join(""):`<div class="list-empty">在庫データがありません</div>`;
  $("materialList").innerHTML=data.materials.length?data.materials.map(x=>recordHtml(
    `${x.date}　${escapeHtml(x.type)}`,`${escapeHtml(x.siteName)} ／ ${x.action==="out"?"出庫":"入庫"} ${x.qty} ／ ${yen(Number(x.qty)*Number(x.unitPrice||0))}`,
    "materials",x.id)).join(""):`<div class="list-empty">入出庫履歴がありません</div>`;
}

$("saveWorkerBtn").onclick=async()=>{
  const name=$("workerName").value.trim();if(!name)return alert("名前を入力してください");
  await addDoc(collection(db,"workers"),{
    name,type:$("workerType").value,dayPrice:Number($("workerPrice").value||0),
    active:$("workerActive").value==="true",createdAt:serverTimestamp()
  });
  $("workerName").value="";$("workerPrice").value="";
};
function renderWorkers(){
  $("workerList").innerHTML=data.workers.length?data.workers.map(x=>recordHtml(
    escapeHtml(x.name),`${escapeHtml(x.type||"")} ／ ${yen(x.dayPrice)} ／ ${x.active===false?"非表示":"在籍"}`,
    "workers",x.id)).join(""):`<div class="list-empty">従業員が登録されていません</div>`;
}

$("saveSiteBtn").onclick=async()=>{
  const name=$("siteName").value.trim();if(!name)return alert("現場名を入力してください");
  await addDoc(collection(db,"sites"),{
    name,client:$("siteClient").value.trim(),startDate:$("siteStart").value,endDate:$("siteEnd").value,
    active:true,createdAt:serverTimestamp()
  });
  $("siteName").value="";$("siteClient").value="";
};
function renderSites(){
  $("siteList").innerHTML=data.sites.length?data.sites.map(x=>recordHtml(
    escapeHtml(x.name),`${escapeHtml(x.client||"請求先未設定")} ／ ${x.startDate||"-"}〜${x.endDate||"-"}`,
    "sites",x.id)).join(""):`<div class="list-empty">現場が登録されていません</div>`;
}

function renderHome(){
  const today=isoDate(),month=isoMonth();
  $("todayManDays").textContent=data.attendance.filter(x=>x.date===today).reduce((s,x)=>s+Number(x.amount||0),0).toFixed(1).replace(".0","");
  const p=data.profits.filter(x=>x.month===month).reduce((s,x)=>s+profitTotals(x).profit,0);
  $("monthProfit").textContent=yen(p);
  $("monthUnpaid").textContent="¥0";
  $("homeSites").innerHTML=activeSites().length?activeSites().map(s=>{
    const man=data.attendance.filter(x=>x.siteId===s.id&&x.date?.startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
    const profit=data.profits.filter(x=>x.siteId===s.id&&x.month===month).reduce((a,x)=>a+profitTotals(x).profit,0);
    return `<div class="site-card"><b>${escapeHtml(s.name)}</b><br><small>今月 ${man.toFixed(1).replace(".0","")}人工 ／ 利益 ${yen(profit)}</small></div>`;
  }).join(""):`<div class="list-empty">現場がありません</div>`;
}

function drawBar(canvasId,labels,values){
  const c=$(canvasId),ctx=c.getContext("2d"),W=c.width,H=c.height;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(...values.map(v=>Math.abs(v)),1),pad=55,areaW=W-pad-20,areaH=H-70;
  const bw=Math.max(25,Math.min(80,areaW/Math.max(labels.length,1)*.62));
  ctx.font="12px sans-serif";ctx.textAlign="center";
  labels.forEach((label,i)=>{
    const x=pad+(i+.5)*areaW/labels.length, h=areaH*Math.abs(values[i])/max;
    ctx.fillStyle="#111827";ctx.fillRect(x-bw/2,H-35-h,bw,h);
    ctx.fillStyle="#6b7280";ctx.fillText(String(label).slice(0,8),x,H-15);
  });
}
function drawCharts(){
  const months=[...new Set([...data.attendance.map(x=>x.date?.slice(0,7)),...data.profits.map(x=>x.month)])].filter(Boolean).sort().slice(-6);
  drawBar("profitChart",months,months.map(m=>data.profits.filter(x=>x.month===m).reduce((s,x)=>s+profitTotals(x).profit,0)));
  drawBar("attendanceChart",months,months.map(m=>data.attendance.filter(x=>x.date?.startsWith(m)).reduce((s,x)=>s+Number(x.amount||0),0)));
  const sites=activeSites();
  drawBar("siteProfitChart",sites.map(x=>x.name),sites.map(s=>data.profits.filter(x=>x.siteId===s.id).reduce((a,x)=>a+profitTotals(x).profit,0)));
}

function renderAll(){
  renderOptions();renderWorkerButtons();renderAttendance();renderProfits();renderExpenses();
  renderMaterials();renderWorkers();renderSites();renderHome();calcProfit();
  if($("graph").classList.contains("on")) drawCharts();
}
calcProfit();
