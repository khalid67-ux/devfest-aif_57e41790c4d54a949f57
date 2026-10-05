const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  originalState: null,
  blockedNodes: new Set(),
  blockedEdges: new Set(),
  closedExits: new Set(),
  startId: null,
  route: null,
  lang: "en",
  zoom: 1
};

const SAMPLE = {
  building: "Smart Escape Sample",
  nodes: [
    { id:"R1", label:"R1", type:"room", coordinates:{x:80,y:80} },
    { id:"R2", label:"R2", type:"room", coordinates:{x:80,y:220} },
    { id:"C1", label:"C1", type:"junction", coordinates:{x:220,y:80} },
    { id:"C2", label:"C2", type:"junction", coordinates:{x:360,y:80} },
    { id:"C3", label:"C3", type:"junction", coordinates:{x:220,y:220} },
    { id:"C4", label:"C4", type:"junction", coordinates:{x:360,y:220} },
    { id:"E1", label:"E1", type:"exit", coordinates:{x:500,y:80} },
    { id:"E2", label:"E2", type:"exit", coordinates:{x:500,y:220} }
  ],
  edges: [
    {id:"e1",from:"R1",to:"C1",cost:2},
    {id:"e2",from:"C1",to:"C2",cost:2},
    {id:"e3",from:"C2",to:"E1",cost:3},
    {id:"e4",from:"R1",to:"R2",cost:2},
    {id:"e5",from:"R2",to:"C3",cost:2},
    {id:"e6",from:"C1",to:"C3",cost:2},
    {id:"e7",from:"C2",to:"C4",cost:2},
    {id:"e8",from:"C3",to:"C4",cost:3},
    {id:"e9",from:"C4",to:"E2",cost:4}
  ],
  initial_state: {
    blocked_nodes: [],
    blocked_edges: [],
    closed_exits: []
  }
};

const T = {
  en: {
    subtitle:"Interactive Evacuation Route Simulator",
    importText:"Import JSON", reset:"Reset", building:"Building", start:"Starting location",
    startHint:"Select an unblocked room or junction.", route:"Route result", exit:"Exit",
    cost:"Total cost", path:"Path", hazards:"Hazards",
    hazardHint:"Click a room/junction/exit or corridor to toggle its hazard state.",
    room:"Room", junction:"Junction", openExit:"Open exit", blocked:"Blocked / closed",
    selected:"Selected route", nodes:"Nodes", corridors:"Corridors", blockedStat:"Blocked",
    closed:"Closed exits",
    mapTitle:"Building map", mapHint:"Costs are edge weights; coordinates only control display position.",
    sample:"Load sample", interaction:"Node: block/unblock · Corridor: block/unblock · Exit: close/reopen",
    emptyTitle:"Import building.json", emptyText:"Use Import JSON, or load the supplied sample to test the simulator.",
    load:"Load a building to begin.", success:"Route found", noRoute:"No route available",
    blockedStart:"Starting location blocked", invalid:"Invalid building.json",
    malformed:"The file is malformed or inconsistent.",
    clickStart:"Select a starting location.",
    startBlocked:"Start is blocked. Select another location or unblock it.",
    chooseStart:"Choose start…", roomType:"Room", junctionType:"Junction", exitType:"Exit"
  },
  bn: {
    subtitle:"ইন্টার‍্যাক্টিভ ইভাকুয়েশন রুট সিমুলেটর",
    importText:"JSON Import", reset:"রিসেট", building:"বিল্ডিং", start:"শুরুর অবস্থান",
    startHint:"একটি unblocked room বা junction নির্বাচন করুন।", route:"রুট ফলাফল", exit:"এক্সিট",
    cost:"মোট খরচ", path:"পথ", hazards:"Hazards",
    hazardHint:"Room/junction/exit বা corridor-এ ক্লিক করে hazard state পরিবর্তন করুন।",
    room:"Room", junction:"Junction", openExit:"Open exit", blocked:"Blocked / closed",
    selected:"নির্বাচিত রুট", nodes:"Nodes", corridors:"Corridors", blockedStat:"Blocked",
    closed:"বন্ধ Exit", mapTitle:"Building map", mapHint:"Cost হলো edge weight; coordinate শুধু অবস্থান দেখায়।",
    sample:"Sample Load", interaction:"Node: block/unblock · Corridor: block/unblock · Exit: close/reopen",
    emptyTitle:"building.json Import করুন", emptyText:"Import JSON চাপুন অথবা sample load করে simulator পরীক্ষা করুন।",
    load:"শুরু করতে building load করুন।", success:"রুট পাওয়া গেছে", noRoute:"কোনো রুট নেই",
    blockedStart:"Starting location blocked", invalid:"Invalid building.json",
    malformed:"ফাইলটি malformed বা inconsistent।", clickStart:"একটি starting location নির্বাচন করুন।",
    startBlocked:"Start blocked। অন্য location নির্বাচন করুন বা unblock করুন।",
    chooseStart:"Start নির্বাচন করুন…", roomType:"Room", junctionType:"Junction", exitType:"Exit"
  }
};

function t(key) { return T[state.lang][key] || key; }

function cloneState(s) {
  return {
    blocked_nodes: [...(s.blocked_nodes || [])],
    blocked_edges: [...(s.blocked_edges || [])],
    closed_exits: [...(s.closed_exits || [])]
  };
}

function validateData(data) {
  if (!data || typeof data !== "object") throw new Error(t("malformed"));
  if (typeof data.building !== "string" || !data.building.trim()) throw new Error("building must be a non-empty string");
  if (!Array.isArray(data.nodes) || data.nodes.length < 2) throw new Error("nodes[] is invalid");
  if (!Array.isArray(data.edges) || data.edges.length < 1) throw new Error("edges[] is invalid");

  const ids = new Set();
  const types = new Set(["room","junction","exit"]);
  for (const n of data.nodes) {
    if (!n || typeof n.id !== "string" || !n.id || ids.has(n.id)) throw new Error("Node IDs must be unique and non-empty");
    if (!types.has(n.type)) throw new Error("Node type must be room, junction, or exit");
    if (!n.label || typeof n.label !== "string") throw new Error("Every node needs a label");
    if (!n.coordinates || !Number.isFinite(Number(n.coordinates.x)) || !Number.isFinite(Number(n.coordinates.y))) {
      throw new Error(`Invalid coordinates for node ${n.id}`);
    }
    ids.add(n.id);
  }
  if (!data.nodes.some(n => n.type === "exit")) throw new Error("At least one exit is required");
  if (!data.nodes.some(n => n.type === "room" || n.type === "junction")) throw new Error("At least one room/junction is required");

  const edgeIds = new Set();
  const pairs = new Set();
  for (const e of data.edges) {
    if (!e || typeof e.id !== "string" || !e.id || edgeIds.has(e.id)) throw new Error("Edge IDs must be unique and non-empty");
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) throw new Error(`Invalid edge endpoints for ${e.id}`);
    if (!Number.isInteger(e.cost) || e.cost <= 0) throw new Error(`Edge ${e.id} cost must be a positive integer`);
    const pair = [e.from,e.to].sort().join("\u0000");
    if (pairs.has(pair)) throw new Error("Repeated node pairs are not allowed");
    pairs.add(pair);
    edgeIds.add(e.id);
  }

  const initial = data.initial_state || {};
  const bn = initial.blocked_nodes || [];
  const be = initial.blocked_edges || [];
  const ce = initial.closed_exits || [];
  if (!Array.isArray(bn) || !Array.isArray(be) || !Array.isArray(ce)) throw new Error("initial_state arrays are required");

  for (const id of bn) {
    const n = data.nodes.find(x => x.id === id);
    if (!n || !["room","junction"].includes(n.type)) throw new Error(`Invalid blocked node: ${id}`);
  }
  for (const id of be) if (!edgeIds.has(id)) throw new Error(`Invalid blocked edge: ${id}`);
  for (const id of ce) {
    const n = data.nodes.find(x => x.id === id);
    if (!n || n.type !== "exit") throw new Error(`Invalid closed exit: ${id}`);
  }
  return true;
}

function setData(data) {
  validateData(data);
  state.data = data;
  state.originalState = cloneState(data.initial_state || {});
  state.blockedNodes = new Set(state.originalState.blocked_nodes);
  state.blockedEdges = new Set(state.originalState.blocked_edges);
  state.closedExits = new Set(state.originalState.closed_exits);
  state.startId = data.nodes.find(n => n.type === "room" || n.type === "junction")?.id || null;
  updateUI();
}

function buildGraph() {
  const adj = new Map(state.data.nodes.map(n => [n.id, []]));
  for (const e of state.data.edges) {
    if (state.blockedEdges.has(e.id)) continue;
    if (state.blockedNodes.has(e.from) || state.blockedNodes.has(e.to)) continue;
    adj.get(e.from).push({to:e.to, cost:e.cost, edgeId:e.id});
    adj.get(e.to).push({to:e.from, cost:e.cost, edgeId:e.id});
  }
  for (const list of adj.values()) list.sort((a,b) => a.to.localeCompare(b.to));
  return adj;
}

function comparePaths(a,b) {
  const len = Math.min(a.length,b.length);
  for (let i=0;i<len;i++) {
    const c = a[i].localeCompare(b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function betterLabel(cost, path, old) {
  if (!old) return true;
  if (cost !== old.cost) return cost < old.cost;
  return comparePaths(path, old.path) < 0;
}

// Dijkstra with the exact tie-break required by the statement:
// minimum total cost -> lexicographically smallest exit ID -> lexicographically smallest node sequence.
function findRoute(startId) {
  if (!state.data || !startId) return null;
  if (state.blockedNodes.has(startId)) return { blockedStart:true };

  const nodeById = new Map(state.data.nodes.map(n => [n.id,n]));
  const exits = new Set(
    state.data.nodes.filter(n => n.type === "exit" && !state.closedExits.has(n.id) && !state.blockedNodes.has(n.id)).map(n => n.id)
  );
  if (!exits.size) return null;

  const adj = buildGraph();
  const best = new Map();
  const visited = new Set();
  best.set(startId, {cost:0, path:[startId]});

  while (true) {
    let current = null;
    for (const [id,label] of best.entries()) {
      if (visited.has(id)) continue;
      if (!current || label.cost < current.label.cost ||
          (label.cost === current.label.cost && comparePaths(label.path,current.label.path) < 0)) {
        current = {id,label};
      }
    }
    if (!current) break;
    visited.add(current.id);

    for (const edge of (adj.get(current.id) || [])) {
      if (visited.has(edge.to)) continue;
      const nextPath = [...current.label.path, edge.to];
      const nextCost = current.label.cost + edge.cost;
      if (betterLabel(nextCost, nextPath, best.get(edge.to))) {
        best.set(edge.to, {cost:nextCost, path:nextPath});
      }
    }
  }

  const candidates = [...exits]
    .filter(id => best.has(id))
    .map(id => ({exitId:id, cost:best.get(id).cost, path:best.get(id).path}))
    .sort((a,b) => a.cost-b.cost || a.exitId.localeCompare(b.exitId) || comparePaths(a.path,b.path));

  return candidates[0] || null;
}

function reset() {
  if (!state.data) return;
  state.blockedNodes = new Set(state.originalState.blocked_nodes);
  state.blockedEdges = new Set(state.originalState.blocked_edges);
  state.closedExits = new Set(state.originalState.closed_exits);
  updateUI(true);
}

function routeEdges(route) {
  const set = new Set();
  if (!route?.path) return set;
  for (let i=0;i<route.path.length-1;i++) {
    const a = route.path[i], b = route.path[i+1];
    const e = state.data.edges.find(x => (x.from===a && x.to===b) || (x.from===b && x.to===a));
    if (e) set.add(e.id);
  }
  return set;
}

const setZoom = (value) => {
  state.zoom = Math.min(1.8, Math.max(.7, Number(value.toFixed(2))));
  $("zoomResetBtn").textContent = `${Math.round(state.zoom * 100)}%`;
  renderMap();
};

$("zoomInBtn").addEventListener("click", () => setZoom(state.zoom + .1));
$("zoomOutBtn").addEventListener("click", () => setZoom(state.zoom - .1));
$("zoomResetBtn").addEventListener("click", () => setZoom(1));
$("emptySampleBtn").addEventListener("click", () => setData(JSON.parse(JSON.stringify(SAMPLE))));

function updateUI(animate=false) {
  applyTranslations();
  if (!state.data) {
    $("emptyState").classList.remove("hidden");
    $("map").innerHTML = "";
    $("status").className = "status neutral";
    $("status").textContent = t("load");
    return;
  }
  $("emptyState").classList.add("hidden");
  $("buildingName").textContent = state.data.building;
  $("datasetBadge").textContent = state.data.building;
  $("nodeCount").textContent = state.data.nodes.length;
  $("edgeCount").textContent = state.data.edges.length;
  $("blockedCount").textContent = state.blockedNodes.size + state.blockedEdges.size;
  $("closedCount").textContent = state.closedExits.size;

  const eligible = state.data.nodes
    .filter(n => ["room","junction"].includes(n.type) && !state.blockedNodes.has(n.id))
    .sort((a,b)=>a.id.localeCompare(b.id));

  const old = state.startId;
  if (!eligible.some(n=>n.id===state.startId)) state.startId = eligible[0]?.id || null;

  $("startSelect").innerHTML = `<option value="">${escapeHtml(t("chooseStart"))}</option>` +
    eligible.map(n => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.id)} — ${escapeHtml(n.label)}</option>`).join("");
  $("startSelect").value = state.startId || "";

  state.route = findRoute(state.startId);
  renderRoute();
  renderMap(animate || old !== state.startId);
}

function renderRoute() {
  const status = $("status");
  const route = state.route;
  if (!state.startId) {
    status.className = "status neutral";
    status.textContent = t("clickStart");
    $("routeExit").textContent = "—";
    $("routeCost").textContent = "—";
    $("routePath").textContent = "—";
    $("pathCount").textContent = "0 stops";
    $("routeStatusDot").className = "status-dot";
    return;
  }
  if (route?.blockedStart) {
    status.className = "status error";
    status.textContent = t("blockedStart");
    $("routeExit").textContent = "—";
    $("routeCost").textContent = "—";
    $("routePath").textContent = "—";
    $("pathCount").textContent = "0 stops";
    $("routeStatusDot").className = "status-dot error";
    return;
  }
  if (!route) {
    status.className = "status error";
    status.textContent = t("noRoute");
    $("routeExit").textContent = "—";
    $("routeCost").textContent = "—";
    $("routePath").textContent = "—";
    $("pathCount").textContent = "0 stops";
    $("routeStatusDot").className = "status-dot error";
    return;
  }
  status.className = "status success";
  status.textContent = t("success");
  $("routeExit").textContent = route.exitId;
  $("routeCost").textContent = route.cost;
  $("routePath").textContent = route.path.join(" → ");
  $("pathCount").textContent = `${route.path.length} ${route.path.length === 1 ? "stop" : "stops"}`;
  $("routeStatusDot").className = "status-dot success";
}

function renderMap(animate=false) {
  const svg = $("map");
  svg.innerHTML = "";
  if (!state.data) return;

  const nodes = state.data.nodes;
  const pad = 70;
  const xs = nodes.map(n=>Number(n.coordinates.x));
  const ys = nodes.map(n=>Number(n.coordinates.y));
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const width = Math.max(700, maxX-minX+pad*2);
  const height = Math.max(500, maxY-minY+pad*2);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const baseView = {x:minX-pad, y:minY-pad, width, height};
  const zw = width / state.zoom, zh = height / state.zoom;
  const zx = baseView.x + (width - zw) / 2, zy = baseView.y + (height - zh) / 2;
  svg.setAttribute("viewBox", `${zx} ${zy} ${zw} ${zh}`);

  const routeSet = routeEdges(state.route);
  const routeNodes = new Set(state.route?.path || []);

  const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg","g");
  const labelLayer = document.createElementNS("http://www.w3.org/2000/svg","g");
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg","g");

  const nodeById = new Map(nodes.map(n=>[n.id,n]));
  for (const e of state.data.edges) {
    const a=nodeById.get(e.from), b=nodeById.get(e.to);
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",a.coordinates.x); line.setAttribute("y1",a.coordinates.y);
    line.setAttribute("x2",b.coordinates.x); line.setAttribute("y2",b.coordinates.y);
    line.classList.add("edge");
    if (state.blockedEdges.has(e.id)) line.classList.add("blocked");
    if (routeSet.has(e.id)) line.classList.add("route");
    line.dataset.id=e.id;
    line.addEventListener("click",(ev)=>{ev.stopPropagation(); toggleEdge(e.id);});
    edgeLayer.appendChild(line);

    const text=document.createElementNS("http://www.w3.org/2000/svg","text");
    text.setAttribute("x",(a.coordinates.x+b.coordinates.x)/2);
    text.setAttribute("y",(a.coordinates.y+b.coordinates.y)/2-7);
    text.setAttribute("text-anchor","middle");
    text.classList.add("edge-label");
    text.textContent=e.cost;
    labelLayer.appendChild(text);
  }

  for (const n of nodes) {
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.classList.add("node-group");
    if (routeNodes.has(n.id)) g.classList.add("route-node");
    if (state.blockedNodes.has(n.id) || (n.type==="exit" && state.closedExits.has(n.id))) g.classList.add("blocked");
    if (n.id===state.startId) g.classList.add("selected");
    if (animate && (routeNodes.has(n.id) || n.id===state.startId)) g.classList.add("pulse");

    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",n.coordinates.x); c.setAttribute("cy",n.coordinates.y);
    c.setAttribute("r", n.type==="exit" ? 18 : 16);
    c.classList.add("node-circle");
    c.setAttribute("fill", nodeColor(n));
    g.appendChild(c);

    const label=document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x",n.coordinates.x); label.setAttribute("y",n.coordinates.y+34);
    label.setAttribute("text-anchor","middle"); label.classList.add("node-label");
    label.textContent=n.label;
    g.appendChild(label);

    const type=document.createElementNS("http://www.w3.org/2000/svg","text");
    type.setAttribute("x",n.coordinates.x); type.setAttribute("y",n.coordinates.y+47);
    type.setAttribute("text-anchor","middle"); type.classList.add("node-type");
    type.textContent = n.type;
    g.appendChild(type);

    g.addEventListener("click",(ev)=>{ev.stopPropagation(); toggleNode(n.id);});
    nodeLayer.appendChild(g);
  }

  svg.append(edgeLayer,labelLayer,nodeLayer);
}

function nodeColor(n) {
  if (state.blockedNodes.has(n.id) || (n.type==="exit" && state.closedExits.has(n.id))) return "#d84c4c";
  if (n.type==="exit") return "#15966a";
  if (n.type==="junction") return "#8ba0b7";
  return "#2f78d0";
}

function toggleNode(id) {
  const n=state.data.nodes.find(x=>x.id===id);
  if (!n) return;
  if (n.type==="exit") {
    state.closedExits.has(id) ? state.closedExits.delete(id) : state.closedExits.add(id);
  } else {
    state.blockedNodes.has(id) ? state.blockedNodes.delete(id) : state.blockedNodes.add(id);
  }
  updateUI(true);
}

function toggleEdge(id) {
  state.blockedEdges.has(id) ? state.blockedEdges.delete(id) : state.blockedEdges.add(id);
  updateUI(true);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function applyTranslations() {
  $("subtitle").textContent=t("subtitle");
  $("langBtn").textContent=state.lang==="en"?"বাংলা":"English";
  $("resetBtn").textContent=t("reset");
  $("importText").textContent=t("importText");
  $("buildingLabel").textContent=t("building");
  $("startLabel").textContent=t("start");
  $("startHint").textContent=t("startHint");
  $("routeTitle").textContent=t("route");
  $("exitLabel").textContent=t("exit");
  $("costLabel").textContent=t("cost");
  $("pathLabel").textContent=t("path");
  $("hazardTitle").textContent=t("hazards");
  $("hazardHint").textContent=t("hazardHint");
  $("roomText").textContent=t("room");
  $("junctionText").textContent=t("junction");
  $("exitText").textContent=t("openExit");
  $("blockedText").textContent=t("blocked");
  $("routeText").textContent=t("selected");
  $("nodesStat").textContent=t("nodes");
  $("edgesStat").textContent=t("corridors");
  $("blockedStat").textContent=t("blockedStat");
  $("closedStat").textContent=t("closed");
  $("mapTitle").textContent=t("mapTitle");
  $("mapHint").textContent=t("mapHint");
  $("sampleBtn").textContent=t("sample");
  $("interactionHint").textContent=t("interaction");
  if (!state.data) {
    $("emptyTitle").textContent=t("emptyTitle");
    $("emptyText").textContent=t("emptyText");
  }
}

$("fileInput").addEventListener("change", async (e)=>{
  const file=e.target.files[0];
  if (!file) return;
  try {
    const data=JSON.parse(await file.text());
    setData(data);
  } catch (err) {
    state.data=null;
    $("emptyState").classList.remove("hidden");
    $("status").className="status error";
    $("status").textContent=`${t("invalid")}: ${err.message}`;
  }
});

$("startSelect").addEventListener("change", e=>{
  state.startId=e.target.value || null;
  updateUI(true);
});

$("resetBtn").addEventListener("click", reset);

$("sampleBtn").addEventListener("click", ()=>{
  setData(JSON.parse(JSON.stringify(SAMPLE)));
});

$("langBtn").addEventListener("click", ()=>{
  state.lang=state.lang==="en"?"bn":"en";
  updateUI();
});


updateUI();
