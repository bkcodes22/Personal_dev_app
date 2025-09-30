const storeName="gymLogs";
let db,currentMonth,currentYear,summaryChart,commentDayId=null;
const monthNames=["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

// Helper: format a Date as local YYYY-MM-DD (avoids UTC shift from toISOString)
function formatLocalDate(d){
  const y=d.getFullYear();
  const m=(d.getMonth()+1).toString().padStart(2,'0');
  const day=d.getDate().toString().padStart(2,'0');
  return `${y}-${m}-${day}`;
}

(async function init(){
  db=await openDB("gymDB",storeName);
  const now=new Date(); currentMonth=now.getMonth(); currentYear=now.getFullYear();

  const monthSel=document.getElementById("monthSelect");
  monthNames.forEach((m,i)=>{
    const o=document.createElement("option"); o.value=i; o.textContent=m;
    if(i===currentMonth)o.selected=true; monthSel.appendChild(o);
  });
  monthSel.addEventListener("change",()=>{currentMonth=parseInt(monthSel.value); renderCalendar(); updateSidebarSummary(currentMode());});

  const yearSel=document.getElementById("yearSelect");
  for(let y=now.getFullYear()-5;y<=now.getFullYear()+5;y++){
    const o=document.createElement("option"); o.value=y; o.textContent=y;
    if(y===currentYear)o.selected=true; yearSel.appendChild(o);
  }
  yearSel.addEventListener("change",()=>{currentYear=parseInt(yearSel.value); renderCalendar(); updateSidebarSummary(currentMode());});

  document.getElementById("weekBtn").addEventListener("click",()=>{setActiveBtn("weekBtn","monthBtn"); updateSidebarSummary("week");});
  document.getElementById("monthBtn").addEventListener("click",()=>{setActiveBtn("monthBtn","weekBtn"); updateSidebarSummary("month");});

  document.getElementById("saveComment").addEventListener("click",saveComment);
  document.getElementById("cancelComment").addEventListener("click",()=>{document.getElementById("comment-section").classList.add("hidden"); commentDayId=null;});

  renderCalendar();
  updateSidebarSummary("month");
})();

function currentMode(){ return document.getElementById("weekBtn").classList.contains("bg-blue-500")?"week":"month"; }
function setActiveBtn(active,inactive){
  document.getElementById(active).className="px-3 py-1 rounded bg-blue-500 text-white text-sm";
  document.getElementById(inactive).className="px-3 py-1 rounded bg-gray-300 text-sm";
}

// Render full calendar with weekly pie charts
async function renderCalendar(){
  const calendar=document.getElementById("calendar"); calendar.innerHTML="";
  const firstDay=new Date(currentYear,currentMonth,1);
  const lastDay=new Date(currentYear,currentMonth+1,0);
  const logs=await getAllData(db,storeName);

  let totalDays=lastDay.getDate();
  let startDay=firstDay.getDay();
  let rows=Math.ceil((totalDays+startDay)/7);
  let d=1;
  for(let r=0;r<rows;r++){
    let weekRow=document.createElement("div");
    weekRow.className="flex mb-1 items-center";
    // 7 day cells
    for(let i=0;i<7;i++){
      let cell=document.createElement("div");
      cell.className="flex-1 min-w-[32px] min-h-[32px] mx-0.5";
      if(r===0 && i<startDay){
        // empty cell
      }else if(d<=totalDays){
        const date=new Date(currentYear,currentMonth,d);
        const dateStr=formatLocalDate(date);
        const entry=logs.find(l=>l.date===dateStr);
        const btn=document.createElement("div");
        btn.className="p-2 rounded-lg text-sm relative flex flex-col items-center justify-center cursor-pointer transition w-full h-full";
        btn.innerHTML=`<div class='font-bold'>${d}</div>`;
        if(entry?.done) btn.classList.add("bg-green-400"); else btn.classList.add("bg-gray-200");
        if(entry?.done) btn.innerHTML+=`<span class='absolute right-1 bottom-1 text-xs text-white font-bold'>✔</span>`;
        // comment icon
        const cicon=document.createElement("span");
        cicon.innerHTML="💬"; cicon.className="absolute top-1 left-1 text-xs cursor-pointer";
        cicon.onclick=(e)=>{e.stopPropagation(); openComment(dateStr);}
        btn.appendChild(cicon);
        btn.onclick=()=>toggleDone(dateStr);
        cell.appendChild(btn);
        d++;
      }
      weekRow.appendChild(cell);
    }
    // Calculate week attendance (out of 7 days)
    let weekStartDay=(r===0)?1:(r*7-startDay+1);
    let weekEndDay=Math.min(weekStartDay+6,totalDays);
    let weekDone=0;
    for(let wd=weekStartDay;wd<=weekEndDay;wd++){
      const dateStr=formatLocalDate(new Date(currentYear,currentMonth,wd));
      const entry=logs.find(l=>l.date===dateStr);
      if(entry && entry.done) weekDone++;
    }
    // Pie chart beside week
    const pieCell=document.createElement("div");
    pieCell.className="flex items-center justify-center ml-2";
    const canvas=document.createElement("canvas"); canvas.width=30; canvas.height=30; pieCell.appendChild(canvas);
    weekRow.appendChild(pieCell);
    calendar.appendChild(weekRow);
    // Draw pie chart (out of 5)
    new Chart(canvas.getContext("2d"),{
      type:"doughnut",
      data:{labels:["Done","Remaining"],datasets:[{data:[Math.min(weekDone,5),5-Math.min(weekDone,5)],backgroundColor:["#4ade80","#e5e7eb"]}]},
      options:{responsive:false,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false}}}
    });
  }
}

// Toggle done
async function toggleDone(dateStr){
  const logs=await getAllData(db,storeName);
  const entry=logs.find(l=>l.date===dateStr);
  if(!entry){ await addData(db,storeName,{date:dateStr,done:true,comment:""}); }
  else{ await updateData(db,storeName,entry.id,{done:!entry.done}); }
  renderCalendar(); updateSidebarSummary(currentMode());
}

// Open comment
function openComment(dateStr){
  commentDayId=dateStr;
  getAllData(db,storeName).then(logs=>{
    const entry=logs.find(l=>l.date===dateStr);
    document.getElementById("commentInput").value=entry?.comment || "";
    document.getElementById("comment-section").classList.remove("hidden");
  });
}

// Save comment
async function saveComment(){
  if(!commentDayId) return;
  const comment=document.getElementById("commentInput").value;
  const logs=await getAllData(db,storeName);
  const entry=logs.find(l=>l.date===commentDayId);
  if(entry){ await updateData(db,storeName,entry.id,{comment}); }
  else{ await addData(db,storeName,{date:commentDayId,done:false,comment}); }
  document.getElementById("comment-section").classList.add("hidden");
  commentDayId=null;
  renderCalendar(); updateSidebarSummary(currentMode());
}

// Update sidebar summary
async function updateSidebarSummary(mode){
  const logs=await getAllData(db,storeName);
  let totalDays, doneDays, actualTotal, actualDone;
  const now=new Date();
  if(mode==="week"){
    // This week: Sunday to Saturday
    const startWeek=new Date(now.getFullYear(), now.getMonth(), now.getDate()-now.getDay());
    const endWeek=new Date(startWeek.getFullYear(), startWeek.getMonth(), startWeek.getDate()+6);
    actualTotal=7;
    actualDone=logs.filter(l=>{
      const d=new Date(l.date+"T00:00:00");
      return d>=startWeek && d<=endWeek && l.done;
    }).length;
    totalDays=5;
    doneDays=Math.min(actualDone,5);
    document.getElementById("summary-text").textContent=`${actualDone}/7 → ${actualDone>=5?"✅ Awesome":"❌ Poor"}`;
  } else {
    // This month
    const daysInMonth=new Date(currentYear,currentMonth+1,0).getDate();
    actualTotal=daysInMonth;
    actualDone=logs.filter(l=>{
      // Always parse as local date, not UTC
      const [year, month, day] = l.date.split('-').map(Number);
      return year === currentYear && month-1 === currentMonth && l.done;
    }).length;
    totalDays=20;
    doneDays=Math.min(actualDone,20);
    document.getElementById("summary-text").textContent=`${actualDone}/${actualTotal} → ${actualDone>=20?"✅ Awesome":"❌ Poor"}`;
  }
  const ctx=document.getElementById("summaryChart").getContext("2d");
  // ensure canvas has explicit pixel size
  const canvasEl=document.getElementById("summaryChart");
  canvasEl.width=120; canvasEl.height=120;
  if(window.summaryChart) window.summaryChart.destroy();
  window.summaryChart=new Chart(ctx,{
    type:"doughnut",
    data:{labels:["Done","Remaining"],datasets:[{data:[doneDays,totalDays-doneDays],backgroundColor:["#4ade80","#e5e7eb"]}]},
    options:{responsive:false,maintainAspectRatio:false,cutout:"60%",plugins:{legend:{display:false}}}
  });
}
