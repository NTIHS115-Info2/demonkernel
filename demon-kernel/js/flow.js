const svg = document.getElementById("flowSvg");
if (!svg) {
  console.error("找不到 #flowSvg：檢查 flow.html 是否有 <svg id='flowSvg'>");
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  children.forEach(c => n.appendChild(c));
  return n;
}

function node(x, y, w, h, title, subtitle, key) {
  const g = el("g", { "data-key": key });
  g.style.cursor = "pointer";

  const r = el("rect", {
    x, y, width: w, height: h, rx: 14,
    fill: "#141414", stroke: "#cfcfcf", "stroke-width": "2"
  });

  const t1 = el("text", { x: x + 16, y: y + 30, fill: "#fff", "font-size": "18", "font-weight": "700" });
  t1.textContent = title;

  const t2 = el("text", { x: x + 16, y: y + 56, fill: "#bdbdbd", "font-size": "13" });
  t2.textContent = subtitle;

  g.appendChild(r);
  g.appendChild(t1);
  g.appendChild(t2);

  g.addEventListener("click", () => {
    console.log("clicked:", key);
    // 之後你要整合 UI，就在這裡呼叫 openPanel(key)
  });

  return g;
}

function arrow(x1, y1, x2, y2) {
  return el("line", {
    x1, y1, x2, y2,
    stroke: "#cfcfcf", "stroke-width": "2.5",
    "marker-end": "url(#arrowHead)"
  });
}

// arrow head
const defs = el("defs");
defs.appendChild(
  el("marker", {
    id: "arrowHead", markerWidth: "10", markerHeight: "10",
    refX: "9", refY: "3", orient: "auto", markerUnits: "strokeWidth"
  }, [el("path", { d: "M0,0 L10,3 L0,6 Z", fill: "#cfcfcf" })])
);
svg.appendChild(defs);

// nodes
svg.appendChild(node(60, 90, 220, 80, "① 輸入模型", "使用者選擇/上傳模型", "model"));
svg.appendChild(node(60, 220, 220, 80, "② 制定規則", "條件、限制、工具權限", "rules"));
svg.appendChild(node(320, 90, 220, 80, "③ LLM 模型", "選擇 LLM、參數、溫度", "llm"));
svg.appendChild(node(580, 40, 280, 420, "④ 已勾選資料", "顯示勾選資料清單", "selected"));

// arrows (照你的流程)
svg.appendChild(arrow(280, 130, 320, 130)); // 1 -> 3
svg.appendChild(arrow(170, 170, 170, 220)); // 1 -> 2
svg.appendChild(arrow(540, 130, 580, 130)); // 3 -> 4
svg.appendChild(arrow(280, 260, 580, 260)); // 2 -> 4

const canvas = document.querySelector('#rightPane canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width  = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之後用 CSS 像素畫就好
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 每次重畫前，清掉（透明），讓底下 rightPane 的灰底露出來
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ...你的繪圖...
  requestAnimationFrame(draw);
}
draw();

