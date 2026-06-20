const ALL_METRICS = [...BOSS_METRICS, ...EXTRA_METRICS];
const STORAGE_CURRENT = "salmonrun.current.v4";
const STORAGE_HISTORY = "salmonrun.history.v4";
const HISTORY_LIMIT = 10;

const bossInputsEl = document.getElementById("bossInputs");
const extraInputsEl = document.getElementById("extraInputs");
const rankingEl = document.getElementById("ranking");
const summaryEl = document.getElementById("summary");
const extraSummaryEl = document.getElementById("extraSummary");
const historyListEl = document.getElementById("historyList");
const recordDateEl = document.getElementById("recordDate");
const shareTextEl = document.getElementById("shareText");
const shareUrlEl = document.getElementById("shareUrl");
const historyMetricSelectEl = document.getElementById("historyMetricSelect");
const mainCanvas = document.getElementById("mainChart");
const historyCanvas = document.getElementById("historyChart");
const mainCtx = mainCanvas.getContext("2d");
const historyCtx = historyCanvas.getContext("2d");
const historySelect = document.getElementById("historySelect");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");

function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
const CATEGORY_COLOR = { near: css("--near"), mid: css("--mid"), far: css("--far"), extra: css("--extra") };

// 日付を取得
function todayISO(date = new Date()){
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function defaults(){ return Object.fromEntries(ALL_METRICS.map(m => [m.key, 0])); }
function loadJSON(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }

let currentState = loadJSON(STORAGE_CURRENT, { date: todayISO(), values: defaults() });
let historyState = Array.isArray(loadJSON(STORAGE_HISTORY, [])) ? loadJSON(STORAGE_HISTORY, []) : [];
if (!currentState.values) currentState.values = defaults();
if (!currentState.date) currentState.date = todayISO();

function saveCurrent(){ localStorage.setItem(STORAGE_CURRENT, JSON.stringify(currentState)); }
function saveHistory(){ localStorage.setItem(STORAGE_HISTORY, JSON.stringify(historyState.slice(-HISTORY_LIMIT))); }
function metricByKey(key){ return ALL_METRICS.find(m => m.key === key); }

// 最新の履歴を取得
function getLatestHistoryEntry(){
	if (!historyState.length) return null;

	return historyState.reduce((a, b) =>
		a.date > b.date ? a : b
	);
}

// 最新の履歴を入力欄に反映
function initCurrentFromLatestHistoryWithTodayDate(){
	const today = todayISO();

	// 今日データ優先
	const todayEntry = historyState.find(e => e.date === today);

	if (todayEntry){
		currentState.values = { ...defaults(), ...todayEntry.values };
	} else {
		// なければ最新履歴をセット
		const latest = getLatestHistoryEntry();
		currentState.values = latest
			? { ...defaults(), ...latest.values }
			: defaults();
	}

	// 日付は「今日」
	currentState.date = today;

	saveCurrent();

	// 日付フィールド反映
	recordDateEl.value = currentState.date;

	// 入力欄へ反映
	document.querySelectorAll(".metric-input").forEach(input => {
		const key = input.dataset.key;
		input.value = currentState.values[key] ?? 0;
	});
}

function sortAndRecalculateHistory(entries){
	const sorted = [...entries].sort((a, b) => {
		const d = String(a.date || "").localeCompare(String(b.date || ""));
		if (d !== 0) return d;
		return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
	}).slice(-HISTORY_LIMIT);

	let prev = null;
	sorted.forEach(entry => {
		entry.deltas = entry.deltas || {};
		ALL_METRICS.forEach(metric => {
			const before = prev?.values?.[metric.key] ?? 0;
			const now = entry.values?.[metric.key] ?? 0;
			entry.deltas[metric.key] = now - before;
		});
		prev = entry;
	});
	return sorted;
}

historyState = sortAndRecalculateHistory(historyState);
saveHistory();

function buildGrid(rootEl, metrics){
	rootEl.innerHTML = "";
	metrics.forEach(metric => {
		const card = document.createElement("label");
		card.className = `metric-cell ${metric.category}`;
		card.innerHTML = `
			<div class="metric-title">${metric.name}</div>
			<input class="metric-input" type="number" min="0" step="1" value="${currentState.values?.[metric.key] ?? 0}" data-key="${metric.key}" aria-label="${metric.name}の入力値">
		`;
		rootEl.appendChild(card);
	});
}

function wireInputs(){
	document.querySelectorAll(".metric-input").forEach(input => {
		input.addEventListener("input", () => {
			const key = input.dataset.key;
			currentState.values[key] = Math.max(0, Number(input.value) || 0);
			saveCurrent();
			renderAll();
		});
	});
}

function initMetricSelect(){
	historyMetricSelectEl.innerHTML = ALL_METRICS.map(m => `<option value="${m.key}">${m.name}</option>`).join("");
	historyMetricSelectEl.value = "goldenEggs";
	historyMetricSelectEl.addEventListener("change", renderHistoryChart);
}

function orderedBossData(values = currentState.values){
	return BOSS_METRICS.map(metric => ({ ...metric, value: Number(values?.[metric.key] || 0) }));
}

function bossStatsFrom(data){
	const total = data.reduce((sum, d) => sum + d.value, 0);
	const byCategory = { near: 0, mid: 0, far: 0 };
	data.forEach(d => { byCategory[d.category] += d.value; });
	const top3 = [...data].sort((a,b) => b.value - a.value || a.name.localeCompare(b.name, "ja")).slice(0, 3);
	const maxValue = Math.max(10, ...data.map(d => d.value));
	return { total, byCategory, top3, maxValue };
}

function currentDeltaMap(){
	if (!historyState.length) return Object.fromEntries(ALL_METRICS.map(m => [m.key, currentState.values?.[m.key] ?? 0]));
	const last = historyState[historyState.length - 1];
	return Object.fromEntries(ALL_METRICS.map(m => [m.key, (currentState.values?.[m.key] ?? 0) - (last.values?.[m.key] ?? 0)]));
}

function saveSnapshot(){
	const date = recordDateEl.value || todayISO();

	// 同日チェック
	const existingIndex = historyState.findIndex(e => e.date === date);

	// 保存データ
	const entry = {
		date,
		values: { ...defaults(), ...currentState.values },
		createdAt: new Date().toISOString(),
		deltas: {}
	};

	if (existingIndex !== -1) {
		// 上書き
		historyState[existingIndex] = entry;
	} else {
		// 新規追加
		historyState.push(entry);
	}

	// ソート＋差分再計算＋10件制限
	historyState = sortAndRecalculateHistory(historyState)
		.slice(-HISTORY_LIMIT);

	saveHistory();
	renderAll();
	updateHistorySelect();
	renderHistoryList();
	renderHistoryChart();
	editShareText();
}

// 入力欄を初期化(0にする)
function resetInputs(){
	currentState = { date: todayISO(), values: defaults() };
	saveCurrent();

	// UIに反映
	recordDateEl.value = currentState.date;

	document.querySelectorAll(".metric-input").forEach(input => {
		input.value = 0;
	 });
	renderAll();
}

function renderRanking(top3){
	rankingEl.innerHTML = top3.map((item, i) => `
		<div class="rank-item">
			<div class="rank-badge">${i + 1}</div>
			<div>
				<div class="rank-name">${item.name}</div>
				<div class="rank-sub">${CATEGORY_LABEL[item.category]}</div>
			</div>
			<div class="rank-score">${item.value}</div>
		</div>
	`).join("");
}

function renderSummary(stats, deltas){
	const pct = (v) => stats.total ? ((v / stats.total) * 100).toFixed(1) : "0.0";
	const totalDelta = BOSS_METRICS.reduce((sum, m) => sum + (deltas[m.key] || 0), 0);
	summaryEl.innerHTML = `
		<div class="summary-row"><span class="summary-label">オオモノ合計</span><span class="summary-value">${stats.total}</span></div>
		<div class="summary-row"><span class="summary-label">オオモノ差分合計</span><span class="summary-value">${totalDelta > 0 ? "+" : ""}${totalDelta}</span></div>
		<div class="summary-row"><span class="summary-label">近距離割合</span><span class="summary-value">${pct(stats.byCategory.near)}%</span></div>
		<div class="summary-row"><span class="summary-label">中距離割合</span><span class="summary-value">${pct(stats.byCategory.mid)}%</span></div>
		<div class="summary-row"><span class="summary-label">遠距離割合</span><span class="summary-value">${pct(stats.byCategory.far)}%</span></div>
		<div class="summary-row"><span class="summary-label">履歴件数</span><span class="summary-value">${historyState.length} / ${HISTORY_LIMIT}</span></div>
	`;
}

function renderExtraSummary(deltas){
	extraSummaryEl.innerHTML = EXTRA_METRICS.map(m => {
		const value = currentState.values?.[m.key] ?? 0;
		const delta = deltas[m.key] ?? 0;
		return `<div class="summary-row"><span class="summary-label">${m.name}</span><span class="summary-value">${value} <small>(${delta > 0 ? "+" : ""}${delta})</small></span></div>`;
	}).join("");
}

// 履歴一件分の詳細を表示
function renderHistoryList(){
	if (!historyState.length) {
		historyListEl.innerHTML = '<p class="empty-text">履歴はまだありません。</p>';
		return;
	}
	let targetEntry = null;

	// 選択している履歴があれば読込
  	const idx = Number(historySelect.value);
  	if (!Number.isNaN(idx) && historyState[idx]) {
		targetEntry = historyState[idx];
	}

	// 選択していなければ最新の履歴を読込
	if (!targetEntry && historyState.length){
		targetEntry = historyState[historyState.length - 1];
	}

	const rows = ALL_METRICS.map(metric => {
		const value = targetEntry.values?.[metric.key] ?? 0;
		const delta = targetEntry.deltas?.[metric.key] ?? 0;
		const cls = delta > 0 ? 'plus' : delta === 0 ? 'zero' : 'minus';
		return `<div class="history-grid-row"><span>${metric.name}</span><span class="num">${value}</span><span class="num delta ${cls}">${delta > 0 ? `+${delta}` : `${delta}`}</span></div>`;
	}).join("");

	historyListEl.innerHTML = `
		<section class="history-entry">
			<h3>${targetEntry.date}</h3>
			<div class="history-grid-head"><span>項目</span><span class="num">値</span><span class="num">差分</span></div>
			${rows}
		</section>`;
}

// 履歴コンボボックスを設定
function updateHistorySelect(){
	if (!historyState.length){
		historySelect.innerHTML = '<option>履歴なし</option>';
		return;
	}

	// 履歴リストを降順に並び変える
	const reversed = historyState
		.map((r,i) => ({ r, i }))
		.reverse();

	// 降順リストをコンボボックスにセット
	historySelect.innerHTML = reversed
		.map(({ r, i }) => `<option value="${i}">${r.date}</option>`)
		.join("");

	// 最新 or 登録した履歴を選択
	const today = currentState.date;
	const todayIndex = historyState.findIndex(e => e.date === today);

	if (todayIndex !== -1){
		historySelect.value = String(todayIndex);
	} else {
		historySelect.value = String(historyState.length - 1);
	}
}

function loadSelectedHistoryIntoForm(){
	const idx = Number(historySelect.value);
	const entry = historyState[idx];

	if (!entry) return;

	// 値をコピー
	currentState.values = { ...entry.values };

	// 日付も切り替える
	currentState.date = entry.date;

	saveCurrent();

	// 入力欄へ反映
	document.querySelectorAll(".metric-input").forEach(input => {
		const key = input.dataset.key;
		input.value = currentState.values[key] ?? 0;
	});

	// 日付欄反映
	document.getElementById("recordDate").value = entry.date;

	renderAll();
}

function renderHistoryChart(){
	historyCtx.clearRect(0, 0, historyCanvas.width, historyCanvas.height);
	fillRound(historyCtx, 0, 0, historyCanvas.width, historyCanvas.height, 22, "#ffffff");
	const metric = metricByKey(historyMetricSelectEl.value || "goldenEggs") || ALL_METRICS[0];
	const points = historyState.map(entry => ({ date: entry.date, value: entry.values?.[metric.key] ?? 0 }));

	drawText(historyCtx, `${metric.name} の推移`, 24, 36, 20, "#2d160d", 900);
	if (!points.length) {
		drawText(historyCtx, "履歴がまだありません。", 24, 72, 14, "#7a4a36", 700);
		return;
	}
	const pad = { top: 50, right: 28, bottom: 54, left: 44 };
	const chartW = historyCanvas.width - pad.left - pad.right;
	const chartH = historyCanvas.height - pad.top - pad.bottom;
	const maxValue = Math.max(1, ...points.map(p => p.value));

	historyCtx.strokeStyle = "#e6c5b3";
	historyCtx.lineWidth = 1;
	historyCtx.beginPath();
	historyCtx.moveTo(pad.left, pad.top);
	historyCtx.lineTo(pad.left, pad.top + chartH);
	historyCtx.lineTo(pad.left + chartW, pad.top + chartH);
	historyCtx.stroke();

	for (let i = 1; i <= 4; i++) {
		const y = pad.top + chartH - (chartH * i / 4);
		historyCtx.beginPath();
		historyCtx.moveTo(pad.left, y);
		historyCtx.lineTo(pad.left + chartW, y);
		historyCtx.strokeStyle = "#f1d8ca";
		historyCtx.stroke();
		drawText(historyCtx, String(Math.round(maxValue * i / 4)), pad.left - 8, y + 4, 11, "#7a4a36", 700, "right");
	}

	historyCtx.beginPath();
	points.forEach((p, i) => {
		const x = pad.left + (chartW * i / Math.max(1, points.length - 1));
		const y = pad.top + chartH - (p.value / maxValue) * chartH;
		if (i === 0) historyCtx.moveTo(x, y); else historyCtx.lineTo(x, y);
	});
	historyCtx.strokeStyle = css("--salmonrun");
	historyCtx.lineWidth = 3;
	historyCtx.stroke();

	points.forEach((p, i) => {
		const x = pad.left + (chartW * i / Math.max(1, points.length - 1));
		const y = pad.top + chartH - (p.value / maxValue) * chartH;
		historyCtx.beginPath();
		historyCtx.arc(x, y, 4.5, 0, Math.PI * 2);
		historyCtx.fillStyle = css("--salmonrun");
		historyCtx.fill();
		historyCtx.strokeStyle = "#fff";
		historyCtx.lineWidth = 2;
		historyCtx.stroke();
		drawText(historyCtx, String(p.value), x, y - 10, 11, "#2d160d", 800, "center");
		drawText(historyCtx, p.date.slice(5), x, pad.top + chartH + 22, 11, "#7a4a36", 700, "center");
	});
}

function renderAll(){
	const bossData = orderedBossData();
	const stats = bossStatsFrom(bossData);
	const deltas = currentDeltaMap();
	//renderRanking(stats.top3);
	//renderSummary(stats, deltas);
	//renderExtraSummary(deltas);
	renderMainChart(bossData, stats, deltas);
}

function renderMainChart(data, stats, deltas){
	mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
	fillRound(mainCtx, 0, 0, mainCanvas.width, mainCanvas.height, 28, "#ffffff");
	drawText(mainCtx, "サーモンラン オオモノ討伐グラフ", 38, 58, 30, "#2d160d", 900);
	drawText(mainCtx, `${recordDateEl.value || todayISO()} の記録`, 38, 90, 20, "#7a4a36", 700);

	const centerX = 600, centerY = 600, radius = 450, levels = 5, N = data.length;
	for (let lv = 1; lv <= levels; lv++) {
		const r = radius * (lv / levels);
		mainCtx.beginPath();
		data.forEach((_, i) => {
			const a = angleAt(i, N), x = centerX + Math.cos(a) * r, y = centerY + Math.sin(a) * r;
			if (i === 0) mainCtx.moveTo(x, y); else mainCtx.lineTo(x, y);
		});
		mainCtx.closePath();
		mainCtx.strokeStyle = lv === levels ? "#e3c2af" : "#f0d8cb";
		mainCtx.lineWidth = 1;
		mainCtx.stroke();
	}
	data.forEach((_, i) => {
		const a = angleAt(i, N);
		mainCtx.beginPath();
		mainCtx.moveTo(centerX, centerY);
		mainCtx.lineTo(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius);
		mainCtx.strokeStyle = "#f0d8cb";
		mainCtx.stroke();
	});
	for (let lv = 1; lv <= levels; lv++) drawText(mainCtx, String(Math.round(stats.maxValue * lv / levels)), centerX + 10, centerY - radius * (lv / levels), 20, "#a66b52", 700);

	mainCtx.beginPath();
	data.forEach((d, i) => {
		const ratio = d.value / stats.maxValue, a = angleAt(i, N), x = centerX + Math.cos(a) * radius * ratio, y = centerY + Math.sin(a) * radius * ratio;
		if (i === 0) mainCtx.moveTo(x, y); else mainCtx.lineTo(x, y);
	});
	mainCtx.closePath();
	mainCtx.fillStyle = css("--primary-fill");
	mainCtx.strokeStyle = css("--salmonrun");
	mainCtx.lineWidth = 3;
	mainCtx.fill();
	mainCtx.stroke();

	data.forEach((d, i) => {
		const a = angleAt(i, N), ratio = d.value / stats.maxValue;
		const x = centerX + Math.cos(a) * radius * ratio, y = centerY + Math.sin(a) * radius * ratio;
		const lx = centerX + Math.cos(a) * (radius + 52), ly = centerY + Math.sin(a) * (radius + 52);
		mainCtx.beginPath();
		mainCtx.arc(x, y, 6, 0, Math.PI * 2);
		mainCtx.fillStyle = CATEGORY_COLOR[d.category];
		mainCtx.fill();
		mainCtx.strokeStyle = "#fff";
		mainCtx.lineWidth = 2;
		mainCtx.stroke();
		drawNameChip(d.name, lx, ly, CATEGORY_COLOR[d.category], a);
		drawText(mainCtx, String(d.value), centerX + Math.cos(a) * (radius + 24), centerY + Math.sin(a) * (radius + 24), 20, "#5f2f1d", 800, "center");
	});

	drawLegend();
	drawTop3Card(50, 1120, 440, 220, stats.top3);
	drawCategoryCard(500, 1120, 690, 190, stats);
	drawDeltaTable(50, 1350, 900, 200, deltas);
}

function drawLegend(){
	[ [60, css("--near"), "近距離"], [170, css("--mid"), "中距離"], [280, css("--far"), "遠距離"] ].forEach(([x,c,label]) => {
		mainCtx.beginPath(); mainCtx.arc(x, 110, 6, 0, Math.PI * 2); mainCtx.fillStyle = c; mainCtx.fill(); drawText(mainCtx, label, x + 14, 120, 20, "#7a4a36", 800);
	});
	mainCtx.beginPath();
	mainCtx.moveTo(408, 104); mainCtx.lineTo(418, 109); mainCtx.lineTo(414, 119); mainCtx.lineTo(400, 115); mainCtx.lineTo(396, 105); mainCtx.closePath();
	mainCtx.fillStyle = css("--primary-fill"); mainCtx.strokeStyle = css("--salmonrun"); mainCtx.lineWidth = 2; mainCtx.fill(); mainCtx.stroke();
	drawText(mainCtx, "今回値", 426, 120, 20, "#7a4a36", 800);
}

function drawTop3Card(x, y, w, h, top3){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "トップ3", x + 18, y + 34, 24, "#2d160d", 900);
	top3.forEach((item, i) => {
		const yy = y + 78 + i * 48;
		mainCtx.beginPath(); mainCtx.arc(x + 28, yy, 14, 0, Math.PI * 2); mainCtx.fillStyle = i===0 ? "#fde68a" : i===1 ? "#e0ecff" : "#fee2e2"; mainCtx.fill();
		drawText(mainCtx, String(i + 1), x + 28, yy + 4, 15, "#2d160d", 900, "center");
		drawText(mainCtx, item.name, x + 56, yy - 2, 18, "#2d160d", 800);
		drawText(mainCtx, CATEGORY_LABEL[item.category], x + 56, yy + 16, 18, CATEGORY_COLOR[item.category], 800);
		drawText(mainCtx, String(item.value), x + w - 20, yy + 6, 22, "#2d160d", 900, "right");
	});
}

function drawCategoryCard(x, y, w, h, stats){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "分類割合", x + 18, y + 34, 24, "#2d160d", 900);
	const total = Math.max(1, stats.total), barX = x + 18, barY = y + 60, barW = w - 36, barH = 34;
	const nearW = barW * (stats.byCategory.near / total), midW = barW * (stats.byCategory.mid / total), farW = barW * (stats.byCategory.far / total);
	fillRound(mainCtx, barX, barY, barW, barH, 18, "#f7e4d8");
	if (nearW > 0) fillRound(mainCtx, barX, barY, nearW, barH, 18, css("--near"));
	if (midW > 0) fillRect(mainCtx, barX + nearW, barY, midW, barH, css("--mid"));
	if (farW > 0) fillRound(mainCtx, barX + nearW + midW, barY, farW, barH, 18, css("--far"));
	drawText(mainCtx, `近距離 ${stats.byCategory.near}`, x + 18, y + 124, 22, css("--near"), 900);
	drawText(mainCtx, `中距離 ${stats.byCategory.mid}`, x + 260, y + 124, 22, css("--mid"), 900);
	drawText(mainCtx, `遠距離 ${stats.byCategory.far}`, x + 500, y + 124, 22, css("--far"), 900);
}

function drawDeltaTable(x, y, w, h, deltas){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "オカシラ、金イクラ", x + 18, y + 34, 24, "#2d160d", 900);
	EXTRA_METRICS.forEach((m, i) => {
		yy = y + 84 + i * 44; 
		const v = currentState.values?.[m.key] ?? 0; 
		const d = deltas[m.key] ?? 0;
		if(i > 2){
			x = 500;
			yy = yy - 3 * 44;
		}
		drawText(mainCtx, m.name, x + 20, yy, 20, "#2d160d", 800);
		drawText(mainCtx, `今回　${v}`, x + 180, yy, 15, "#7a4a36", 700);
		drawText(mainCtx, d > 0 ? `+${d}` : `${d}`, x + 350, yy, 18, d > 0 ? css("--plus") : css("--zero"), 900, "right");
	});
}

function drawNameChip(text, x, y, bg, angle){
	const padX = 9; const w = Math.max(54, measureText(mainCtx, text, 20, 800) + padX * 2); const h = 26;
	let left = x - w / 2, top = y - h / 2;
	if (Math.cos(angle) > 0.35) left -= 4; if (Math.cos(angle) < -0.35) left += 4; if (Math.sin(angle) > 0.45) top += 4; if (Math.sin(angle) < -0.45) top -= 4;
	fillRound(mainCtx, left, top, w, h, 13, bg); drawText(mainCtx, text, left + w / 2, top + 17, 20, "#ffffff", 900, "center");
}

function angleAt(index, total){ return Math.PI * 2 * index / total - Math.PI / 2; }
function drawText(ctx, text, x, y, size = 20, color = "#000", weight = 400, align = "left"){
	ctx.save(); ctx.font = `${weight} ${size}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(text, x, y); ctx.restore();
}
function measureText(ctx, text, size = 12, weight = 400){ ctx.save(); ctx.font = `${weight} ${size}px sans-serif`; const w = ctx.measureText(text).width; ctx.restore(); return w; }
function roundRectPath(ctx, x, y, w, h, r){ const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2)); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
function fillRound(ctx, x, y, w, h, r, fill){ ctx.save(); roundRectPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
function strokeRound(ctx, x, y, w, h, r, stroke){ ctx.save(); roundRectPath(ctx, x, y, w, h, r); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
function fillRect(ctx, x, y, w, h, fill){ ctx.save(); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore(); }
function formatFileDate(date = new Date()){ const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,"0"), d=String(date.getDate()).padStart(2,"0"), hh=String(date.getHours()).padStart(2,"0"), mm=String(date.getMinutes()).padStart(2,"0"); return `${y}${m}${d}-${hh}${mm}`; }

function saveImage(){ const a=document.createElement("a"); a.download=`salmonrun-chart-${formatFileDate()}.png`; a.href=mainCanvas.toDataURL("image/png"); a.click(); }


// 投稿用テキストを編集
function editShareText(){
	share_txt = "";

	const bossData = orderedBossData(); 
	const stats = bossStatsFrom(bossData);
	const deltas = currentDeltaMap();

	const top3 = stats.top3.map((d,i)=>`${i+1}位 ${d.name} ${d.value}`).join("\n");
	const eggs = currentState.values.goldenEggs ?? 0;

	const textPrefix=("オオモノ討伐数を更新！").trim();
	const text = `${textPrefix}\n■日付 ${recordDateEl.value || todayISO()}\n■TOP3\n${top3}\n■金イクラ ${eggs}\n`;

	add_result_txt(text);
}

function clearHistory(){ historyState=[]; saveHistory(); 
	renderHistoryList(); renderHistoryChart(); renderAll(); }

// init
buildGrid(bossInputsEl, BOSS_METRICS);
buildGrid(extraInputsEl, EXTRA_METRICS);
wireInputs();
initMetricSelect();
updateHistorySelect();
renderHistoryList();
initCurrentFromLatestHistoryWithTodayDate();
renderAll();
renderHistoryChart();

document.getElementById("saveImageBtn").addEventListener("click", saveImage);
document.getElementById("saveHistoryBtn").addEventListener("click", () => { saveSnapshot(); alert("今回の内容を日付順で履歴保存し、差分を再計算しました。"); });
document.getElementById("clearHistoryBtn").addEventListener("click", () => { clearHistory(); alert("履歴を削除しました。"); });
document.getElementById("resetBtn").addEventListener("click", resetInputs);
loadHistoryBtn.addEventListener("click", loadSelectedHistoryIntoForm);
historySelect.addEventListener("change", () => {renderHistoryList();});
